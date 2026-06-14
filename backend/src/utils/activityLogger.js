const prisma = require('../prisma');

/**
 * Log an activity to the database activity timeline.
 * @param {string} groupId - ID of the group the activity belongs to
 * @param {string} actorId - ID of the user performing the action
 * @param {string} type - Action type (GROUP_CREATE, MEMBER_ADD, MEMBER_REMOVE, EXPENSE_CREATE, EXPENSE_EDIT, EXPENSE_DELETE, SETTLEMENT, COMMENT)
 * @param {string} description - Human-readable detail description of the action
 */
async function logActivity(groupId, actorId, type, description) {
  try {
    const activity = await prisma.activity.create({
      data: {
        groupId,
        actorId,
        type,
        description
      }
    });
    return activity;
  } catch (error) {
    console.error('Error logging activity:', error);
  }
}

module.exports = { logActivity };
