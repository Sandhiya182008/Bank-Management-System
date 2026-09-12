-- =====================================================================
-- College DBMS Project: Bank Management System
-- Module: Database Design & Integration
-- Lead: Sandhiya
-- Description: Curated Evaluation Queries for Viva & Lab Examination
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. MULTI-TABLE JOINS
-- ---------------------------------------------------------------------

-- Query 1.1: 3-Table INNER JOIN (Customer, Account, Branch)
-- Displays all active accounts along with the account holder's name and branch city
SELECT 
    c.customer_id,
    c.first_name || ' ' || c.last_name AS customer_name,
    a.account_number,
    a.account_type,
    a.balance,
    b.branch_name,
    b.city
FROM Customer c
INNER JOIN Account a ON c.customer_id = a.customer_id
INNER JOIN Branch b ON a.branch_id = b.branch_id
WHERE a.status = 'Active'
ORDER BY a.balance DESC;

-- Query 1.2: Dual Self-Referencing JOIN on Transaction Table
-- Resolves both sender and receiver names and account numbers
SELECT 
    t.transaction_ref,
    t.transaction_type,
    t.amount,
    COALESCE(fa.account_number, 'CASH / EXT') AS from_account,
    COALESCE(fc.first_name || ' ' || fc.last_name, 'External') AS sender_name,
    COALESCE(ta.account_number, 'CASH / EXT') AS to_account,
    COALESCE(tc.first_name || ' ' || tc.last_name, 'External') AS receiver_name,
    t.transaction_date
FROM Transaction t
LEFT JOIN Account fa ON t.from_account_id = fa.account_id
LEFT JOIN Customer fc ON fa.customer_id = fc.customer_id
LEFT JOIN Account ta ON t.to_account_id = ta.account_id
LEFT JOIN Customer tc ON ta.customer_id = tc.customer_id;

-- ---------------------------------------------------------------------
-- 2. AGGREGATE QUERIES (GROUP BY & HAVING)
-- ---------------------------------------------------------------------

-- Query 2.1: Total balance and account count per branch having deposits > 100,000
SELECT 
    b.branch_name,
    b.city,
    COUNT(a.account_id) AS total_accounts,
    SUM(a.balance) AS total_deposits,
    ROUND(AVG(a.balance), 2) AS average_account_balance
FROM Branch b
JOIN Account a ON b.branch_id = a.branch_id
GROUP BY b.branch_id, b.branch_name, b.city
HAVING SUM(a.balance) > 100000.00
ORDER BY total_deposits DESC;

-- Query 2.2: Total approved loan exposure per loan type
SELECT 
    loan_type,
    COUNT(loan_id) AS total_loans_count,
    SUM(loan_amount) AS total_principal_disbursed,
    ROUND(AVG(interest_rate), 2) AS avg_interest_rate
FROM Loan
WHERE status = 'Approved'
GROUP BY loan_type
ORDER BY total_principal_disbursed DESC;

-- ---------------------------------------------------------------------
-- 3. SUBQUERIES (NESTED & CORRELATED)
-- ---------------------------------------------------------------------

-- Query 3.1: Customers who hold accounts with above-average balances across the bank
SELECT 
    customer_id, 
    first_name || ' ' || last_name AS customer_name,
    email
FROM Customer
WHERE customer_id IN (
    SELECT customer_id 
    FROM Account 
    WHERE balance > (SELECT AVG(balance) FROM Account)
);

-- Query 3.2: Branches that have at least one active customer loan (EXISTS correlated subquery)
SELECT 
    b.branch_id,
    b.branch_name,
    b.city
FROM Branch b
WHERE EXISTS (
    SELECT 1 FROM Loan l 
    WHERE l.branch_id = b.branch_id AND l.status = 'Approved'
);

-- Query 3.3: Customers who have registered but have not applied for any loans (NOT IN / NOT EXISTS)
SELECT 
    c.customer_id,
    c.first_name || ' ' || c.last_name AS customer_name,
    c.phone
FROM Customer c
WHERE NOT EXISTS (
    SELECT 1 FROM Loan l WHERE l.customer_id = c.customer_id
);

-- ---------------------------------------------------------------------
-- 4. ATOMIC FUND-TRANSFER DEMONSTRATION (ACID TRANSACTION)
-- ---------------------------------------------------------------------
-- Simulates transfer of 5000.00 from ACC100101 (id=1) to ACC100301 (id=4)
-- with row-locking (FOR UPDATE) to prevent concurrency hazards.

BEGIN;

-- Step 1: Lock both sender and receiver accounts in consistent ID order (prevents deadlock)
SELECT account_id, balance, status 
FROM Account 
WHERE account_id IN (1, 4) 
ORDER BY account_id 
FOR UPDATE;

-- Step 2: Debit sender (enforces CHECK balance >= 0.00)
UPDATE Account 
SET balance = balance - 5000.00 
WHERE account_id = 1 AND balance >= 5000.00;

-- Step 3: Credit receiver
UPDATE Account 
SET balance = balance + 5000.00 
WHERE account_id = 4;

-- Step 4: Record in ledger
INSERT INTO Transaction (transaction_ref, from_account_id, to_account_id, transaction_type, amount, description)
VALUES ('TXN-DEMO-' || TO_CHAR(CURRENT_TIMESTAMP, 'YYYYMMDDHH24MISS'), 1, 4, 'Transfer', 5000.00, 'College Viva ACID Demo Transfer');

-- If any step fails or balance is insufficient, execute: ROLLBACK;
-- Otherwise commit the transaction:
COMMIT;

-- ---------------------------------------------------------------------
-- 5. TRIGGER DEMONSTRATION & AUDIT VERIFICATION
-- ---------------------------------------------------------------------

-- View recent audit logs captured automatically by trigger trg_audit_balance_change:
SELECT 
    al.log_id,
    a.account_number,
    al.old_balance,
    al.new_balance,
    al.action_type,
    al.changed_at
FROM Audit_Log al
LEFT JOIN Account a ON al.account_id = a.account_id
ORDER BY al.changed_at DESC
LIMIT 5;

-- ---------------------------------------------------------------------
-- 6. QUERYING PRE-DEFINED DATABASE VIEWS
-- ---------------------------------------------------------------------
SELECT * FROM v_customer_accounts ORDER BY total_balance DESC;
SELECT * FROM v_branch_summary;
SELECT * FROM v_transaction_ledger LIMIT 10;
SELECT * FROM v_loan_overview;
