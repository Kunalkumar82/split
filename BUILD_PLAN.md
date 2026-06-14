# Build Plan: Splitwise Clone

This build plan outlines the research, system architecture, collaboration process, tradeoffs, and implementation phases for creating the Splitwise Clone app in a 2-day timeline.

---

## 1. Product Research & Scope

### How Splitwise Was Studied
We analyzed the core behavior of Splitwise to identify user workflows, calculation mechanisms, and core modules. We mapped out how it handles the following:
- **Balances:** Splitwise doesn't keep a historical ledger of net balances; instead, it dynamically computes balances based on the differences between paid amounts and split amounts across all active expenses and settlements.
- **Group vs Individual:** Splitwise allows expenses inside groups, but also individual-to-individual expenses outside groups. For this MVP, to deliver the highest quality, we are focusing on **Group-centric expenses** which naturally cover individual splits (by creating a group with just two people, which is how Splitwise models it internally anyway).
- **Settlement Logic:** Settle-up is essentially a reverse-payment that decreases the debt between two individuals. It can be recorded manually or integrated. In our clone, it is recorded manually as a transaction that nets out against user debt.

### Core Workflows Identified
1. **User Auth:** Signup/Login to establish identity.
2. **Group Membership:** Create a group, add users by email, and track membership status (Active vs Pending).
3. **Expense Splitting:**
   - Equitably (Equal splits).
   - Weighted (percentage, shares, unequal exact amounts).
4. **Activity & Chat Feed:** Real-time chat inside the context of an expense.
5. **Debt Resolution:** A visual graph of "who owes who" and a way to "Settle Up" instantly.

### Product Assumptions Made
- A single currency per group is sufficient (e.g., all group expenses are in USD, INR, or EUR as defined at group creation).
- No payment gateway integration is needed; all settlements are recorded manually as bookkeeping entries.
- Users can be added to groups via email. If they don't exist in the system yet, their membership is marked as "pending" until they register.

---

## 2. Technical Architecture

### Tech Stack
- **Frontend:** React (Vite SPA) + Vanilla CSS (Custom modern styling system).
- **Backend:** Node.js + Express.
- **WebSockets:** Socket.io (for real-time chat updates).
- **Database:** PostgreSQL (Production) / SQLite (Local).
- **ORM:** Prisma ORM.

### Database Schema & API Design
The complete relational database schema and API routing contracts are fully documented in [AI_CONTEXT.md](file:///c:/Users/kkuna/OneDrive/Desktop/com%20assingment/AI_CONTEXT.md).

### Deployment Approach
- **Frontend + Backend:** Monorepo deployment. The Express backend will serve the React static production build in production.
- **Hosting:** Render/Railway for the Express/React server, and Neon or Supabase for the PostgreSQL database.

---

## 3. AI Collaboration Process

- **Prompting Strategy:** The user prompted the AI to act as a junior developer who doesn't assume requirements, but rather interviews the product owner (user).
- **Decision Delegation:** The user instructed the AI to formulate and apply the best solutions for each architectural and design decision to ensure a high-quality selection assignment project.
- **Context Preservation:** `AI_CONTEXT.md` is updated continuously as the source of truth for the codebase, and all subsequent building will be guided strictly by that document.

---

## 4. Tradeoffs & Simplifications

### What We Simplified
- **Single Currency:** Rather than converting between multiple currencies per expense, each group has a default currency.
- **No Third-Party OAuth:** To ensure the system is self-contained and easily buildable/testable by an evaluator, we will use email/password sign-up with bcrypt password hashing and JWT authentication.
- **Pairwise Debt Simplification:** Debt simplification is performed locally on the server whenever group details are requested, keeping calculations fast and dynamic without needing complex background cron jobs.

### What We Avoided
- Avoided using heavy third-party CSS libraries (like Tailwind CSS or Bootstrap) to comply with styling guidelines and showcase a highly customized, premium Vanilla CSS UI.
- Avoided using BaaS (Backend-as-a-Service) like Firebase for the database/auth/real-time, instead building a native Express server with Prisma and Socket.io to showcase true full-stack engineering skills.

### Future Improvements (Given More Time)
- Push notifications for settlements and new expenses.
- OCR scanning for receipt uploads.
- Multi-currency conversions using a live exchange rate API.

---

## 5. Implementation Phases

We will build the application in 5 structured phases:

### Phase 1: Project Initialization & Database Setup
- Set up monorepo structure.
- Initialize Prisma with SQLite (for dev) and configure the database schema.
- Run migrations and confirm db tables are created.

### Phase 2: Backend API & Auth
- Build Express app and setup JWT authentication middleware.
- Implement User Registration, Login, and Me endpoints.
- Implement Group creation, member invitation (including pending invites), and member removal.

### Phase 3: Expense Splitting & Calculations
- Implement Expense creation endpoint supporting Equal, Unequal, Percentage, and Share split types.
- Write the core math algorithms to split amounts, handle rounding errors, and calculate group/individual balances.
- Implement Settlement creation endpoint to record payments.

### Phase 4: Socket.io Real-time Chat
- Integrate Socket.io on Express server.
- Implement Message creation and retrieval endpoints.
- Connect Socket.io client to send and receive real-time messages when viewing an expense chat.

### Phase 5: Premium React Frontend
- Build beautiful auth, dashboard, group, and expense pages.
- Apply high-fidelity custom CSS (glassmorphism, dark/light theme, custom buttons, animations).
- Connect frontend to the Express APIs and Socket.io server.
- Verify everything works end-to-end.
