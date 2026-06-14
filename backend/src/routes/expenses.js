const express = require('express');
const router = express.Router();
const prisma = require('../prisma');
const authMiddleware = require('../middleware/auth');
const { logActivity } = require('../utils/activityLogger');

// Apply auth middleware to all expense routes
router.use(authMiddleware);

// POST /api/groups/:groupId/expenses - Create a new expense with splitting calculations
router.post('/groups/:groupId/expenses', async (req, res) => {
  try {
    const { groupId } = req.params;
    const { description, amount: rawAmount, paidById, splitType, splits, category, receiptUrl } = req.body;
    const userId = req.user.id;

    if (!description || !rawAmount || !paidById || !splitType || !splits || !Array.isArray(splits) || splits.length === 0) {
      return res.status(400).json({ error: 'Missing required expense details or split array.' });
    }

    const amount = parseFloat(parseFloat(rawAmount).toFixed(2));
    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Expense amount must be a positive number.' });
    }

    const allowedCategories = ['Food', 'Travel', 'Shopping', 'Rent', 'Entertainment', 'Utilities', 'Others'];
    const finalCategory = allowedCategories.includes(category) ? category : 'Others';

    // Verify user is member of the group
    const membership = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId
        }
      }
    });

    if (!membership) {
      return res.status(403).json({ error: 'Access denied. You are not a member of this group.' });
    }

    // Verify all split participants are registered group members
    const groupMembers = await prisma.groupMember.findMany({
      where: { groupId, userId: { not: null } }
    });
    const groupUserIds = groupMembers.map(m => m.userId);

    const allParticipantsInGroup = splits.every(s => groupUserIds.includes(s.userId));
    if (!allParticipantsInGroup) {
      return res.status(400).json({ error: 'One or more split participants are not members of this group.' });
    }

    // Verify payer is in group
    if (!groupUserIds.includes(paidById)) {
      return res.status(400).json({ error: 'The payer is not a member of this group.' });
    }

    let calculatedSplits = []; // Objects of { userId, amount, percentage, share }
    let totalSplitSum = 0;

    if (splitType === 'EQUAL') {
      const count = splits.length;
      const baseShare = Math.floor((amount / count) * 100) / 100;
      let remainder = parseFloat((amount - baseShare * count).toFixed(2));

      splits.forEach((split, index) => {
        let splitAmount = baseShare;
        // Allocate the remainder (cents) to the payer if they are in the split list, or the first person
        const isAllocatedPerson = paidById === split.userId ? true : (index === 0 && !splits.some(s => s.userId === paidById));
        
        if (isAllocatedPerson && remainder > 0.005) {
          splitAmount = parseFloat((splitAmount + remainder).toFixed(2));
          remainder = 0;
        }

        calculatedSplits.push({
          userId: split.userId,
          amount: splitAmount
        });
        totalSplitSum += splitAmount;
      });

      // If the remainder was not allocated because payer is not in split and we didn't hit index 0 trigger
      if (remainder > 0.005) {
        calculatedSplits[0].amount = parseFloat((calculatedSplits[0].amount + remainder).toFixed(2));
      }

    } else if (splitType === 'UNEQUAL') {
      // Validate that split amounts sum up to total amount
      let sumOfOwed = 0;
      splits.forEach(split => {
        const splitAmt = parseFloat(parseFloat(split.amount).toFixed(2));
        if (isNaN(splitAmt) || splitAmt < 0) {
          throw new Error('Unequal split amounts must be positive numbers.');
        }
        calculatedSplits.push({
          userId: split.userId,
          amount: splitAmt
        });
        sumOfOwed += splitAmt;
      });

      if (Math.abs(sumOfOwed - amount) > 0.01) {
        return res.status(400).json({ error: `The sum of unequal splits (${sumOfOwed.toFixed(2)}) must equal the total expense amount (${amount.toFixed(2)}).` });
      }

    } else if (splitType === 'PERCENTAGE') {
      // Validate percentages sum up to 100%
      let sumPct = 0;
      splits.forEach(split => {
        const pct = parseFloat(split.percentage);
        if (isNaN(pct) || pct < 0) {
          throw new Error('Percentages must be positive numbers.');
        }
        sumPct += pct;
      });

      if (Math.abs(sumPct - 100) > 0.01) {
        return res.status(400).json({ error: 'The sum of percentages must equal 100%.' });
      }

      let remainder = amount;
      splits.forEach((split, index) => {
        const pct = parseFloat(split.percentage);
        // Calculate raw split amount
        let splitAmt = Math.floor(((pct / 100) * amount) * 100) / 100;
        remainder = parseFloat((remainder - splitAmt).toFixed(2));

        calculatedSplits.push({
          userId: split.userId,
          amount: splitAmt,
          percentage: pct
        });
      });

      // Allocate the remaining pennies to the payer (or first participant)
      if (remainder > 0.005) {
        const payerSplitIdx = calculatedSplits.findIndex(s => s.userId === paidById);
        const targetIdx = payerSplitIdx !== -1 ? payerSplitIdx : 0;
        calculatedSplits[targetIdx].amount = parseFloat((calculatedSplits[targetIdx].amount + remainder).toFixed(2));
      }

    } else if (splitType === 'SHARE') {
      // Calculate share total
      let totalShares = 0;
      splits.forEach(split => {
        const share = parseFloat(split.share);
        if (isNaN(share) || share <= 0) {
          throw new Error('Shares must be positive numbers.');
        }
        totalShares += share;
      });

      if (totalShares <= 0) {
        return res.status(400).json({ error: 'Total shares must be greater than zero.' });
      }

      let remainder = amount;
      splits.forEach((split, index) => {
        const share = parseFloat(split.share);
        let splitAmt = Math.floor(((share / totalShares) * amount) * 100) / 100;
        remainder = parseFloat((remainder - splitAmt).toFixed(2));

        calculatedSplits.push({
          userId: split.userId,
          amount: splitAmt,
          share: share
        });
      });

      // Allocate remaining pennies to payer or first participant
      if (remainder > 0.005) {
        const payerSplitIdx = calculatedSplits.findIndex(s => s.userId === paidById);
        const targetIdx = payerSplitIdx !== -1 ? payerSplitIdx : 0;
        calculatedSplits[targetIdx].amount = parseFloat((calculatedSplits[targetIdx].amount + remainder).toFixed(2));
      }

    } else {
      return res.status(400).json({ error: 'Invalid split type. Must be EQUAL, UNEQUAL, PERCENTAGE, or SHARE.' });
    }

    // Database Write Transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create the Expense
      const expense = await tx.expense.create({
        data: {
          groupId,
          description,
          amount,
          paidById,
          splitType,
          category: finalCategory,
          receiptUrl: receiptUrl || null
        }
      });

      // 2. Create the splits records
      const splitCreateData = calculatedSplits.map(cs => ({
        expenseId: expense.id,
        userId: cs.userId,
        amount: cs.amount,
        percentage: cs.percentage || null,
        share: cs.share || null
      }));

      await tx.expenseSplit.createMany({
        data: splitCreateData
      });

      // Fetch the created expense with splits
      return await tx.expense.findUnique({
        where: { id: expense.id },
        include: {
          splits: {
            include: {
              user: {
                select: { id: true, name: true, email: true, avatarUrl: true }
              }
            }
          },
          paidBy: {
            select: { id: true, name: true, email: true, avatarUrl: true }
          }
        }
      });
    });

    // Fetch group currency
    const groupInfo = await prisma.group.findUnique({
      where: { id: groupId },
      select: { currency: true }
    });
    const currencySymbol = groupInfo ? groupInfo.currency : 'INR';

    // Log activity
    await logActivity(
      groupId,
      userId,
      'EXPENSE_CREATE',
      `${req.user.name} added the expense "${description}" of ${currencySymbol} ${amount.toFixed(2)}`
    );

    return res.status(201).json(result);
  } catch (error) {
    console.error('Create expense error:', error);
    return res.status(400).json({ error: error.message || 'Error occurred while creating expense.' });
  }
});

