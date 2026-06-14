const express = require('express');
const router = express.Router();
const prisma = require('../prisma');
const authMiddleware = require('../middleware/auth');
const { logActivity } = require('../utils/activityLogger');

// Apply auth middleware to all settlement routes
router.use(authMiddleware);

// POST /api/groups/:groupId/settlements - Record a settlement payment between two users
router.post('/groups/:groupId/settlements', async (req, res) => {
  try {
    const { groupId } = req.params;
    const { payerId, payeeId, amount: rawAmount } = req.body;
    const userId = req.user.id;

    if (!payerId || !payeeId || !rawAmount) {
      return res.status(400).json({ error: 'Missing required settlement details (payerId, payeeId, amount).' });
    }

    const amount = parseFloat(parseFloat(rawAmount).toFixed(2));
    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Settlement amount must be a positive number.' });
    }

    // Verify current user is group member
    const currentMember = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId
        }
      }
    });

    if (!currentMember) {
      return res.status(403).json({ error: 'Access denied. You are not a member of this group.' });
    }

    // Verify payer and payee are members of the group
    const groupMembers = await prisma.groupMember.findMany({
      where: { groupId, userId: { not: null } }
    });
    const groupUserIds = groupMembers.map(m => m.userId);

    if (!groupUserIds.includes(payerId) || !groupUserIds.includes(payeeId)) {
      return res.status(400).json({ error: 'Payer and Payee must both be members of the group.' });
    }

    if (payerId === payeeId) {
      return res.status(400).json({ error: 'Cannot settle a debt with yourself.' });
    }

    // Record the settlement
    const settlement = await prisma.settlement.create({
      data: {
        groupId,
        payerId,
        payeeId,
        amount
      },
      include: {
        payer: {
          select: { id: true, name: true, email: true, avatarUrl: true }
        },
        payee: {
          select: { id: true, name: true, email: true, avatarUrl: true }
        }
      }
    });

    // Fetch group details to get currency symbol
    const groupInfo = await prisma.group.findUnique({
      where: { id: groupId },
      select: { currency: true }
    });
    const currencySymbol = groupInfo ? groupInfo.currency : 'INR';

    // Log activity
    await logActivity(
      groupId,
      userId,
      'SETTLEMENT',
      `${settlement.payer.name} paid ${settlement.payee.name} ${currencySymbol} ${amount.toFixed(2)}`
    );

    return res.status(201).json(settlement);
  } catch (error) {
    console.error('Record settlement error:', error);
    return res.status(500).json({ error: 'Internal server error recording settlement.' });
  }
});

module.exports = router;
