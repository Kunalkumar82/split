const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seeding...');

  // 1. Clean existing database records (in order of dependencies)
  console.log('Clearing old data...');
  await prisma.message.deleteMany({});
  await prisma.settlement.deleteMany({});
  await prisma.expenseSplit.deleteMany({});
  await prisma.expense.deleteMany({});
  await prisma.groupMember.deleteMany({});
  await prisma.group.deleteMany({});
  await prisma.user.deleteMany({});

  // 2. Create sample users (all Indian names)
  console.log('Creating users...');
  const salt = await bcrypt.genSalt(10);
  const defaultPasswordHash = await bcrypt.hash('password123', salt);

  const users = {
    aarav: await prisma.user.create({
      data: {
        email: 'aarav@example.com',
        name: 'Aarav Sharma',
        passwordHash: defaultPasswordHash,
        avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150'
      }
    }),
    amit: await prisma.user.create({
      data: {
        email: 'amit@example.com',
        name: 'Amit Patel',
        passwordHash: defaultPasswordHash,
        avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150'
      }
    }),
    chirag: await prisma.user.create({
      data: {
        email: 'chirag@example.com',
        name: 'Chirag Mehta',
        passwordHash: defaultPasswordHash,
        avatarUrl: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150'
      }
    }),
    devendra: await prisma.user.create({
      data: {
        email: 'devendra@example.com',
        name: 'Devendra Kumar',
        passwordHash: defaultPasswordHash,
        avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'
      }
    })
  };

  console.log(`Created ${Object.keys(users).length} sample users.`);

  // 3. Create groups (Indian themes and INR currency)
  console.log('Creating groups...');
  
  // Group 1: Flatmates Mumbai
  const flatmatesGroup = await prisma.group.create({
    data: {
      name: 'Flatmates Mumbai',
      description: 'Shared house expenses for Apartment 302',
      currency: 'INR',
      createdById: users.aarav.id
    }
  });

  // Add members to Group 1
  await prisma.groupMember.createMany({
    data: [
      { groupId: flatmatesGroup.id, userId: users.aarav.id, joinedAt: new Date() },
      { groupId: flatmatesGroup.id, userId: users.amit.id, joinedAt: new Date() },
      { groupId: flatmatesGroup.id, userId: users.chirag.id, joinedAt: new Date() }
    ]
  });

  // Group 2: Manali Trip 2026
  const manaliTripGroup = await prisma.group.create({
    data: {
      name: 'Manali Trip 2026',
      description: 'Annual vacation trip in Manali',
      currency: 'INR',
      createdById: users.aarav.id
    }
  });

  // Add members to Group 2
  await prisma.groupMember.createMany({
    data: [
      { groupId: manaliTripGroup.id, userId: users.aarav.id, joinedAt: new Date() },
      { groupId: manaliTripGroup.id, userId: users.amit.id, joinedAt: new Date() },
      { groupId: manaliTripGroup.id, userId: users.chirag.id, joinedAt: new Date() },
      { groupId: manaliTripGroup.id, userId: users.devendra.id, joinedAt: new Date() }
    ]
  });

  console.log('Created groups and group memberships.');

  // 4. Create expenses and splits (in Indian Rupees)
  console.log('Creating expenses...');

  // Expense 1: House Rent (₹45000, paid by Aarav, split equally)
  const rentExpense = await prisma.expense.create({
    data: {
      groupId: flatmatesGroup.id,
      description: 'Monthly Flat Rent',
      amount: 45000.0,
      paidById: users.aarav.id,
      splitType: 'EQUAL'
    }
  });
  await prisma.expenseSplit.createMany({
    data: [
      { expenseId: rentExpense.id, userId: users.aarav.id, amount: 15000.0 },
      { expenseId: rentExpense.id, userId: users.amit.id, amount: 15000.0 },
      { expenseId: rentExpense.id, userId: users.chirag.id, amount: 15000.0 }
    ]
  });

  // Expense 2: Groceries (₹3000, paid by Amit, split equally)
  const groceriesExpense = await prisma.expense.create({
    data: {
      groupId: flatmatesGroup.id,
      description: 'Weekly Groceries',
      amount: 3000.0,
      paidById: users.amit.id,
      splitType: 'EQUAL'
    }
  });
  await prisma.expenseSplit.createMany({
    data: [
      { expenseId: groceriesExpense.id, userId: users.aarav.id, amount: 1000.0 },
      { expenseId: groceriesExpense.id, userId: users.amit.id, amount: 1000.0 },
      { expenseId: groceriesExpense.id, userId: users.chirag.id, amount: 1000.0 }
    ]
  });

  // Expense 3: Villa Booking (₹24000, paid by Aarav, split equally)
  const cabinExpense = await prisma.expense.create({
    data: {
      groupId: manaliTripGroup.id,
      description: 'Manali Resort Booking',
      amount: 24000.0,
      paidById: users.aarav.id,
      splitType: 'EQUAL'
    }
  });
  await prisma.expenseSplit.createMany({
    data: [
      { expenseId: cabinExpense.id, userId: users.aarav.id, amount: 6000.0 },
      { expenseId: cabinExpense.id, userId: users.amit.id, amount: 6000.0 },
      { expenseId: cabinExpense.id, userId: users.chirag.id, amount: 6000.0 },
      { expenseId: cabinExpense.id, userId: users.devendra.id, amount: 6000.0 }
    ]
  });

  // Expense 4: Adventure Sports (₹10800, paid by Devendra, split equally)
  const liftTicketsExpense = await prisma.expense.create({
    data: {
      groupId: manaliTripGroup.id,
      description: 'Adventure Sports & Paragliding',
      amount: 10800.0,
      paidById: users.devendra.id,
      splitType: 'EQUAL'
    }
  });
  await prisma.expenseSplit.createMany({
    data: [
      { expenseId: liftTicketsExpense.id, userId: users.aarav.id, amount: 2700.0 },
      { expenseId: liftTicketsExpense.id, userId: users.amit.id, amount: 2700.0 },
      { expenseId: liftTicketsExpense.id, userId: users.chirag.id, amount: 2700.0 },
      { expenseId: liftTicketsExpense.id, userId: users.devendra.id, amount: 2700.0 }
    ]
  });

  console.log('Created expenses and expense splits.');

  // 5. Create chat messages
  console.log('Creating chat messages...');

  await prisma.message.createMany({
    data: [
      {
        expenseId: cabinExpense.id,
        userId: users.aarav.id,
        content: 'Hey guys, I booked the resort in Manali! Let me know if the price looks good.',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2) // 2 hours ago
      },
      {
        expenseId: cabinExpense.id,
        userId: users.amit.id,
        content: 'Awesome place Aarav! Thanks for setting this up.',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 1.5) // 1.5 hours ago
      },
      {
        expenseId: cabinExpense.id,
        userId: users.devendra.id,
        content: 'Looks beautiful. I will pay for the adventure activities to offset some of my share.',
        createdAt: new Date(Date.now() - 1000 * 60 * 60) // 1 hour ago
      }
    ]
  });

  // 6. Create settlements (Amit paid Aarav ₹3000)
  console.log('Creating settlements...');
  await prisma.settlement.create({
    data: {
      groupId: manaliTripGroup.id,
      payerId: users.amit.id,
      payeeId: users.aarav.id,
      amount: 3000.0,
      createdAt: new Date()
    }
  });

  console.log('Seeding finished successfully!');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
