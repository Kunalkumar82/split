const express = require('express');
const router = express.Router();
const prisma = require('../prisma');
const authMiddleware = require('../middleware/auth');
const { calculateGroupBalances } = require('../utils/calculations');
const { logActivity } = require('../utils/activityLogger');

// Apply auth middleware to all group routes
router.use(authMiddleware);

// GET /api/groups - List all groups current user is part of
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;

    // Find all group memberships for this user
    const memberships = await prisma.groupMember.findMany({
      where: { userId },
      include: {
        group: {
          include: {
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    avatarUrl: true
                  }
                }
              }
            }
          }
        }
      }
    });

    const groups = [];
    for (const membership of memberships) {
      // Fetch details needed to compute balance
      const groupData = await prisma.group.findUnique({
        where: { id: membership.groupId },
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
        
        groups.push({
          id: groupData.id,
          name: groupData.name,
          description: groupData.description,
          currency: groupData.currency,
          createdById: groupData.createdById,
          createdAt: groupData.createdAt,
          members: groupData.members,
          userBalance: userBalanceRecord ? userBalanceRecord.balance : 0
        });
      }
    }

    return res.json(groups);
  } catch (error) {
    console.error('List groups error:', error);
    return res.status(500).json({ error: 'Internal server error listing groups.' });
  }
});

// POST /api/groups - Create a new group
router.post('/', async (req, res) => {
  try {
    const { name, description, currency } = req.body;
    const userId = req.user.id;

    if (!name) {
      return res.status(400).json({ error: 'Please provide a group name.' });
    }

    // Create the group and add the creator as the first member
    const group = await prisma.group.create({
      data: {
        name,
        description: description || null,
        currency: currency || 'INR',
        createdById: userId,
        members: {
          create: {
            userId: userId,
            joinedAt: new Date()
          }
        }
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true
              }
            }
          }
        }
      }
    });

    // Log activity
    await logActivity(group.id, userId, 'GROUP_CREATE', `${req.user.name} created the group "${name}"`);

    return res.status(201).json(group);
  } catch (error) {
    console.error('Create group error:', error);
    return res.status(500).json({ error: 'Internal server error creating group.' });
  }
});

// GET /api/groups/:id - Get details of a specific group
router.get('/:id', async (req, res) => {
  try {
    const groupId = req.params.id;
    const userId = req.user.id;

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

    // Fetch group details, members, expenses, splits, and settlements
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true
              }
            }
          }
        },
        expenses: {
          include: {
            splits: true,
            paidBy: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        },
        settlements: {
          include: {
            payer: {
              select: { id: true, name: true, email: true, avatarUrl: true }
            },
            payee: {
              select: { id: true, name: true, email: true, avatarUrl: true }
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    });

    if (!group) {
      return res.status(404).json({ error: 'Group not found.' });
    }

    // Calculate balances, direct debts, and simplified debts
    const calculations = calculateGroupBalances(group.members, group.expenses, group.settlements);

    return res.json({
      ...group,
      balances: calculations.balances,
      directDebts: calculations.directDebts,
      simplifiedDebts: calculations.simplifiedDebts
    });
  } catch (error) {
    console.error('Fetch group details error:', error);
    return res.status(500).json({ error: 'Internal server error fetching group.' });
  }
});

// POST /api/groups/:id/members - Invite a member by email
router.post('/:id/members', async (req, res) => {
  try {
    const groupId = req.params.id;
    const { email } = req.body;
    const currentUserId = req.user.id;

    if (!email) {
      return res.status(400).json({ error: 'Please provide an email address.' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Verify current user is member of the group
    const currentMember = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId: currentUserId
        }
      }
    });

    if (!currentMember) {
      return res.status(403).json({ error: 'Access denied. You are not a member of this group.' });
    }

    // Check if the user is already a member
    // A member can be added by registered userId or inviteEmail
    const existingMembers = await prisma.groupMember.findMany({
      where: { groupId }
    });

    // Check if user is already a member of the group
    const isAlreadyMember = existingMembers.some(m => {
      if (m.inviteEmail && m.inviteEmail === normalizedEmail) return true;
      return false;
    });

    // Find if user is registered in the system
    const targetUser = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });

    if (targetUser) {
      // Check if user is already added via userId
      const userAlreadyAdded = existingMembers.some(m => m.userId === targetUser.id);
      if (userAlreadyAdded || isAlreadyMember) {
        return res.status(400).json({ error: 'User is already a member of this group.' });
      }

      // Add user directly since they are already registered
      const newMember = await prisma.groupMember.create({
        data: {
          groupId,
          userId: targetUser.id,
          joinedAt: new Date()
        },
        include: {
          user: {
            select: { id: true, name: true, email: true, avatarUrl: true }
          }
        }
      });
      // Log activity
      await logActivity(groupId, currentUserId, 'MEMBER_ADD', `${req.user.name} added ${targetUser.name} to the group`);

      return res.status(201).json(newMember);
    } else {
      // User is not registered in the system yet. Add as a pending invite.
      if (isAlreadyMember) {
        return res.status(400).json({ error: 'This email has already been invited.' });
      }

      const pendingMember = await prisma.groupMember.create({
        data: {
          groupId,
          inviteEmail: normalizedEmail,
          userId: null,
          joinedAt: null
        }
      });

      // Log activity
      await logActivity(groupId, currentUserId, 'MEMBER_ADD', `${req.user.name} invited ${normalizedEmail} to the group`);

      return res.status(201).json(pendingMember);
    }
  } catch (error) {
    console.error('Add group member error:', error);
    return res.status(500).json({ error: 'Internal server error adding member.' });
  }
});

