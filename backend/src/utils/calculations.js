/**
 * Calculate net balances and simplify debts within a group.
 * @param {Array} members - List of group members (each containing user details)
 * @param {Array} expenses - List of group expenses (each containing splits and paidById)
 * @param {Array} settlements - List of settlements (each containing payerId, payeeId, amount)
 */
function calculateGroupBalances(members, expenses, settlements) {
  // 1. Initialize balances map for all registered members
  const memberBalances = {}; // userId -> net balance
  const userMap = {}; // userId -> user profile details

  members.forEach(m => {
    if (m.user) {
      memberBalances[m.user.id] = 0;
      userMap[m.user.id] = {
        id: m.user.id,
        name: m.user.name,
        email: m.user.email,
        avatarUrl: m.user.avatarUrl
      };
    }
  });

  // 2. Process Expenses
  expenses.forEach(expense => {
    const payerId = expense.paidById;
    
    // Add full amount paid to payer's balance
    if (memberBalances[payerId] !== undefined) {
      memberBalances[payerId] += expense.amount;
    }

    // Subtract owed amounts from split participants
    expense.splits.forEach(split => {
      const debtorId = split.userId;
      if (memberBalances[debtorId] !== undefined) {
        memberBalances[debtorId] -= split.amount;
      }
    });
  });

  // 3. Process Settlements
  settlements.forEach(settlement => {
    const payerId = settlement.payerId; // Sender
    const payeeId = settlement.payeeId; // Receiver
    const amount = settlement.amount;

    if (memberBalances[payerId] !== undefined) {
      memberBalances[payerId] += amount; // Sending money increases net balance (closer to zero if negative)
    }
    if (memberBalances[payeeId] !== undefined) {
      memberBalances[payeeId] -= amount; // Receiving money decreases net balance (closer to zero if positive)
    }
  });

  // 4. Calculate Pairwise Debts (Who owes whom directly, netted)
  // We initialize a 2D map of debts: debts[A][B] is how much A owes B
  const debts = {};
  Object.keys(memberBalances).forEach(u1 => {
    debts[u1] = {};
    Object.keys(memberBalances).forEach(u2 => {
      debts[u1][u2] = 0;
    });
  });

  // Add debts from expenses
  expenses.forEach(expense => {
    const payerId = expense.paidById;
    expense.splits.forEach(split => {
      const debtorId = split.userId;
      if (debtorId !== payerId) {
        debts[debtorId][payerId] += split.amount;
      }
    });
  });

  // Subtract settlements from debts
  settlements.forEach(settlement => {
    const payerId = settlement.payerId; // Sender of money (debtor)
    const payeeId = settlement.payeeId; // Receiver of money (creditor)
    const amount = settlement.amount;
    
    // Payer paying payee reduces the debt payer owes payee
    debts[payerId][payeeId] -= amount;
  });

  // Net pairwise debts (if A owes B $10 and B owes A $4, then A owes B $6)
  const directDebts = [];
  const keys = Object.keys(memberBalances);
  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      const u1 = keys[i];
      const u2 = keys[j];
      
      const u1OwesU2 = debts[u1][u2];
      const u2OwesU1 = debts[u2][u1];
      const net = u1OwesU2 - u2OwesU1;

      if (net > 0.005) { // Threshold to avoid floating-point issues
        directDebts.push({
          from: userMap[u1],
          to: userMap[u2],
          amount: parseFloat(net.toFixed(2))
        });
      } else if (net < -0.005) {
        directDebts.push({
          from: userMap[u2],
          to: userMap[u1],
          amount: parseFloat((-net).toFixed(2))
        });
      }
    }
  }

  // 5. Greedy Debt Simplification
  // Match debtors (negative balances) with creditors (positive balances)
  const simplifiedDebts = [];
  const debtors = [];
  const creditors = [];

  Object.keys(memberBalances).forEach(userId => {
    const bal = parseFloat(memberBalances[userId].toFixed(2));
    if (bal < -0.005) {
      debtors.push({ userId, balance: bal });
    } else if (bal > 0.005) {
      creditors.push({ userId, balance: bal });
    }
  });

  // Sort debtors (most negative first) and creditors (most positive first)
  debtors.sort((a, b) => a.balance - b.balance);
  creditors.sort((a, b) => b.balance - a.balance);

  let dIdx = 0;
  let cIdx = 0;

  while (dIdx < debtors.length && cIdx < creditors.length) {
    const debtor = debtors[dIdx];
    const creditor = creditors[cIdx];

    const amountToSettle = Math.min(-debtor.balance, creditor.balance);
    
    if (amountToSettle > 0.005) {
      simplifiedDebts.push({
        from: userMap[debtor.userId],
        to: userMap[creditor.userId],
        amount: parseFloat(amountToSettle.toFixed(2))
      });
    }

    debtor.balance += amountToSettle;
    creditor.balance -= amountToSettle;

    if (Math.abs(debtor.balance) < 0.005) {
      dIdx++;
    }
    if (Math.abs(creditor.balance) < 0.005) {
      cIdx++;
    }
  }

  // Format balances list for the response
  const formattedBalances = Object.keys(memberBalances).map(userId => ({
    user: userMap[userId],
    balance: parseFloat(memberBalances[userId].toFixed(2))
  }));

  return {
    balances: formattedBalances,
    directDebts,
    simplifiedDebts
  };
}

module.exports = {
  calculateGroupBalances
};