// GET /api/expenses/:id - Fetch details of a specific expense
router.get('/expenses/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const expense = await prisma.expense.findUnique({
      where: { id },
      include: {
        splits: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatarUrl: true }
            }
          }
        },
        paidBy: {
          select: { id: true, name: true, email: true, avatarUrl: true }
        },
        group: {
          include: {
            members: true
          }
        }
      }
    });

    if (!expense) {
      return res.status(404).json({ error: 'Expense not found.' });
    }

    // Verify user is group member
    const isMember = expense.group.members.some(m => m.userId === userId);
    if (!isMember) {
      return res.status(403).json({ error: 'Access denied. You are not a member of the group this expense belongs to.' });
    }

    return res.json(expense);
  } catch (error) {
    console.error('Fetch expense error:', error);
    return res.status(500).json({ error: 'Internal server error fetching expense.' });
  }
});

// DELETE /api/expenses/:id - Delete an expense
router.delete('/expenses/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Fetch expense to verify ownership/membership
    const expense = await prisma.expense.findUnique({
      where: { id },
      include: {
        group: {
          select: {
            id: true,
            currency: true,
            members: true
          }
        }
      }
    });

    if (!expense) {
      return res.status(404).json({ error: 'Expense not found.' });
    }

    // Verify user is group member
    const isMember = expense.group.members.some(m => m.userId === userId);
    if (!isMember) {
      return res.status(403).json({ error: 'Access denied. You are not a member of the group this expense belongs to.' });
    }

    const description = expense.description;
    const amount = expense.amount;
    const groupId = expense.groupId;
    const currency = expense.group.currency;

    // Delete the expense (cascade deletes splits and chats)
    await prisma.expense.delete({
      where: { id }
    });

    // Log activity
    await logActivity(
      groupId,
      userId,
      'EXPENSE_DELETE',
      `${req.user.name} deleted the expense "${description}" of ${currency} ${amount.toFixed(2)}`
    );

    return res.json({ success: true, message: 'Expense deleted successfully.' });
  } catch (error) {
    console.error('Delete expense error:', error);
    return res.status(500).json({ error: 'Internal server error deleting expense.' });
  }
});

