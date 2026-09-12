-- =====================================================================
-- College DBMS Project: Bank Management System
-- Module: Database Design & Integration
-- Lead: Sandhiya
-- Database: PostgreSQL 15 / 16
-- Description: DDL Schema for 8 core tables with PKs, FKs, CHECK & UNIQUE constraints
-- =====================================================================

-- Drop existing tables in reverse dependency order for clean reinstalls if needed
DROP TABLE IF EXISTS Audit_Log CASCADE;
DROP TABLE IF EXISTS Loan_Payment CASCADE;
DROP TABLE IF EXISTS Loan CASCADE;
DROP TABLE IF EXISTS Transaction CASCADE;
DROP TABLE IF EXISTS Account CASCADE;
DROP TABLE IF EXISTS Employee CASCADE;
DROP TABLE IF EXISTS Customer CASCADE;
DROP TABLE IF EXISTS Branch CASCADE;

-- 1. Branch Table
CREATE TABLE Branch (
    branch_id SERIAL PRIMARY KEY,
    branch_name VARCHAR(100) NOT NULL,
    branch_code VARCHAR(20) UNIQUE NOT NULL,
    ifsc_code VARCHAR(20) UNIQUE NOT NULL,
    city VARCHAR(50) NOT NULL,
    phone VARCHAR(15)
);

-- 2. Customer Table (Basic KYC without sensitive Aadhaar/PAN)
CREATE TABLE Customer (
    customer_id SERIAL PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    phone VARCHAR(15) UNIQUE NOT NULL,
    address TEXT,
    date_of_birth DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Account Table
CREATE TABLE Account (
    account_id SERIAL PRIMARY KEY,
    account_number VARCHAR(20) UNIQUE NOT NULL,
    customer_id INT NOT NULL,
    branch_id INT NOT NULL,
    account_type VARCHAR(20) NOT NULL,
    balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    status VARCHAR(20) NOT NULL DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT fk_account_customer FOREIGN KEY (customer_id) 
        REFERENCES Customer(customer_id) ON DELETE RESTRICT,
    CONSTRAINT fk_account_branch FOREIGN KEY (branch_id) 
        REFERENCES Branch(branch_id) ON DELETE RESTRICT,
    CONSTRAINT chk_account_type CHECK (account_type IN ('Savings', 'Current', 'Salary')),
    CONSTRAINT chk_account_balance CHECK (balance >= 0.00),
    CONSTRAINT chk_account_status CHECK (status IN ('Active', 'Inactive', 'Frozen'))
);

-- 4. Transaction Table
CREATE TABLE Transaction (
    transaction_id SERIAL PRIMARY KEY,
    transaction_ref VARCHAR(50) UNIQUE NOT NULL,
    from_account_id INT,
    to_account_id INT,
    transaction_type VARCHAR(20) NOT NULL,
    amount NUMERIC(15, 2) NOT NULL,
    description VARCHAR(255),
    transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT fk_tx_from_account FOREIGN KEY (from_account_id) 
        REFERENCES Account(account_id) ON DELETE RESTRICT,
    CONSTRAINT fk_tx_to_account FOREIGN KEY (to_account_id) 
        REFERENCES Account(account_id) ON DELETE RESTRICT,
    CONSTRAINT chk_tx_type CHECK (transaction_type IN ('Deposit', 'Withdrawal', 'Transfer')),
    CONSTRAINT chk_tx_amount CHECK (amount > 0.00)
);

-- 5. Loan Table
CREATE TABLE Loan (
    loan_id SERIAL PRIMARY KEY,
    loan_number VARCHAR(30) UNIQUE NOT NULL,
    customer_id INT NOT NULL,
    branch_id INT NOT NULL,
    loan_type VARCHAR(30) NOT NULL,
    loan_amount NUMERIC(15, 2) NOT NULL,
    interest_rate NUMERIC(5, 2) NOT NULL,
    duration_months INT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'Applied',
    applied_date DATE DEFAULT CURRENT_DATE,

    -- Constraints
    CONSTRAINT fk_loan_customer FOREIGN KEY (customer_id) 
        REFERENCES Customer(customer_id) ON DELETE RESTRICT,
    CONSTRAINT fk_loan_branch FOREIGN KEY (branch_id) 
        REFERENCES Branch(branch_id) ON DELETE RESTRICT,
    CONSTRAINT chk_loan_type CHECK (loan_type IN ('Personal', 'Home', 'Education', 'Vehicle')),
    CONSTRAINT chk_loan_amount CHECK (loan_amount > 0.00),
    CONSTRAINT chk_loan_interest CHECK (interest_rate > 0.00),
    CONSTRAINT chk_loan_duration CHECK (duration_months > 0),
    CONSTRAINT chk_loan_status CHECK (status IN ('Applied', 'Approved', 'Rejected', 'Closed'))
);

-- 6. Loan_Payment Table
CREATE TABLE Loan_Payment (
    payment_id SERIAL PRIMARY KEY,
    loan_id INT NOT NULL,
    amount_paid NUMERIC(15, 2) NOT NULL,
    payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    payment_mode VARCHAR(30) DEFAULT 'Online',

    -- Constraints
    CONSTRAINT fk_payment_loan FOREIGN KEY (loan_id) 
        REFERENCES Loan(loan_id) ON DELETE RESTRICT,
    CONSTRAINT chk_payment_amount CHECK (amount_paid > 0.00),
    CONSTRAINT chk_payment_mode CHECK (payment_mode IN ('Cash', 'Online', 'Cheque'))
);

-- 7. Employee Table
CREATE TABLE Employee (
    employee_id SERIAL PRIMARY KEY,
    branch_id INT NOT NULL,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    phone VARCHAR(15),
    role VARCHAR(30) NOT NULL,
    salary NUMERIC(15, 2) NOT NULL,
    joining_date DATE DEFAULT CURRENT_DATE,

    -- Constraints
    CONSTRAINT fk_employee_branch FOREIGN KEY (branch_id) 
        REFERENCES Branch(branch_id) ON DELETE RESTRICT,
    CONSTRAINT chk_employee_role CHECK (role IN ('Manager', 'Cashier', 'Loan Officer', 'Clerk')),
    CONSTRAINT chk_employee_salary CHECK (salary > 0.00)
);

-- 8. Audit_Log Table (Academic Showcase for Database Triggers)
CREATE TABLE Audit_Log (
    log_id SERIAL PRIMARY KEY,
    account_id INT,
    old_balance NUMERIC(15, 2),
    new_balance NUMERIC(15, 2),
    action_type VARCHAR(20) NOT NULL,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_audit_account FOREIGN KEY (account_id) 
        REFERENCES Account(account_id) ON DELETE SET NULL
);
