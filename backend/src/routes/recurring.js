const express = require('express');
const router = express.Router();
const prisma = require('../prisma');
const authMiddleware = require('../middleware/auth');
const { logActivity } = require('../utils/activityLogger');

router.use(authMiddleware);

// GET /api/groups/:groupId/recurring - List all recurring expenses in a group
router.get('/groups/:groupId/recurring', async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user.id;

    // Verify membership
    const membership = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: { groupId, userId }
      }
    });

    if (!membership) {
      return res.status(403).json({ error: 'Access denied. You are not a member of this group.' });
    }

    const recurring = await prisma.recurringExpense.findMany({
      where: { groupId },
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
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return res.json(recurring);
  } catch (error) {
    console.error('List recurring expenses error:', error);
    return res.status(500).json({ error: 'Internal server error listing recurring rules.' });
  }
});

// POST /api/groups/:groupId/recurring - Create a new recurring expense rule
router.post('/groups/:groupId/recurring', async (req, res) => {
  try {
    const { groupId } = req.params;
    const { description, amount: rawAmount, paidById, splitType, splits, category, interval } = req.body;
    const userId = req.user.id;

    if (!description || !rawAmount || !paidById || !splitType || !splits || !Array.isArray(splits) || splits.length === 0 || !interval) {
      return res.status(400).json({ error: 'Missing required recurring expense details.' });
    }

    const amount = parseFloat(parseFloat(rawAmount).toFixed(2));
    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Expense amount must be a positive number.' });
    }

    const allowedIntervals = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'];
    if (!allowedIntervals.includes(interval.toUpperCase())) {
      return res.status(400).json({ error: 'Invalid interval. Must be DAILY, WEEKLY, MONTHLY, or YEARLY.' });
    }

    // Verify membership
    const membership = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: { groupId, userId }
      }
    });
    if (!membership) {
      return res.status(403).json({ error: 'Access denied. You are not a member of this group.' });
    }

    // Verify participants are group members
    const groupMembers = await prisma.groupMember.findMany({
      where: { groupId, userId: { not: null } }
    });
    const groupUserIds = groupMembers.map(m => m.userId);
    const allParticipantsInGroup = splits.every(s => groupUserIds.includes(s.userId));
    if (!allParticipantsInGroup) {
      return res.status(400).json({ error: 'One or more split participants are not in this group.' });
    }

    // Verify payer is in group
    if (!groupUserIds.includes(paidById)) {
      return res.status(400).json({ error: 'The payer is not in this group.' });
    }

    // Split logic
    let calculatedSplits = [];
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
      });
      if (remainder > 0.005) {
        calculatedSplits[0].amount = parseFloat((calculatedSplits[0].amount + remainder).toFixed(2));
      }
    } else if (splitType === 'UNEQUAL') {
      let sumOfOwed = 0;
      splits.forEach(split => {
        const splitAmt = parseFloat(parseFloat(split.amount).toFixed(2));
        calculatedSplits.push({ userId: split.userId, amount: splitAmt });
        sumOfOwed += splitAmt;
      });
      if (Math.abs(sumOfOwed - amount) > 0.01) {
        return res.status(400).json({ error: 'The sum of unequal splits must equal the total amount.' });
      }
    } else if (splitType === 'PERCENTAGE') {
      let sumPct = 0;
      splits.forEach(split => {
        sumPct += parseFloat(split.percentage);
      });
      if (Math.abs(sumPct - 100) > 0.01) {
        return res.status(400).json({ error: 'The sum of percentages must equal 100%.' });
      }
      let remainder = amount;
      splits.forEach(split => {
        const pct = parseFloat(split.percentage);
        let splitAmt = Math.floor(((pct / 100) * amount) * 100) / 100;
        remainder = parseFloat((remainder - splitAmt).toFixed(2));
        calculatedSplits.push({ userId: split.userId, amount: splitAmt, percentage: pct });
      });
      if (remainder > 0.005) {
        const payerSplitIdx = calculatedSplits.findIndex(s => s.userId === paidById);
        calculatedSplits[payerSplitIdx !== -1 ? payerSplitIdx : 0].amount += remainder;
      }
    } else if (splitType === 'SHARE') {
      let totalShares = 0;
      splits.forEach(split => {
        totalShares += parseFloat(split.share);
      });
      let remainder = amount;
      splits.forEach(split => {
        const share = parseFloat(split.share);
        let splitAmt = Math.floor(((share / totalShares) * amount) * 100) / 100;
        remainder = parseFloat((remainder - splitAmt).toFixed(2));
        calculatedSplits.push({ userId: split.userId, amount: splitAmt, share });
      });
      if (remainder > 0.005) {
        const payerSplitIdx = calculatedSplits.findIndex(s => s.userId === paidById);
        calculatedSplits[payerSplitIdx !== -1 ? payerSplitIdx : 0].amount += remainder;
      }
    }

    const allowedCategories = ['Food', 'Travel', 'Shopping', 'Rent', 'Entertainment', 'Utilities', 'Others'];
    const finalCategory = allowedCategories.includes(category) ? category : 'Others';

    // Set first trigger time to now (triggers immediately)
    const nextTriggerAt = new Date();

    const recurringRule = await prisma.$transaction(async (tx) => {
      const rule = await tx.recurringExpense.create({
        data: {
          groupId,
          description,
          amount,
          paidById,
          splitType,
          category: finalCategory,
          interval: interval.toUpperCase(),
          status: 'ACTIVE',
          nextTriggerAt
        }
      });

      const splitsData = calculatedSplits.map(cs => ({
        recurringExpenseId: rule.id,
        userId: cs.userId,
        amount: cs.amount,
        percentage: cs.percentage || null,
        share: cs.share || null
      }));

      await tx.recurringExpenseSplit.createMany({
        data: splitsData
      });

      return await tx.recurringExpense.findUnique({
        where: { id: rule.id },
        include: { splits: true }
      });
    });

    // Log activity
    await logActivity(
      groupId,
      userId,
      'EXPENSE_CREATE',
      `${req.user.name} created a recurring expense rule: "${description}" (${interval.toLowerCase()})`
    );

    return res.status(201).json(recurringRule);
  } catch (error) {
    console.error('Create recurring expense error:', error);
    return res.status(400).json({ error: error.message || 'Error occurred while creating recurring rule.' });
  }
});

