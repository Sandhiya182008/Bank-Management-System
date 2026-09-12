-- =====================================================================
-- College DBMS Project: Bank Management System
-- Module: Database Design & Integration
-- Lead: Sandhiya
-- Description: PL/pgSQL Stored Functions and Triggers
-- =====================================================================

-- 1. Trigger Function: Log Balance Modifications to Audit_Log
-- Fires automatically on any Account balance update
CREATE OR REPLACE FUNCTION fn_audit_account_balance()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.balance <> NEW.balance THEN
        INSERT INTO Audit_Log (
            account_id,
            old_balance,
            new_balance,
            action_type,
            changed_at
        ) VALUES (
            NEW.account_id,
            OLD.balance,
            NEW.balance,
            CASE 
                WHEN NEW.balance < OLD.balance THEN 'DEBIT'
                ELSE 'CREDIT'
            END,
            CURRENT_TIMESTAMP
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger definition for Audit_Log
DROP TRIGGER IF EXISTS trg_audit_balance_change ON Account;
CREATE TRIGGER trg_audit_balance_change
AFTER UPDATE OF balance ON Account
FOR EACH ROW
EXECUTE FUNCTION fn_audit_account_balance();

-- 2. Trigger Function: Prevent Negative Balance as Engine Invariant
-- Ensures balance can never fall below 0 even if constraint checking is bypassed
CREATE OR REPLACE FUNCTION fn_prevent_negative_balance()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.balance < 0.00 THEN
        RAISE EXCEPTION 'Transaction Rejected: Account % cannot have a negative balance (attempted: %)', 
            NEW.account_number, NEW.balance;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger definition for Negative Balance Guard
DROP TRIGGER IF EXISTS trg_prevent_negative_balance ON Account;
CREATE TRIGGER trg_prevent_negative_balance
BEFORE INSERT OR UPDATE OF balance ON Account
FOR EACH ROW
EXECUTE FUNCTION fn_prevent_negative_balance();
