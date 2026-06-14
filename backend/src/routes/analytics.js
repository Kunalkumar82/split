const express = require('express');
const router = express.Router();
const prisma = require('../prisma');
const authMiddleware = require('../middleware/auth');
const { calculateGroupBalances } = require('../utils/calculations');

// Apply auth middleware
router.use(authMiddleware);

// GET /api/analytics - Fetch overall stats, monthly trends, and category analysis
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;

    // 1. Fetch all memberships
    const memberships = await prisma.groupMember.findMany({
      where: { userId },
      select: { groupId: true }
    });
    const groupIds = memberships.map(m => m.groupId);

    if (groupIds.length === 0) {
      return res.json({
        totalGroups: 0,
        totalGroupExpenses: 0,
        totalPaidByMe: 0,
        totalMyShare: 0,
        owedByUser: 0,
        owedToUser: 0,
        netBalance: 0,
        monthlyExpenses: [],
        categoryBreakdown: [],
        topSpender: { name: 'N/A', total: 0 },
        mostActiveMember: { name: 'N/A', score: 0 },
        largestExpense: { description: 'N/A', amount: 0, paidBy: 'N/A', group: 'N/A' }
      });
    }

    // 2. Fetch all groups with members, expenses, and settlements to calculate balances
    let totalOwedToUser = 0; // Positive balances sum
    let totalOwedByUser = 0; // Negative balances sum (absolute)

    for (const groupId of groupIds) {
      const groupData = await prisma.group.findUnique({
        where: { id: groupId },
        include: {
          members: {
            include: {
              user: {
                select: { id: true, name: true, email: true, avatarUrl: true }
              }
            }
          },
          expenses: {
            include: { splits: true }
          },
          settlements: true
        }
      });

      if (groupData) {
        const calculations = calculateGroupBalances(groupData.members, groupData.expenses, groupData.settlements);
        const userBalanceRecord = calculations.balances.find(b => b.user.id === userId);
        const balance = userBalanceRecord ? userBalanceRecord.balance : 0;
        
        if (balance > 0) {
          totalOwedToUser += balance;
        } else if (balance < 0) {
          totalOwedByUser += Math.abs(balance);
        }
      }
    }

    const netBalance = totalOwedToUser - totalOwedByUser;

    // 3. Fetch all expenses paid by the user
    const paidExpenses = await prisma.expense.findMany({
      where: {
        paidById: userId,
        groupId: { in: groupIds }
      }
    });
    const totalPaidByMe = paidExpenses.reduce((sum, exp) => sum + exp.amount, 0);

    // 4. Fetch all group expenses in groups the user belongs to
    const groupExpenses = await prisma.expense.findMany({
      where: {
        groupId: { in: groupIds }
      }
    });
    const totalGroupExpenses = groupExpenses.reduce((sum, exp) => sum + exp.amount, 0);

    // 5. Fetch user expense split shares
    const userSplits = await prisma.expenseSplit.findMany({
      where: {
        userId,
        expense: {
          groupId: { in: groupIds }
        }
      },
      include: {
        expense: true
      }
    });

    const totalMyShare = userSplits.reduce((sum, split) => sum + split.amount, 0);

    // 6. Aggregate monthly expenses (user's actual share of bills per month)
    const monthlyMap = {};
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    // Initialize the last 6 months with 0
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyMap[key] = {
        label: `${monthNames[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}`,
        amount: 0
      };
    }

    userSplits.forEach(split => {
      const date = new Date(split.expense.createdAt);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (monthlyMap[key]) {
        monthlyMap[key].amount += split.amount;
      }
    });

    const monthlyExpenses = Object.keys(monthlyMap)
      .sort()
      .map(key => ({
        month: monthlyMap[key].label,
        amount: parseFloat(monthlyMap[key].amount.toFixed(2))
      }));

    // 7. Aggregate spending by category (based on user's share)
    const categoryMap = {};
    // Ensure all standard categories have a record
    const categories = ['Food', 'Travel', 'Shopping', 'Rent', 'Entertainment', 'Utilities', 'Others'];
    categories.forEach(cat => {
      categoryMap[cat] = 0;
    });

    userSplits.forEach(split => {
      const cat = split.expense.category || 'Others';
      if (categoryMap[cat] !== undefined) {
        categoryMap[cat] += split.amount;
      } else {
        categoryMap[cat] = split.amount;
      }
    });

    const categoryBreakdown = Object.keys(categoryMap)
      .map(category => {
        const amount = parseFloat(categoryMap[category].toFixed(2));
        const percentage = totalMyShare > 0 ? parseFloat(((amount / totalMyShare) * 100).toFixed(1)) : 0;
        return {
          category,
          amount,
          percentage
        };
      })
      .filter(item => item.amount > 0 || categories.includes(item.category)); // Keep categories even if 0 if they are standard

    // 8. Fetch all expenses in user's groups to find top spender and largest expense
    const allExpenses = await prisma.expense.findMany({
      where: { groupId: { in: groupIds } },
      include: {
        paidBy: { select: { name: true } },
        group: { select: { name: true } }
      }
    });

    const spenderMap = {};
    let largestExp = { description: 'N/A', amount: 0, paidBy: 'N/A', group: 'N/A' };

    allExpenses.forEach(exp => {
      // Top Spender aggregation
      const uId = exp.paidById;
      const uName = exp.paidBy.name;
      if (!spenderMap[uId]) {
        spenderMap[uId] = { name: uName, total: 0 };
      }
      spenderMap[uId].total += exp.amount;

      // Largest Expense check
      if (exp.amount > largestExp.amount) {
        largestExp = {
          description: exp.description,
          amount: parseFloat(exp.amount.toFixed(2)),
          paidBy: exp.paidBy.name,
          group: exp.group.name
        };
      }
    });

    let topSpender = { name: 'N/A', total: 0 };
    Object.values(spenderMap).forEach(spender => {
      if (spender.total > topSpender.total) {
        topSpender = {
          name: spender.name,
          total: parseFloat(spender.total.toFixed(2))
        };
      }
    });

    // 9. Fetch all messages/comments in user's groups
    const allMessages = await prisma.message.findMany({
      where: {
        expense: { groupId: { in: groupIds } }
      }
    });

    // 10. Fetch all settlements in user's groups
    const allSettlements = await prisma.settlement.findMany({
      where: { groupId: { in: groupIds } }
    });

    // 11. Compile activity scores for most active member
    const activityMap = {};
    const allMemberships = await prisma.groupMember.findMany({
      where: { groupId: { in: groupIds } },
      include: {
        user: { select: { id: true, name: true } }
      }
    });

    allMemberships.forEach(m => {
      if (m.user) {
        activityMap[m.user.id] = { name: m.user.name, score: 0 };
      }
    });

    // Count expenses paid (1 point per expense)
    allExpenses.forEach(exp => {
      if (activityMap[exp.paidById]) {
        activityMap[exp.paidById].score += 1;
      }
    });

    // Count messages sent (1 point per message)
    allMessages.forEach(msg => {
      if (activityMap[msg.userId]) {
        activityMap[msg.userId].score += 1;
      }
    });

    // Count settlements involved (1 point per settlement)
    allSettlements.forEach(settle => {
      if (activityMap[settle.payerId]) {
        activityMap[settle.payerId].score += 1;
      }
      if (activityMap[settle.payeeId]) {
        activityMap[settle.payeeId].score += 1;
      }
    });

    let mostActive = { name: 'N/A', score: 0 };
    Object.values(activityMap).forEach(act => {
      if (act.score > mostActive.score) {
        mostActive = act;
      }
    });

    return res.json({
      totalGroups: groupIds.length,
      totalGroupExpenses: parseFloat(totalGroupExpenses.toFixed(2)),
      totalPaidByMe: parseFloat(totalPaidByMe.toFixed(2)),
      totalMyShare: parseFloat(totalMyShare.toFixed(2)),
      owedByUser: parseFloat(totalOwedByUser.toFixed(2)),
      owedToUser: parseFloat(totalOwedToUser.toFixed(2)),
      netBalance: parseFloat(netBalance.toFixed(2)),
      monthlyExpenses,
      categoryBreakdown,
      topSpender,
      mostActiveMember: mostActive,
      largestExpense: largestExp
    });
  } catch (error) {
    console.error('Analytics fetch error:', error);
    return res.status(500).json({ error: 'Internal server error computing analytics.' });
  }
});

module.exports = router;
