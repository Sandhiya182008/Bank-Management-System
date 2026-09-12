# Bank Management System

A college-level DBMS project designed for second-year Computer Science and Engineering (CSE).

This project demonstrates core relational database principles using **PostgreSQL** with explicit parameterized SQL queries, connected to a modular **Node.js (Express)** backend and a clean, responsive web interface.

---

## Team Members & Module Responsibilities

| # | Name | Assigned Role | Primary Module & Files |
| :- | :--- | :--- | :--- |
| **1** | **Sandhiya** *(Lead)* | **Database Design & Integration** | `database/*`, `backend/config/db.js`, PR Reviews & Merging |
| **2** | **Sadhana** | **Customer & Account Module** | Customer & Account CRUD, Account balance lookup |
| **3** | **Shivarakshana** | **Transaction Module** | Deposit, withdrawal, ACID fund transfer with rollback |
| **4** | **Pavi** | **Loan, Employee & Branch Module** | Loan application & repayment, Branch & Employee directory |
| **5** | **Resh** | **Frontend, Dashboard & Testing** | UI pages, dashboard analytics, charts, API testing guide |

---

## Technology Stack

- **Database:** PostgreSQL 15 / 16
- **Database Driver:** `pg` (node-postgres) — uses raw parameterized SQL (no ORM) to demonstrate actual SQL for academic evaluation.
- **Backend:** Node.js (LTS) & Express.js
- **Frontend:** HTML5, Modern Vanilla CSS, JavaScript (Fetch API)
- **Version Control:** Git & GitHub

---

## Database Architecture (3NF)

The database schema consists of **8 tables** normalized up to Third Normal Form (3NF):

1. **`Branch`**: Physical branches (`branch_id`, `branch_name`, `branch_code`, `ifsc_code`, `city`, `phone`).
2. **`Customer`**: Basic customer profile without sensitive PAN/Aadhaar (`customer_id`, `first_name`, `last_name`, `email`, `phone`, `address`, `date_of_birth`).
3. **`Account`**: Bank accounts (`account_id`, `account_number`, `customer_id`, `branch_id`, `account_type`, `balance`, `status`). Enforces `CHECK (balance >= 0.00)`.
4. **`Transaction`**: Double-entry financial ledger (`transaction_id`, `transaction_ref`, `from_account_id`, `to_account_id`, `transaction_type`, `amount`, `description`, `transaction_date`). Enforces `CHECK (amount > 0.00)`.
5. **`Loan`**: Loan records (`loan_id`, `loan_number`, `customer_id`, `branch_id`, `loan_type`, `loan_amount`, `interest_rate`, `duration_months`, `status`, `applied_date`).
6. **`Loan_Payment`**: Repayments/EMI tracking (`payment_id`, `loan_id`, `amount_paid`, `payment_date`, `payment_mode`).
7. **`Employee`**: Bank staff (`employee_id`, `branch_id`, `first_name`, `last_name`, `email`, `phone`, `role`, `salary`, `joining_date`).
8. **`Audit_Log`**: Automatically populated by a trigger when account balances change (`log_id`, `account_id`, `old_balance`, `new_balance`, `action_type`, `changed_at`).

---

## DBMS Features Showcased for College Viva

1. **3NF Normalization**: Complete separation of entities without partial or transitive dependencies.
2. **Integrity Constraints**: `PRIMARY KEY`, `FOREIGN KEY (ON DELETE RESTRICT)`, `UNIQUE`, `NOT NULL`, and `CHECK` constraints (`balance >= 0`, `amount > 0`).
3. **ACID Fund Transfer Transactions**: Explicit `BEGIN ... COMMIT / ROLLBACK` with row-level locking (`SELECT ... FOR UPDATE`) to prevent race conditions and overdrafts.
4. **Database Triggers**:
   - `trg_audit_balance_change`: Automatically logs balance modifications into `Audit_Log`.
   - `trg_prevent_negative_balance`: Database-engine invariant preventing negative balances.