// PUT /api/expenses/:id - Update an existing expense
router.put('/expenses/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { description, amount: rawAmount, paidById, splitType, splits, category, receiptUrl } = req.body;
    const userId = req.user.id;

    if (!description || !rawAmount || !paidById || !splitType || !splits || !Array.isArray(splits) || splits.length === 0) {
      return res.status(400).json({ error: 'Missing required expense details or split array.' });
    }

    const amount = parseFloat(parseFloat(rawAmount).toFixed(2));
    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Expense amount must be a positive number.' });
    }

    // Fetch existing expense to verify details
    const existingExpense = await prisma.expense.findUnique({
      where: { id },
      include: {
        group: {
          include: {
            members: true
          }
        }
      }
    });

    if (!existingExpense) {
      return res.status(404).json({ error: 'Expense not found.' });
    }

    const groupId = existingExpense.groupId;
    const currencySymbol = existingExpense.group.currency;

    // Verify user is group member
    const isMember = existingExpense.group.members.some(m => m.userId === userId);
    if (!isMember) {
      return res.status(403).json({ error: 'Access denied. You are not a member of the group this expense belongs to.' });
    }

    // Verify all split participants are registered group members
    const groupUserIds = existingExpense.group.members.map(m => m.userId).filter(id => id !== null);
    const allParticipantsInGroup = splits.every(s => groupUserIds.includes(s.userId));
    if (!allParticipantsInGroup) {
      return res.status(400).json({ error: 'One or more split participants are not members of this group.' });
    }

    // Verify payer is in group
    if (!groupUserIds.includes(paidById)) {
      return res.status(400).json({ error: 'The payer is not a member of this group.' });
    }

    const allowedCategories = ['Food', 'Travel', 'Shopping', 'Rent', 'Entertainment', 'Utilities', 'Others'];
    const finalCategory = allowedCategories.includes(category) ? category : 'Others';

    let calculatedSplits = [];
    let totalSplitSum = 0;

    if (splitType === 'EQUAL') {
      const count = splits.length;
      const baseShare = Math.floor((amount / count) * 100) / 100;
      let remainder = parseFloat((amount - baseShare * count).toFixed(2));

      splits.forEach((split, index) => {
        let splitAmount = baseShare;
        const isAllocatedPerson = paidById === split.userId ? true : (index === 0 && !splits.some(s => s.userId === paidById));
        if (isAllocatedPerson && remainder > 0.005) {
          splitAmount = parseFloat((splitAmount + remainder).toFixed(2));
          remainder = 0;
        }
        calculatedSplits.push({ userId: split.userId, amount: splitAmount });
        totalSplitSum += splitAmount;
      });
      if (remainder > 0.005) {
        calculatedSplits[0].amount = parseFloat((calculatedSplits[0].amount + remainder).toFixed(2));
      }
    } else if (splitType === 'UNEQUAL') {
      let sumOfOwed = 0;
      splits.forEach(split => {
        const splitAmt = parseFloat(parseFloat(split.amount).toFixed(2));
        if (isNaN(splitAmt) || splitAmt < 0) {
          throw new Error('Unequal split amounts must be positive numbers.');
        }
        calculatedSplits.push({ userId: split.userId, amount: splitAmt });
        sumOfOwed += splitAmt;
      });
      if (Math.abs(sumOfOwed - amount) > 0.01) {
        return res.status(400).json({ error: `The sum of unequal splits (${sumOfOwed.toFixed(2)}) must equal the total expense amount (${amount.toFixed(2)}).` });
      }
    } else if (splitType === 'PERCENTAGE') {
      let sumPct = 0;
      splits.forEach(split => {
        const pct = parseFloat(split.percentage);
        if (isNaN(pct) || pct < 0) {
          throw new Error('Percentages must be positive numbers.');
        }
        sumPct += pct;
      });
      if (Math.abs(sumPct - 100) > 0.01) {
        return res.status(400).json({ error: 'The sum of percentages must equal 100%.' });
      }
      let remainder = amount;
      splits.forEach((split, index) => {
        const pct = parseFloat(split.percentage);
        let splitAmt = Math.floor(((pct / 100) * amount) * 100) / 100;
        remainder = parseFloat((remainder - splitAmt).toFixed(2));
        calculatedSplits.push({ userId: split.userId, amount: splitAmt, percentage: pct });
      });
      if (remainder > 0.005) {
        const payerSplitIdx = calculatedSplits.findIndex(s => s.userId === paidById);
        const targetIdx = payerSplitIdx !== -1 ? payerSplitIdx : 0;
        calculatedSplits[targetIdx].amount = parseFloat((calculatedSplits[targetIdx].amount + remainder).toFixed(2));
      }
    } else if (splitType === 'SHARE') {
      let totalShares = 0;
      splits.forEach(split => {
        const share = parseFloat(split.share);
        if (isNaN(share) || share <= 0) {
          throw new Error('Shares must be positive numbers.');
        }
        totalShares += share;
      });
      if (totalShares <= 0) {
        return res.status(400).json({ error: 'Total shares must be greater than zero.' });
      }
      let remainder = amount;
      splits.forEach((split, index) => {
        const share = parseFloat(split.share);
        let splitAmt = Math.floor(((share / totalShares) * amount) * 100) / 100;
        remainder = parseFloat((remainder - splitAmt).toFixed(2));
        calculatedSplits.push({ userId: split.userId, amount: splitAmt, share: share });
      });
      if (remainder > 0.005) {
        const payerSplitIdx = calculatedSplits.findIndex(s => s.userId === paidById);
        const targetIdx = payerSplitIdx !== -1 ? payerSplitIdx : 0;
        calculatedSplits[targetIdx].amount = parseFloat((calculatedSplits[targetIdx].amount + remainder).toFixed(2));
      }
    } else {
      return res.status(400).json({ error: 'Invalid split type.' });
    }

    // Transaction to update database
    const result = await prisma.$transaction(async (tx) => {
      // 1. Delete old splits
      await tx.expenseSplit.deleteMany({
        where: { expenseId: id }
      });

      // 2. Update Expense details
      const updatedExpense = await tx.expense.update({
        where: { id },
        data: {
          description,
          amount,
          paidById,
          splitType,
          category: finalCategory,
          receiptUrl: receiptUrl !== undefined ? receiptUrl : existingExpense.receiptUrl
        }
      });

      // 3. Create new splits records
      const splitCreateData = calculatedSplits.map(cs => ({
        expenseId: id,
        userId: cs.userId,
        amount: cs.amount,
        percentage: cs.percentage || null,
        share: cs.share || null
      }));

      await tx.expenseSplit.createMany({
        data: splitCreateData
      });

      // Fetch the updated expense with splits
      return await tx.expense.findUnique({
        where: { id },
        include: {
          splits: {
            include: {
              user: {
                select: { id: true, name: true, email: true, avatarUrl: true }
              }
            }
          },
          paidBy: {
            select: { id: true, name: true, email: true, avatarUrl: true }
          }
        }
      });
    });

    // Log activity
    await logActivity(
      groupId,
      userId,
      'EXPENSE_EDIT',
      `${req.user.name} updated the expense "${description}" to ${currencySymbol} ${amount.toFixed(2)}`
    );

    return res.json(result);
  } catch (error) {
    console.error('Update expense error:', error);
    return res.status(400).json({ error: error.message || 'Error occurred while updating expense.' });
  }
});

module.exports = router;
