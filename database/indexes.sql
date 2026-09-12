-- =====================================================================
-- College DBMS Project: Bank Management System
-- Module: Database Design & Integration
-- Lead: Sandhiya
-- Description: Explicit Indexes for Performance Optimization
-- =====================================================================

-- 1. Index on Account Lookups
CREATE INDEX idx_account_acc_number ON Account(account_number);
CREATE INDEX idx_account_customer_id ON Account(customer_id);
CREATE INDEX idx_account_branch_id ON Account(branch_id);

-- 2. Index on Transaction History & Statements
CREATE INDEX idx_tx_from_account ON Transaction(from_account_id);
CREATE INDEX idx_tx_to_account ON Transaction(to_account_id);
CREATE INDEX idx_tx_date ON Transaction(transaction_date DESC);

-- 3. Index on Customer Searches
CREATE INDEX idx_customer_email ON Customer(email);
CREATE INDEX idx_customer_phone ON Customer(phone);

-- 4. Index on Loan Relationships
CREATE INDEX idx_loan_customer ON Loan(customer_id);
CREATE INDEX idx_loan_branch ON Loan(branch_id);
CREATE INDEX idx_loan_payment_loan ON Loan_Payment(loan_id);

-- 5. Index on Employee Branch Assignments
CREATE INDEX idx_employee_branch ON Employee(branch_id);
