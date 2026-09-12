-- =====================================================================
-- College DBMS Project: Bank Management System
-- Module: Database Design & Integration
-- Lead: Sandhiya
-- Description: Analytical & Reporting Views for DBMS Evaluation
-- =====================================================================

-- 1. Customer Account Summary View
-- Demonstrates: Multi-table JOIN (Customer + Account), Aggregate Functions (COUNT, SUM, COALESCE), GROUP BY
CREATE OR REPLACE VIEW v_customer_accounts AS
SELECT 
    c.customer_id,
    c.first_name || ' ' || c.last_name AS customer_name,
    c.email,
    c.phone,
    COUNT(a.account_id) AS total_accounts,
    COALESCE(SUM(a.balance), 0.00) AS total_balance
FROM Customer c
LEFT JOIN Account a ON c.customer_id = a.customer_id
GROUP BY c.customer_id, c.first_name, c.last_name, c.email, c.phone;

-- 2. Branch Financial Summary View
-- Demonstrates: Aggregating branches with account counts, total deposits, and staff count
CREATE OR REPLACE VIEW v_branch_summary AS
SELECT 
    b.branch_id,
    b.branch_name,
    b.branch_code,
    b.city,
    COUNT(DISTINCT a.account_id) AS total_active_accounts,
    COALESCE(SUM(a.balance), 0.00) AS total_branch_deposits,
    COUNT(DISTINCT e.employee_id) AS total_staff
FROM Branch b
LEFT JOIN Account a ON b.branch_id = a.branch_id AND a.status = 'Active'
LEFT JOIN Employee e ON b.branch_id = e.branch_id
GROUP BY b.branch_id, b.branch_name, b.branch_code, b.city;

-- 3. Detailed Transaction Ledger View
-- Demonstrates: Multiple JOINs on the same table (Account joined twice as sender and receiver)
CREATE OR REPLACE VIEW v_transaction_ledger AS
SELECT 
    t.transaction_id,
    t.transaction_ref,
    t.transaction_type,
    t.amount,
    t.description,
    t.transaction_date,
    fa.account_number AS from_account_number,
    fc.first_name || ' ' || fc.last_name AS sender_name,
    ta.account_number AS to_account_number,
    tc.first_name || ' ' || tc.last_name AS receiver_name
FROM Transaction t
LEFT JOIN Account fa ON t.from_account_id = fa.account_id
LEFT JOIN Customer fc ON fa.customer_id = fc.customer_id
LEFT JOIN Account ta ON t.to_account_id = ta.account_id
LEFT JOIN Customer tc ON ta.customer_id = tc.customer_id
ORDER BY t.transaction_date DESC;

-- 4. Loan Overview & Repayment Status View
-- Demonstrates: Aggregation of loan payments to calculate balance remaining
CREATE OR REPLACE VIEW v_loan_overview AS
SELECT 
    l.loan_id,
    l.loan_number,
    c.first_name || ' ' || c.last_name AS customer_name,
    b.branch_name,
    l.loan_type,
    l.loan_amount,
    l.interest_rate,
    l.duration_months,
    l.status,
    COALESCE(SUM(lp.amount_paid), 0.00) AS total_paid,
    (l.loan_amount - COALESCE(SUM(lp.amount_paid), 0.00)) AS outstanding_balance
FROM Loan l
JOIN Customer c ON l.customer_id = c.customer_id
JOIN Branch b ON l.branch_id = b.branch_id
LEFT JOIN Loan_Payment lp ON l.loan_id = lp.loan_id
GROUP BY l.loan_id, l.loan_number, c.first_name, c.last_name, b.branch_name, 
         l.loan_type, l.loan_amount, l.interest_rate, l.duration_months, l.status;
