const express = require('express');
const router = express.Router();
const prisma = require('../prisma');
const authMiddleware = require('../middleware/auth');

// Apply auth middleware to all message routes
router.use(authMiddleware);

// GET /api/expenses/:expenseId/messages - Get persistent chat history for an expense
router.get('/expenses/:expenseId/messages', async (req, res) => {
  try {
    const { expenseId } = req.params;
    const userId = req.user.id;

    // Verify expense exists and user is group member
    const expense = await prisma.expense.findUnique({
      where: { id: expenseId },
      include: {
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

    const isMember = expense.group.members.some(m => m.userId === userId);
    if (!isMember) {
      return res.status(403).json({ error: 'Access denied. You are not a member of the group this expense belongs to.' });
    }

    // Fetch messages in chronological order
    const messages = await prisma.message.findMany({
      where: { expenseId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true
          }
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    return res.json(messages);
  } catch (error) {
    console.error('Fetch messages error:', error);
    return res.status(500).json({ error: 'Internal server error fetching chat messages.' });
  }
});

module.exports = router;