// DELETE /api/groups/:id/members/:userId - Remove a member from the group
router.delete('/:id/members/:userId', async (req, res) => {
  try {
    const groupId = req.params.id;
    const targetUserId = req.params.userId;
    const currentUserId = req.user.id;

    // Verify current user is member of the group
    const currentMember = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId: currentUserId
        }
      }
    });

    if (!currentMember) {
      return res.status(403).json({ error: 'Access denied. You are not a member of this group.' });
    }

    // Verify target user is in the group
    const targetMember = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId: targetUserId
        }
      }
    });

    if (!targetMember) {
      return res.status(404).json({ error: 'Member not found in this group.' });
    }

    // Fetch all group components to compute balances
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        members: { include: { user: true } },
        expenses: { include: { splits: true } },
        settlements: true
      }
    });

    // Compute balances
    const calculations = calculateGroupBalances(group.members, group.expenses, group.settlements);
    const userBalanceRecord = calculations.balances.find(b => b.user.id === targetUserId);

    const balance = userBalanceRecord ? userBalanceRecord.balance : 0;

    if (Math.abs(balance) > 0.005) {
      return res.status(400).json({
        error: `Cannot remove member. ${userBalanceRecord.user.name} has a non-zero net balance of ${balance.toFixed(2)} in this group.`
      });
    }

    // Check if the user is referenced in splits or payments
    // If the user has transactions, we should check if they can be deleted safely.
    // In our Prisma schema, we delete group memberships. If there are splits linked to them, they will keep referencing user_id. 
    // In our schema, we cascade delete GroupMember on group delete, but we keep ExpenseSplit which references User directly.
    // So removing a user from the GroupMember table is safe because ExpenseSplit references User.id, not GroupMember.id.
    // Let's delete the GroupMember record.
    // Fetch target member details to get their name before deleting
    const targetMemberDetail = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { name: true }
    });
    const targetName = targetMemberDetail ? targetMemberDetail.name : (targetMember.inviteEmail || 'Pending Member');

    // Let's delete the GroupMember record.
    await prisma.groupMember.delete({
      where: {
        groupId_userId: {
          groupId,
          userId: targetUserId
        }
      }
    });

    // Log activity
    await logActivity(groupId, currentUserId, 'MEMBER_REMOVE', `${req.user.name} removed ${targetName} from the group`);

    return res.json({ success: true, message: 'Member removed successfully.' });
  } catch (error) {
    console.error('Remove member error:', error);
    return res.status(500).json({ error: 'Internal server error removing member.' });
  }
});

// GET /api/groups/:id/activities - Fetch activity feed for a specific group
router.get('/:id/activities', async (req, res) => {
  try {
    const groupId = req.params.id;
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

    const activities = await prisma.activity.findMany({
      where: { groupId },
      include: {
        actor: {
          select: { id: true, name: true, avatarUrl: true }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return res.json(activities);
  } catch (error) {
    console.error('Fetch group activities error:', error);
    return res.status(500).json({ error: 'Internal server error fetching group activities.' });
  }
});

// PUT /api/groups/:id/budget - Set or update the group budget
router.put('/:id/budget', async (req, res) => {
  try {
    const groupId = req.params.id;
    const { budget: rawBudget } = req.body;
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

    const budget = rawBudget === null || rawBudget === '' ? null : parseFloat(rawBudget);
    if (budget !== null && (isNaN(budget) || budget < 0)) {
      return res.status(400).json({ error: 'Budget must be a non-negative number.' });
    }

    const updatedGroup = await prisma.group.update({
      where: { id: groupId },
      data: { budget },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatarUrl: true }
            }
          }
        }
      }
    });

    // Log activity
    await logActivity(
      groupId,
      userId,
      'GROUP_EDIT',
      `${req.user.name} updated group budget to ${updatedGroup.currency} ${budget !== null ? budget.toFixed(2) : 'unlimited'}`
    );

    return res.json(updatedGroup);
  } catch (error) {
    console.error('Update group budget error:', error);
    return res.status(500).json({ error: 'Internal server error updating group budget.' });
  }
});

module.exports = router;
