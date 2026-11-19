# Fatani Traders — Textile Trading, Inventory, Sales & Accounting ERP

A complete, production-grade, mobile-first Textile Trading, Inventory, Sales, Accounting, and Business Management ERP engineered specifically for fabric roll and thaan wholesale trading.

---

## 1. Core Architectural Highlights

- **Weight-Based Inventory (Integer Grams)**:
  Fabric rolls are purchased and sold in kilograms and grams. All weights are stored internally as 64-bit integer grams ($1 \text{ KG} = 1000 \text{ g}$) to completely eliminate floating-point drift.
- **Lot-Wise Landed Cost Accounting (IAS 2 Compliant)**:
  Every purchase batch forms an independent **Purchase Lot**. The ERP supports an unlimited **Dynamic Additional Expense System** (transport, unloading, folding, packaging, handling).
  $$\text{Base Cost} = \text{Purchased Weight (KG)} \times \text{Purchase Rate per KG}$$
  $$\text{Total Landed Cost} = \text{Base Cost} + \sum \text{Capitalizable Lot Expenses}$$
  $$\text{Actual Cost per KG} = \frac{\text{Total Landed Cost}}{\text{Purchased Weight (KG)}}$$
  *Expense paid/unpaid status does not affect inventory cost: unpaid expenses still capitalize into inventory as accounts payable.*
- **Subsequent Lot Cost Adjustments**:
  Late-arriving freight or folding invoices can be added post-purchase, automatically updating lot landed cost and recalculating historical COGS with an immutable audit trail.
- **DigiKhata-Inspired Customer & Supplier Ledgers**:
  Fast, mobile-friendly chronological ledger tracking debits, credits, and running balances with FIFO automatic payment allocation and WhatsApp statement sharing.
- **Accrual Profit & Loss Engine**:
  Net Sales Revenue minus exact lot-level Cost of Goods Sold (COGS) equals Gross Profit; Operating Expenses (rent, electricity, chai, salaries) are recognized as period overhead.
- **Cashbook & Bankbook with Contra Transfers**:
  Tracks shop drawer cash, Meezan Bank, HBL, and mobile wallets. Internal contra transfers update liquidity with zero P&L distortion.
- **Mobile-First Responsive PWA**:
  Optimized for 360px–430px smartphone viewports with large touch targets, sticky save actions, and bottom navigation.

---

## 2. Monorepo Structure

```
FataniTraders/
├── package.json             # Workspace root orchestration (pnpm)
├── pnpm-workspace.yaml      # Monorepo packages config
├── render.yaml              # Render.com backend deployment blueprint
├── vercel.json              # Vercel frontend deployment config
├── packages/
│   └── shared/              # Shared library (@fatani/shared)
│       ├── src/utils/       # Landed cost, weight conversion, currency math
│       ├── src/schemas/     # Zod validation schemas
│       └── src/types/       # TypeScript domain models
├── apps/
│   ├── backend/             # Express.js + Prisma + MongoDB REST API
│   │   ├── prisma/
│   │   │   ├── schema.prisma # MongoDB schema with replica-set support
│   │   │   └── seed.ts      # Initial admin & fabric masters seed
│   │   └── src/
│   │       ├── services/    # ACID transactional business logic
│   │       ├── controllers/ # HTTP route handlers
│   │       ├── middleware/  # Cookie auth, rate-limiter, audit logger
│   │       └── tests/       # Unit & Integration test suite
│   └── frontend/            # Next.js 14 App Router + Tailwind CSS
│       └── src/
│           ├── app/         # Pages (Dashboard, Purchases, Sales, Khata...)
│           ├── components/  # Layout, MobileNav, BottomNav, Drawers, Modals
│           └── context/     # AuthContext with session management
```

---

## 3. Quick Start (Local Development)

### Prerequisites
- Node.js v20+ or v22+
- `pnpm` (`npm install -g pnpm`)
- MongoDB (Running with replica set `rs0` for multi-document ACID transactions, or MongoDB Atlas connection string)

### Step 1: Install Dependencies & Build Shared Library
```bash
pnpm install
pnpm run build:shared
```

### Step 2: Configure Environment Variables
In `apps/backend/.env`:
```env
PORT=5000
NODE_ENV=development
DATABASE_URL="mongodb://127.0.0.1:27018/fatani_traders?replicaSet=rs0&directConnection=true"
JWT_SECRET="fatani_textile_erp_jwt_secret_production_2026_super_secure"
JWT_EXPIRES_IN="7d"
FRONTEND_URL="http://localhost:3000"
INITIAL_ADMIN_EMAIL="admin@fatanitraders.com"
INITIAL_ADMIN_PASSWORD="Fatani@Admin2026!"
INITIAL_ADMIN_NAME="Admin Fatani"
```

