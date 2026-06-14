-- AlterTable
ALTER TABLE "Group" ADD COLUMN "budget" REAL;

-- CreateTable
CREATE TABLE "RecurringExpense" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "paidById" TEXT NOT NULL,
    "splitType" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'Others',
    "interval" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "nextTriggerAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RecurringExpense_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RecurringExpense_paidById_fkey" FOREIGN KEY ("paidById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RecurringExpenseSplit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recurringExpenseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "percentage" REAL,
    "share" REAL,
    "amount" REAL,
    CONSTRAINT "RecurringExpenseSplit_recurringExpenseId_fkey" FOREIGN KEY ("recurringExpenseId") REFERENCES "RecurringExpense" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "RecurringExpenseSplit_recurringExpenseId_userId_key" ON "RecurringExpenseSplit"("recurringExpenseId", "userId");
