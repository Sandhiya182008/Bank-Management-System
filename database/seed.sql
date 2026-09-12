-- =====================================================================
-- College DBMS Project: Bank Management System
-- Module: Database Design & Integration
-- Lead: Sandhiya
-- Description: Realistic Sample Dataset for Demonstration & Testing
-- =====================================================================

-- Clean existing data before seeding (reverse order of foreign keys)
TRUNCATE TABLE Audit_Log, Loan_Payment, Loan, Transaction, Account, Employee, Customer, Branch RESTART IDENTITY CASCADE;

-- 1. Insert Branches
INSERT INTO Branch (branch_name, branch_code, ifsc_code, city, phone) VALUES
('Downtown Main Branch', 'BR001', 'BANK0001001', 'Chennai', '044-28110001'),
('Tech Park Branch',     'BR002', 'BANK0001002', 'Bangalore', '080-25520002'),
('Cyber City Branch',    'BR003', 'BANK0001003', 'Hyderabad', '040-23330003'),
('Central Metro Branch', 'BR004', 'BANK0001004', 'Mumbai',    '022-22000004');

-- 2. Insert Customers (Basic details, no sensitive PAN/Aadhaar)
INSERT INTO Customer (first_name, last_name, email, phone, address, date_of_birth) VALUES
('Aarav',    'Sharma',   'aarav.sharma@example.com',   '9876543210', '12 Anna Nagar, Chennai',        '1995-04-15'),
('Diya',     'Patel',    'diya.patel@example.com',     '9876543211', '45 Indiranagar, Bangalore',     '1998-08-22'),
('Rohan',    'Verma',    'rohan.verma@example.com',    '9876543212', '78 Jubilee Hills, Hyderabad',   '1992-11-03'),
('Ananya',   'Iyer',     'ananya.iyer@example.com',    '9876543213', '23 T Nagar, Chennai',           '2000-01-19'),
('Karthik',  'Rao',      'karthik.rao@example.com',    '9876543214', '89 Whitefield, Bangalore',      '1989-07-30'),
('Pooja',    'Nair',     'pooja.nair@example.com',     '9876543215', '56 Bandra West, Mumbai',        '1996-03-12'),
('Siddharth','Mehta',    'siddharth.m@example.com',    '9876543216', '102 Andheri East, Mumbai',      '1994-09-25'),
('Meera',    'Krishnan', 'meera.k@example.com',        '9876543217', '34 Banjara Hills, Hyderabad',   '2001-12-05');

-- 3. Insert Accounts
-- Note: Balances satisfy CHECK (balance >= 0.00)
INSERT INTO Account (account_number, customer_id, branch_id, account_type, balance, status) VALUES
('ACC100101', 1, 1, 'Savings', 45000.00, 'Active'),
('ACC100102', 1, 1, 'Current', 120000.00, 'Active'),
('ACC100201', 2, 2, 'Savings', 62500.50, 'Active'),
('ACC100301', 3, 3, 'Salary',  85000.00, 'Active'),
('ACC100401', 4, 1, 'Savings', 25000.00, 'Active'),
('ACC100501', 5, 2, 'Current', 340000.00, 'Active'),
('ACC100601', 6, 4, 'Savings', 51000.00, 'Active'),
('ACC100701', 7, 4, 'Salary',  95000.00, 'Active'),
('ACC100801', 8, 3, 'Savings', 18500.00, 'Active'),
('ACC100802', 8, 3, 'Current', 75000.00, 'Inactive');

