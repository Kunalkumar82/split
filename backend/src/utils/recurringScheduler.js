const prisma = require('../prisma');

// Helper to advance the trigger date
function getNextTriggerDate(currentDate, interval) {
  const next = new Date(currentDate);
  if (interval === 'DAILY') {
    next.setDate(next.getDate() + 1);
  } else if (interval === 'WEEKLY') {
    next.setDate(next.getDate() + 7);
  } else if (interval === 'MONTHLY') {
    next.setMonth(next.getMonth() + 1);
  } else if (interval === 'YEARLY') {
    next.setFullYear(next.getFullYear() + 1);
  }
  return next;
}

async function checkRecurringExpenses() {
  try {
    const now = new Date();
    
    // Find all ACTIVE recurring expenses whose nextTriggerAt is in the past or present
    const dueRecurring = await prisma.recurringExpense.findMany({
      where: {
        status: 'ACTIVE',
        nextTriggerAt: {
          lte: now
        }
      },
      include: {
        splits: true,
        group: true
      }
    });

    if (dueRecurring.length === 0) return;
    
    console.log(`[Scheduler] Found ${dueRecurring.length} due recurring expenses to process.`);

    for (const rule of dueRecurring) {
      let currentTrigger = new Date(rule.nextTriggerAt);
      
      // Process all due instances (handling catchup if server was offline)
      while (currentTrigger <= now) {
        console.log(`[Scheduler] Triggering recurring expense: "${rule.description}" for rule ID: ${rule.id}`);
        
        await prisma.$transaction(async (tx) => {
          // 1. Create normal expense
          const expense = await tx.expense.create({
            data: {
              groupId: rule.groupId,
              description: `${rule.description} (Recurring)`,
              amount: rule.amount,
              paidById: rule.paidById,
              splitType: rule.splitType,
              category: rule.category,
              createdAt: currentTrigger // Keep the original due time
            }
          });

          // 2. Create Splits
          const splitCreateData = rule.splits.map(cs => ({
            expenseId: expense.id,
            userId: cs.userId,
            amount: cs.amount,
            percentage: cs.percentage,
            share: cs.share
          }));

          await tx.expenseSplit.createMany({
            data: splitCreateData
          });

          // 3. Log Activity
          await tx.activity.create({
            data: {
              groupId: rule.groupId,
              actorId: rule.paidById,
              type: 'EXPENSE_CREATE',
              description: `[Recurring] Added expense "${rule.description}" of ${rule.group.currency} ${rule.amount.toFixed(2)}`
            }
          });
        });

        // Advance the trigger date
        currentTrigger = getNextTriggerDate(currentTrigger, rule.interval);
      }

      // Update nextTriggerAt in DB
      await prisma.recurringExpense.update({
        where: { id: rule.id },
        data: {
          nextTriggerAt: currentTrigger
        }
      });
    }
  } catch (error) {
    console.error('[Scheduler] Error processing recurring expenses:', error);
  }
}

function startRecurringScheduler() {
  // Check immediately on startup
  checkRecurringExpenses();
  
  // Set interval to check every 10 minutes
  const intervalMs = 10 * 60 * 1000;
  setInterval(checkRecurringExpenses, intervalMs);
  console.log('[Scheduler] Recurring expense scheduler started (polling every 10 minutes).');
}

module.exports = {
  checkRecurringExpenses,
  startRecurringScheduler
};