5. **Database Views**:
   - `v_customer_accounts`: Aggregates customer account counts and total deposits.
   - `v_branch_summary`: Branch performance metrics (active accounts, deposits, staff count).
   - `v_transaction_ledger`: Resolves sender and receiver names via double self-joins.
   - `v_loan_overview`: Shows loan principal, total repaid, and outstanding balances.
6. **Explicit Indexing**: B-tree indexes on search and foreign key columns for fast lookup.
7. **Curated Evaluation Queries**: Multi-table `JOIN`, `GROUP BY`, `HAVING`, and nested/correlated subqueries in `database/evaluation_queries.sql`.

---

## Project Folder Structure

```
Bank-Management-System/
├── database/                          # [Sandhiya] Database DDL, DML, Views, Triggers
│   ├── schema.sql                     # 8 tables with PKs, FKs, CHECK & UNIQUE constraints
│   ├── indexes.sql                    # Performance lookup indexes
│   ├── views.sql                      # Pre-defined analytical views
│   ├── triggers.sql                   # Audit log and balance guard triggers
│   ├── seed.sql                       # Sample dataset for demonstration
│   └── evaluation_queries.sql         # Curated viva queries (JOINs, aggregates, subqueries)
│
├── backend/                           # Node.js + Express Backend
│   ├── config/
│   │   └── db.js                      # PostgreSQL pool setup and transaction client helper
│   ├── controllers/                   # (Created per module on feature branches)
│   ├── routes/                        # (Created per module on feature branches)
│   ├── server.js                      # Express application entry point
│   └── package.json                   # Backend dependencies
│
├── frontend/                          # (Created by Resh on feature branch)
├── docs/                              # Presentation & report documentation
├── .env.example                       # Environment variables template
├── .gitignore                         # Excluded files
└── README.md                          # Project documentation
```

---

## Setup & Installation Guide

### Step 1: Clone Repository
```bash
git clone https://github.com/Sandhiya182008/Bank-Management-System.git
cd Bank-Management-System
```

### Step 2: Database Setup (PostgreSQL)
1. Open **pgAdmin** or `psql` command line.
2. Create a new database:
   ```sql
   CREATE DATABASE bank_db;
   ```
3. Run the SQL scripts in this exact order:
   - `database/schema.sql` (Creates tables and constraints)
   - `database/indexes.sql` (Creates lookup indexes)
   - `database/views.sql` (Creates analytical views)
   - `database/triggers.sql` (Creates stored functions and triggers)
   - `database/seed.sql` (Populates sample data)

   *Using psql:*
   ```bash
   psql -U postgres -d bank_db -f database/schema.sql
   psql -U postgres -d bank_db -f database/indexes.sql
   psql -U postgres -d bank_db -f database/views.sql
   psql -U postgres -d bank_db -f database/triggers.sql
   psql -U postgres -d bank_db -f database/seed.sql
   ```

### Step 3: Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   npm install
   ```
2. Create your `.env` file in the project root (copy from `.env.example`):
   ```env
   PORT=5000
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=bank_db
   DB_USER=postgres
   DB_PASSWORD=your_actual_password
   ```
3. Start the server:
   ```bash
   npm start
   # or with auto-reload:
   npm run dev
   ```
4. Verify backend health check:
   Open browser at: `http://localhost:5000/api/health`

---

## Git Workflow for Team Members

To prevent merge conflicts, all team members follow this beginner-friendly branch workflow:

1. **Pull the latest code from `main`:**
   ```bash
   git checkout main
   git pull origin main
   ```
2. **Create your feature branch:**
   - Sandhiya: `feature/database-core-sandhiya`
   - Sadhana: `feature/customer-account-sadhana`
   - Shivarakshana: `feature/transactions-shivarakshana`
   - Pavi: `feature/loan-employee-pavi`
   - Resh: `feature/ui-dashboard-resh`

   *Example command:*
   ```bash
   git checkout -b feature/customer-account-sadhana
   ```
3. **Work only within your designated files.**
4. **Commit and push your work:**
   ```bash
   git add .
   git commit -m "Implement customer creation endpoint"
   git push origin feature/customer-account-sadhana
   ```
5. **Open a Pull Request on GitHub** targeting `main`.
6. **Sandhiya (Integration Lead)** reviews the code and merges it into `main`.