// PUT /api/recurring/:id - Update or pause/resume a recurring expense rule
router.put('/recurring/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, description, amount: rawAmount, paidById, splitType, splits, category, interval } = req.body;
    const userId = req.user.id;

    const existingRule = await prisma.recurringExpense.findUnique({
      where: { id },
      include: {
        group: {
          include: { members: true }
        }
      }
    });

    if (!existingRule) {
      return res.status(404).json({ error: 'Recurring rule not found.' });
    }

    // Verify membership
    const isMember = existingRule.group.members.some(m => m.userId === userId);
    if (!isMember) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    // If only updating status (PAUSED / ACTIVE)
    if (status !== undefined && !description) {
      if (status !== 'ACTIVE' && status !== 'PAUSED') {
        return res.status(400).json({ error: 'Invalid status. Must be ACTIVE or PAUSED.' });
      }

      await prisma.recurringExpense.update({
        where: { id },
        data: { status }
      });

      // Log activity
      await logActivity(
        existingRule.groupId,
        userId,
        'EXPENSE_EDIT',
        `${req.user.name} ${status === 'PAUSED' ? 'paused' : 'resumed'} the recurring expense rule: "${existingRule.description}"`
      );

      return res.json({ success: true, status });
    }

    // Full edit logic
    const amount = parseFloat(parseFloat(rawAmount).toFixed(2));
    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Amount must be positive.' });
    }

    // Split logic (same)
    let calculatedSplits = [];
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
      });
      if (remainder > 0.005) {
        calculatedSplits[0].amount = parseFloat((calculatedSplits[0].amount + remainder).toFixed(2));
      }
    } else if (splitType === 'UNEQUAL') {
      let sumOfOwed = 0;
      splits.forEach(split => {
        const splitAmt = parseFloat(parseFloat(split.amount).toFixed(2));
        calculatedSplits.push({ userId: split.userId, amount: splitAmt });
        sumOfOwed += splitAmt;
      });
      if (Math.abs(sumOfOwed - amount) > 0.01) {
        return res.status(400).json({ error: 'Sum of splits must equal total.' });
      }
    } else if (splitType === 'PERCENTAGE') {
      let sumPct = 0;
      splits.forEach(split => {
        sumPct += parseFloat(split.percentage);
      });
      if (Math.abs(sumPct - 100) > 0.01) {
        return res.status(400).json({ error: 'Sum of percentages must equal 100.' });
      }
      let remainder = amount;
      splits.forEach(split => {
        const pct = parseFloat(split.percentage);
        let splitAmt = Math.floor(((pct / 100) * amount) * 100) / 100;
        remainder = parseFloat((remainder - splitAmt).toFixed(2));
        calculatedSplits.push({ userId: split.userId, amount: splitAmt, percentage: pct });
      });
      if (remainder > 0.005) {
        const payerSplitIdx = calculatedSplits.findIndex(s => s.userId === paidById);
        calculatedSplits[payerSplitIdx !== -1 ? payerSplitIdx : 0].amount += remainder;
      }
    }

    const allowedCategories = ['Food', 'Travel', 'Shopping', 'Rent', 'Entertainment', 'Utilities', 'Others'];
    const finalCategory = allowedCategories.includes(category) ? category : 'Others';

    const updated = await prisma.$transaction(async (tx) => {
      await tx.recurringExpenseSplit.deleteMany({
        where: { recurringExpenseId: id }
      });

      const updatedRule = await tx.recurringExpense.update({
        where: { id },
        data: {
          description,
          amount,
          paidById,
          splitType,
          category: finalCategory,
          interval: interval.toUpperCase()
        }
      });

      const splitsData = calculatedSplits.map(cs => ({
        recurringExpenseId: id,
        userId: cs.userId,
        amount: cs.amount,
        percentage: cs.percentage || null,
        share: cs.share || null
      }));

      await tx.recurringExpenseSplit.createMany({
        data: splitsData
      });

      return updatedRule;
    });

    // Log activity
    await logActivity(
      existingRule.groupId,
      userId,
      'EXPENSE_EDIT',
      `${req.user.name} updated the recurring expense rule: "${description}"`
    );

    return res.json(updated);
  } catch (error) {
    console.error('Update recurring expense error:', error);
    return res.status(400).json({ error: error.message || 'Error occurred.' });
  }
});

// DELETE /api/recurring/:id - Delete a recurring expense rule
router.delete('/recurring/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const existingRule = await prisma.recurringExpense.findUnique({
      where: { id },
      include: {
        group: {
          include: { members: true }
        }
      }
    });

    if (!existingRule) {
      return res.status(404).json({ error: 'Recurring rule not found.' });
    }

    // Verify membership
    const isMember = existingRule.group.members.some(m => m.userId === userId);
    if (!isMember) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const description = existingRule.description;
    const groupId = existingRule.groupId;

    await prisma.recurringExpense.delete({
      where: { id }
    });

    // Log activity
    await logActivity(
      groupId,
      userId,
      'EXPENSE_DELETE',
      `${req.user.name} deleted the recurring expense rule: "${description}"`
    );

    return res.json({ success: true, message: 'Recurring rule deleted successfully.' });
  } catch (error) {
    console.error('Delete recurring error:', error);
    return res.status(500).json({ error: 'Internal server error deleting recurring rule.' });
  }
});

module.exports = router;