In `apps/frontend/.env.local`:
```env
NEXT_PUBLIC_APP_NAME="Fatani Traders"
BACKEND_INTERNAL_URL="http://127.0.0.1:5000"
```

### Step 3: Initialize Database & Seed Masters
```bash
# Push schema and indexes to MongoDB
pnpm --filter backend db:push

# Seed default admin, fabric categories, products, suppliers, customers & accounts
pnpm --filter backend db:seed
```

### Step 4: Run Automated Tests
```bash
pnpm --filter backend test
```
*Runs all 17 automated unit and integration tests covering the complete purchase → landed cost → sale → return → ledger cycle.*

### Step 5: Start Development Servers
```bash
# Terminal 1: Backend API (port 5000)
pnpm run dev:backend

# Terminal 2: Frontend (port 3000)
pnpm run dev:frontend
```

Open `http://localhost:3000` in your browser.

---

## 4. Default Seeded Credentials

- **Email**: `admin@fatanitraders.com`
- **Password**: `Fatani@Admin2026!`

---

## 5. Deployment Guide

### A. MongoDB Atlas Database Setup
1. Create a free or dedicated cluster on [MongoDB Atlas](https://www.mongodb.com/atlas). Atlas clusters have replica sets enabled by default, supporting multi-document ACID transactions.
2. In **Network Access**, add `0.0.0.0/0` (or Render service IP).
3. In **Database Access**, create a user with Read and Write permissions.
4. Copy the connection string:
   `mongodb+srv://<username>:<password>@cluster0.mongodb.net/fatani_traders?retryWrites=true&w=majority`

### B. Backend Deployment on Render
1. Create a **Web Service** on [Render](https://render.com) connected to this repository (or use `render.yaml` Blueprint).
2. Set **Root Directory** to `apps/backend` (or use root build command):
   - **Build Command**: `pnpm install && pnpm run build:shared && pnpm run build:backend`
   - **Start Command**: `node apps/backend/dist/server.js`
3. Environment Variables on Render:
   - `NODE_ENV`: `production`
   - `DATABASE_URL`: *Your MongoDB Atlas connection string*
   - `JWT_SECRET`: *A secure 64-character random string*
   - `FRONTEND_URL`: *Your Vercel frontend URL, e.g., `https://fatani-traders.vercel.app`*
   - `PORT`: `10000`

### C. Frontend Deployment on Vercel
1. Import the repository into [Vercel](https://vercel.com).
2. Set **Root Directory** to `apps/frontend`.
3. Build Settings:
   - **Build Command**: `pnpm run build:shared && pnpm run build:frontend`
   - **Output Directory**: `apps/frontend/.next`
4. Environment Variables on Vercel:
   - `BACKEND_INTERNAL_URL`: *Your Render backend URL, e.g., `https://fatani-traders-backend.onrender.com`*

---

## 6. Business Operations Walkthrough

### 1. Purchase Lot Entry with Landed Cost
1. Navigate to **Purchases** &rarr; **+ New Purchase Entry**.
2. Select supplier (e.g. *Al-Karam Textile Mills*) and product (e.g. *Digital Print Lawn*).
3. Enter Purchased Weight: `2,000 KG`, Rate: `PKR 120 / KG` (Base Cost: PKR 240,000).
4. Add Landed Expense Rows:
   - Vehicle / Transport: `PKR 5,000`
   - Unloading Labor: `PKR 3,000`
   - Folding: `PKR 2,000`
5. The live calculation updates in real time:
   $$\text{Total Landed Cost} = \text{PKR } 250,000 \quad \Longrightarrow \quad \text{Cost per KG} = \text{PKR } 125$$
6. Save the purchase to generate `PUR-...` and `LOT-...`.

### 2. Fast Mobile Sale Entry
1. Navigate to **Sales** &rarr; **+ New Sale**.
2. Select Customer (e.g. *Tariq Garments*).
3. Select the Lot (displays live remaining stock).
4. Enter weight in KG & grams, and negotiated selling rate per KG (e.g. `PKR 180 / KG`).
5. Enter optional trade discount or immediate cash payment.
6. Submit to atomically deduct stock and record customer Khata debit.
7. Print A4 invoice or thermal receipt slip, or share via WhatsApp with one click.

### 3. DigiKhata Customer Khata
1. Navigate to **Khata** &rarr; tap customer card.
2. View total invoiced, payments received, returns, and net outstanding balance.
3. Tap **Receive Payment** to record cash/bank collections with automatic FIFO invoice distribution.
4. Tap **WhatsApp** to send an instant formatted statement to the customer.