-- 4. Insert Transactions
-- Ledger includes Deposits (from NULL), Withdrawals (to NULL), and Transfers between accounts
INSERT INTO Transaction (transaction_ref, from_account_id, to_account_id, transaction_type, amount, description, transaction_date) VALUES
('TXN20260901001', NULL, 1, 'Deposit', 10000.00, 'Initial cash deposit', '2026-09-01 10:15:00'),
('TXN20260901002', NULL, 3, 'Deposit', 50000.00, 'Cheque deposit',       '2026-09-01 11:30:00'),
('TXN20260902001', 1, 3,    'Transfer', 5000.00, 'Rent payment',          '2026-09-02 14:20:00'),
('TXN20260902002', 4, NULL, 'Withdrawal', 2000.00, 'ATM cash withdrawal', '2026-09-02 16:45:00'),
('TXN20260903001', 3, 4,    'Transfer', 12000.00, 'Vendor invoice pay',   '2026-09-03 09:10:00'),
('TXN20260904001', NULL, 6, 'Deposit', 100000.00, 'Client wire transfer', '2026-09-04 12:00:00'),
('TXN20260905001', 6, 7,    'Transfer', 25000.00, 'Quarterly dividend',   '2026-09-05 15:30:00'),
('TXN20260906001', 7, NULL, 'Withdrawal', 5000.00, 'Self withdrawal',     '2026-09-06 17:05:00'),
('TXN20260907001', 5, 1,    'Transfer', 15000.00, 'Consulting fee',       '2026-09-07 11:22:00'),
('TXN20260908001', NULL, 8, 'Deposit', 40000.00, 'Salary crediting',     '2026-09-08 09:00:00');

-- 5. Insert Loans
INSERT INTO Loan (loan_number, customer_id, branch_id, loan_type, loan_amount, interest_rate, duration_months, status, applied_date) VALUES
('LN202601', 1, 1, 'Personal',  200000.00, 11.50, 24, 'Approved', '2026-01-15'),
('LN202602', 3, 3, 'Home',     3500000.00,  8.25, 180, 'Approved', '2026-02-10'),
('LN202603', 4, 1, 'Education', 400000.00,  9.00, 48, 'Approved', '2026-03-05'),
('LN202604', 5, 2, 'Vehicle',   650000.00,  9.75, 60, 'Applied',  '2026-09-01'),
('LN202605', 7, 4, 'Personal',  150000.00, 12.00, 18, 'Closed',   '2025-06-10');

-- 6. Insert Loan Payments
INSERT INTO Loan_Payment (loan_id, amount_paid, payment_date, payment_mode) VALUES
(1, 9360.00, '2026-02-15 10:00:00', 'Online'),
(1, 9360.00, '2026-03-15 10:00:00', 'Online'),
(1, 9360.00, '2026-04-15 10:00:00', 'Online'),
(2, 34000.00, '2026-03-10 11:15:00', 'Cheque'),
(2, 34000.00, '2026-04-10 11:15:00', 'Online'),
(3, 10000.00, '2026-04-05 14:30:00', 'Online'),
(5, 150000.00, '2026-08-10 16:00:00', 'Cash');

-- 7. Insert Employees
INSERT INTO Employee (branch_id, first_name, last_name, email, phone, role, salary, joining_date) VALUES
(1, 'Rajesh',  'Menon',    'rajesh.menon@bank.com',    '9444100001', 'Manager',      85000.00, '2020-05-01'),
(1, 'Sneha',   'Kumar',    'sneha.kumar@bank.com',     '9444100002', 'Cashier',      38000.00, '2022-08-15'),
(2, 'Vikram',  'Reddy',    'vikram.reddy@bank.com',    '9444200001', 'Manager',      88000.00, '2019-11-10'),
(2, 'Divya',   'Hegde',    'divya.hegde@bank.com',     '9444200002', 'Loan Officer', 52000.00, '2021-03-01'),
(3, 'Suresh',  'Choudhary','suresh.c@bank.com',        '9444300001', 'Manager',      84000.00, '2021-01-20'),
(3, 'Nithya',  'Babu',     'nithya.b@bank.com',        '9444300002', 'Clerk',        32000.00, '2023-06-12'),
(4, 'Manoj',   'Tiwari',   'manoj.tiwari@bank.com',    '9444400001', 'Manager',      91000.00, '2018-09-05'),
(4, 'Lavanya', 'Deshmukh', 'lavanya.d@bank.com',       '9444400002', 'Cashier',      39000.00, '2022-12-01');

-- 8. Seed Initial Audit Log Record (Sample)
INSERT INTO Audit_Log (account_id, old_balance, new_balance, action_type, changed_at) VALUES
(1, 50000.00, 45000.00, 'DEBIT', '2026-09-02 14:20:00'),
(3, 57500.50, 62500.50, 'CREDIT', '2026-09-02 14:20:00');
