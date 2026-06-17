# SettleUp (HisabKitab) — Premium Splitwise Clone

SettleUp (HisabKitab) is a high-fidelity, premium-designed expense splitting and financial management platform. It allows users to create groups, log bills with advanced split strategies (equal/unequal), upload receipts, chat in real-time inside expense threads, track group balances, and settle debts with a single tap. 

This version upgrades the system with five production-level features, including a **Debt Simplification Engine**, **Group Budget Limits**, **Recurring Bills Scheduler**, **AI Receipt Scanner**, and **System-wide Analytics Dashboard**.

---

## 🌐 Live Deployments

*   **Frontend Client (Vercel):** [https://frontend-drab-gamma-e5aclp0kwg.vercel.app](https://frontend-drab-gamma-e5aclp0kwg.vercel.app)
*   **Backend API Server (Railway):** [https://splitwise-backend-production.up.railway.app](https://splitwise-backend-production.up.railway.app)
*   **Database:** Hosted on Neon Cloud PostgreSQL

---

## 🚀 Key Features

### Core Splitwise Features
1. **User Authentication & Profiles:** Secure JWT-based registration, login, profile token caching, and initials-based avatars.
2. **Dynamic Group Management:** Create groups with custom descriptions and default currencies (INR, USD, EUR, GBP). Add members by email or invite new friends with automated membership updates when they sign up.
3. **Flexible Expense Splitting:** Support for:
   - **Equally:** Split bills evenly among selected members.
   - **Custom Amounts:** Specify exact unequal amounts owed by each participant (with rounding balances absorbed by the payer).
4. **Interactive Expense Chat:** Real-time messaging system built inside each expense detail page using **Socket.io WebSockets**, with history persisted in the database.
5. **Categorized Expenses:** Group transactions into **Food, Travel, Shopping, Rent, Entertainment, Utilities,** and **Others** with custom badges.
6. **Receipt Attachments:** Upload receipt images (<5MB, PNG/JPG/WebP). View them in expense cards with a click-to-zoom dark lightbox viewer.
7. **Chronological Activity Timeline:** Real-time logging of all group activities (member additions/removals, expense logs, chat comments, and settlements) rendered as a chronological feed.

### 🌟 Advanced Upgrades Added
* **Debt Simplification Engine:** Shows side-by-side toggles for **Raw Pairwise Debts** vs. mathematically optimized **Simplified Settlements** (reducing transaction volumes using a greedy balance algorithm).
* **Group Budget Tracking:** Set group budget limits. View a spent progress bar that transitions from green to amber (70%) and red (>=100% budget limit), along with banner warning alerts.
* **Recurring Expenses:** Configure recurring bills to repeat **Daily, Weekly, Monthly, or Yearly**. A background scheduler runs automatically on server boot and every 10 minutes to auto-generate transactions with split copy rules. Supports rule pausing, resuming, and deleting.
* **AI Receipt Scanner:** Tap to scan bills in the Add Expense modal. Plays a vertical neon-teal laser scanning line overlay and parses uploaded files (matching keywords like *coffee, uber, rent, netflix*) to auto-fill the description, amount, and category fields.
* **Insights & Highlights Dashboard:** Analytics page displaying monthly spending trends using native responsive SVG charts, category breakdowns, and advanced metrics: **Top Spender** (name + total amount), **Most Active Member** (activity score), and **Largest Single Expense**.
* **LED Grid Calculation Background:** Creative mathematical grid blueprint texture backdrop combined with floating radial mesh color glows.

---

## 🛠️ Tech Stack & Architecture

- **Frontend:** React.js (Vite), React Router DOM, Lucide Icons.
- **Styling:** Vanilla CSS variables for maximum performance with responsive layout structures.
- **Backend:** Node.js, Express, Multer (file uploads).
- **WebSockets:** Socket.io for real-time room messaging.
- **Database ORM:** Prisma ORM.
- **Local Database:** SQLite (development file `dev.db`).
- **Production Database:** PostgreSQL (compatible).

---

## 📂 Project Structure

```
SettleUp/
├── AI_CONTEXT.md          # System specification & source of truth
├── package.json           # Root monorepo workspace scripts
├── README.md              # Documentation (this file)
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma  # Database Models & Relations (Prisma client v5.14.0)
│   │   ├── seed.js        # Seed database script
│   │   └── migrations/    # Generated SQL schema migrations
│   ├── uploads/           # Statically served receipt uploads directory
│   ├── src/
│   │   ├── index.js       # App entry point, mounts routes, starts recurring scheduler
│   │   ├── prisma.js      # Shared Prisma connection client
│   │   ├── middleware/    # Auth middleware (JWT verifier)
│   │   ├── utils/         # Calculations, activityLogger, and scheduler helpers
│   │   └── routes/        # Auth, Groups, Expenses, Settlements, Analytics, Uploads, Recurring, Scan
│   └── package.json
└── frontend/
    ├── src/
    │   ├── App.jsx        # Root component, handles layout views
    │   ├── index.css      # Custom ledger dot-grid backgrounds & styles
    │   ├── main.jsx       # Scaffolder
    │   ├── components/    # Reusable elements (Navbar, user badge)
    │   ├── utils/         # Currencies and Date format helpers
    │   └── views/         # Login, Dashboard, GroupDetail, ExpenseDetail
    ├── index.html
    └── package.json
```

---

## 💻 Local Setup & Installation

### 1. Prerequisites
Ensure you have **Node.js (v18+)** and **npm** installed on your machine.

### 2. Clone the Repository & Install Dependencies
Run the following commands in the project root directory to install the workspace dependencies for the frontend, backend, and monorepo manager concurrently:
```bash
npm install && npm run install-all
```

### 3. Initialize the Relational Database & Run Migrations
The local development database uses SQLite. Run the migrations to build the tables and pre-populate mock seed data (users, groups, test expenses):
```bash
npm run prisma:migrate --prefix backend
```
*(If you need to regenerate the Prisma client modules, run `npm run prisma:generate --prefix backend`)*

### 4. Start Development Servers
Run the concurrent dev script to launch both the Express backend API (on port `5000`) and the Vite React frontend client (on port `5173`):
```bash
npm run dev
```
Open your browser and navigate to `http://localhost:5173`.

---

## ☁️ Production Deployment

### 1. Database Setup (PostgreSQL)
1. Provision a PostgreSQL database instance (e.g. Supabase, Neon, RDS).
2. Copy your connection URL string.

### 2. Backend Environment Config
Create a `.env` file inside the host environment:
```env
PORT=5000
DATABASE_URL="postgresql://user:password@host/db?sslmode=require"
JWT_SECRET="use-a-secure-long-string-for-jwt-signing"
```

### 3. Database Migration & Build
1. In `backend/prisma/schema.prisma`, update the datasource provider from `"sqlite"` to `"postgresql"`:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
2. Apply the tables structure directly to PostgreSQL:
   ```bash
   npx prisma db push --schema=backend/prisma/schema.prisma
   ```
3. Compile the production bundles:
   ```bash
   npm run build
   ```

### 4. Serve the App
Start the node service:
```bash
npm start
```
The Express application will automatically serve both the API endpoints and the static compiled React pages from `frontend/dist/`.

---

## ⚙️ Technical Details & Algorithms

### ⚖️ Greedy Debt Simplification
Instead of settling debts individually (which leads to redundant transactions), SettleUp computes a net balance for each group member:
$$\text{Net Balance } (B) = (\text{Paid Amount} + \text{Settlements Sent}) - (\text{Split Share} + \text{Settlements Received})$$

1. Members are divided into **Creditors** ($B > 0$) and **Debtors** ($B < 0$).
2. The algorithm matches the largest debtor with the largest creditor:
   - If the debtor owes more than the creditor is owed, the debtor pays the creditor's full amount, the creditor is satisfied, and the debtor's remainder is pushed back to the debtors heap.
   - If the debtor owes less than the creditor is owed, the debtor pays their full balance, the debtor is satisfied, and the creditor's remainder is pushed back to the creditors heap.
3. This process repeats, reducing the settlement transaction count to a maximum of $N - 1$ payments (where $N$ is the number of group members).

### 🔁 Automated Recurring Scheduler
The background task manager runs immediately on server startup:
- Filters active rules where `nextTriggerAt <= current Date`.
- Creates a new `Expense` model entry, appends `(Recurring)` to the title, copies the `paidById`, `amount`, and `category`.
- Copies `RecurringExpenseSplit` records into new `ExpenseSplit` records.
- Logs a timeline `Activity` entry and advances `nextTriggerAt` to the next cycle (Daily, Weekly, Monthly, Yearly).
- Handles server-offline catchups by auto-creating backlog entries in a loop if the server was restarted after a scheduled date passed.

### 🤖 Simulated AI OCR parsing
The scan file endpoint simulates a standard OCR parsing network latency of 1.2s. It reads the name of the file to guess detail fields:
- `coffee` / `starbucks` $\rightarrow$ Starbucks Coffee (₹840.00) $\rightarrow$ Category: Food
- `uber` / `cab` / `travel` $\rightarrow$ Uber Travels (₹1250.00) $\rightarrow$ Category: Travel
- `rent` / `flat` $\rightarrow$ Monthly House Rent (₹25000.00) $\rightarrow$ Category: Rent
- *Other titles fall back to random store generation (D-Mart, Haldirams, Decathlon) with noise offsets.*

---

## 📄 License
This project is licensed under the MIT License.
