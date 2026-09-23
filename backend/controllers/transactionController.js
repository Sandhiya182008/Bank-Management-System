// =====================================================================
// College DBMS Project: Bank Management System
// Module: Transaction Module
// Team Member: Shivarakshana
// Controller: Transaction Controller (backend/controllers/transactionController.js)
// Description: Implements Deposit, Withdrawal, Transfer, and Transaction History
//              using ACID transactions, row-level locking (FOR UPDATE),
//              and parameterized raw SQL queries via node-postgres (pg).
// =====================================================================

const db = require('../config/db');

// =====================================================================
// Validation & Error Handling Helpers
// =====================================================================

/**
 * Validates whether an ID is a valid positive integer.
 * @param {string|number} id
 * @returns {boolean}
 */
const isValidPositiveInteger = (id) => {
    if (id === undefined || id === null) return false;
    const str = String(id).trim();
    return /^[1-9]\d*$/.test(str);
};

/**
 * Validates whether an amount is a positive number greater than 0.
 * @param {string|number} amt
 * @returns {boolean}
 */
const isValidAmount = (amt) => {
    if (amt === undefined || amt === null || amt === '') return false;
    const num = Number(amt);
    return !isNaN(num) && num > 0;
};

/**
 * Generates a unique transaction reference in application logic.
 * Format: TXN + timestamp + 4-digit random number (fits within VARCHAR(50))
 * @returns {string}
 */
const generateTransactionRef = () => {
    const timestamp = Date.now();
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    return `TXN${timestamp}${randomNum}`;
};

/**
 * Handles database errors with college DBMS project friendliness:
 * - Specific handling for PostgreSQL Unique Constraint (23505) e.g., duplicate transaction_ref
 * - Specific handling for Foreign Key Restriction (23503) e.g., invalid account reference
 * - Specific handling for Check Constraints (23514) e.g., negative balance, non-positive amount
 *
 * @param {Error} err - Caught error
 * @param {Object} res - Express response object
 * @param {string} actionDescription - Action context for logging
 */
const handleDbError = (err, res, actionDescription = 'process transaction request') => {
    console.error(`Database Error during ${actionDescription}:`, {
        code: err.code,
        message: err.message,
        detail: err.detail,
        constraint: err.constraint
    });

    if (err.code === '23505') {
        return res.status(409).json({
            success: false,
            message: 'Transaction reference collision occurred. Please try again.'
        });
    }

    if (err.code === '23503') {
        return res.status(400).json({
            success: false,
            message: 'Invalid foreign key: One or both referenced accounts do not exist.'
        });
    }

    if (err.code === '23514') {
        return res.status(400).json({
            success: false,
            message: 'Database check constraint failed: Amount must be greater than zero and balance cannot be negative.'
        });
    }

    return res.status(500).json({
        success: false,
        message: `Failed to ${actionDescription} due to an internal server error.`
    });
};

// =====================================================================
// Controller Functions
// =====================================================================

/**
 * 1. Deposit Money into an Account
 * POST /api/transactions/deposit
 * Body: { account_id, amount, description }
 */
const depositMoney = async (req, res) => {
    const { account_id, amount, description } = req.body;

    // Parameter Validation
    if (!isValidPositiveInteger(account_id)) {
        return res.status(400).json({
            success: false,
            message: 'Validation Error: account_id must be a positive integer.'
        });
    }

    if (!isValidAmount(amount)) {
        return res.status(400).json({
            success: false,
            message: 'Validation Error: deposit amount must be greater than 0.'
        });
    }

    const depositAmount = parseFloat(amount);
    const txnDescription = description ? String(description).trim() : 'Deposit';
    let client;

    try {
        // Acquire dedicated PostgreSQL client for ACID transaction
        client = await db.getClient();
        await client.query('BEGIN');

        // Lock account row using SELECT ... FOR UPDATE
        const accountResult = await client.query(
            'SELECT account_id, account_number, balance, status FROM Account WHERE account_id = $1 FOR UPDATE',
            [account_id]
        );

        if (accountResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({
                success: false,
                message: `Account with ID ${account_id} not found.`
            });
        }

        const account = accountResult.rows[0];

        // Check account status
        if (account.status !== 'Active') {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                message: `Deposit rejected: Account #${account.account_number} is currently ${account.status}. Only Active accounts accept deposits.`
            });
        }

        // Update Account Balance
        const updateResult = await client.query(
            'UPDATE Account SET balance = balance + $1 WHERE account_id = $2 RETURNING account_id, account_number, balance, status',
            [depositAmount, account_id]
        );
        const updatedAccount = updateResult.rows[0];

        // Generate Transaction Reference and Insert Transaction Record
        const transactionRef = generateTransactionRef();
        const insertResult = await client.query(
            `INSERT INTO Transaction (transaction_ref, from_account_id, to_account_id, transaction_type, amount, description)
             VALUES ($1, NULL, $2, 'Deposit', $3, $4)
             RETURNING transaction_id, transaction_ref, from_account_id, to_account_id, transaction_type, amount, description, transaction_date`,
            [transactionRef, account_id, depositAmount, txnDescription]
        );

        // Commit ACID Transaction
        await client.query('COMMIT');

        return res.status(200).json({
            success: true,
            message: 'Deposit successful.',
            data: {
                transaction: insertResult.rows[0],
                updated_balance: updatedAccount.balance
            }
        });
    } catch (err) {
        if (client) {
            try {
                await client.query('ROLLBACK');
            } catch (rollbackErr) {
                console.error('Error rolling back deposit transaction:', rollbackErr.message);
            }
        }
        return handleDbError(err, res, 'process deposit');
    } finally {
        if (client) {
            client.release();
        }
    }
};

/**
 * 2. Withdraw Money from an Account
 * POST /api/transactions/withdraw
 * Body: { account_id, amount, description }
 */
const withdrawMoney = async (req, res) => {
    const { account_id, amount, description } = req.body;

    // Parameter Validation
    if (!isValidPositiveInteger(account_id)) {
        return res.status(400).json({
            success: false,
            message: 'Validation Error: account_id must be a positive integer.'
        });
    }

    if (!isValidAmount(amount)) {
        return res.status(400).json({
            success: false,
            message: 'Validation Error: withdrawal amount must be greater than 0.'
        });
    }

    const withdrawAmount = parseFloat(amount);
    const txnDescription = description ? String(description).trim() : 'Withdrawal';
    let client;

    try {
        // Acquire dedicated PostgreSQL client for ACID transaction
        client = await db.getClient();
        await client.query('BEGIN');

        // Lock account row using SELECT ... FOR UPDATE
        const accountResult = await client.query(
            'SELECT account_id, account_number, balance, status FROM Account WHERE account_id = $1 FOR UPDATE',
            [account_id]
        );

        if (accountResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({
                success: false,
                message: `Account with ID ${account_id} not found.`
            });
        }

        const account = accountResult.rows[0];

        // Check account status
        if (account.status !== 'Active') {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                message: `Withdrawal rejected: Account #${account.account_number} is currently ${account.status}. Only Active accounts allow withdrawals.`
            });
        }

        // Check sufficient balance
        const currentBalance = parseFloat(account.balance);
        if (currentBalance < withdrawAmount) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                message: `Insufficient balance: Account #${account.account_number} has a balance of $${currentBalance.toFixed(2)}, which is less than requested withdrawal amount of $${withdrawAmount.toFixed(2)}.`
            });
        }

        // Update Account Balance
        const updateResult = await client.query(
            'UPDATE Account SET balance = balance - $1 WHERE account_id = $2 RETURNING account_id, account_number, balance, status',
            [withdrawAmount, account_id]
        );
        const updatedAccount = updateResult.rows[0];

        // Generate Transaction Reference and Insert Transaction Record
        const transactionRef = generateTransactionRef();
        const insertResult = await client.query(
            `INSERT INTO Transaction (transaction_ref, from_account_id, to_account_id, transaction_type, amount, description)
             VALUES ($1, $2, NULL, 'Withdrawal', $3, $4)
             RETURNING transaction_id, transaction_ref, from_account_id, to_account_id, transaction_type, amount, description, transaction_date`,
            [transactionRef, account_id, withdrawAmount, txnDescription]
        );

        // Commit ACID Transaction
        await client.query('COMMIT');

        return res.status(200).json({
            success: true,
            message: 'Withdrawal successful.',
            data: {
                transaction: insertResult.rows[0],
                updated_balance: updatedAccount.balance
            }
        });
    } catch (err) {
        if (client) {
            try {
                await client.query('ROLLBACK');
            } catch (rollbackErr) {
                console.error('Error rolling back withdrawal transaction:', rollbackErr.message);
            }
        }
        return handleDbError(err, res, 'process withdrawal');
    } finally {
        if (client) {
            client.release();
        }
    }
};

/**
 * 3. Fund Transfer Between Two Accounts
 * POST /api/transactions/transfer
 * Body: { from_account_id, to_account_id, amount, description }
 */
const transferMoney = async (req, res) => {
    const { from_account_id, to_account_id, amount, description } = req.body;

    // Parameter Validation
    if (!isValidPositiveInteger(from_account_id)) {
        return res.status(400).json({
            success: false,
            message: 'Validation Error: from_account_id must be a positive integer.'
        });
    }

    if (!isValidPositiveInteger(to_account_id)) {
        return res.status(400).json({
            success: false,
            message: 'Validation Error: to_account_id must be a positive integer.'
        });
    }

    if (Number(from_account_id) === Number(to_account_id)) {
        return res.status(400).json({
            success: false,
            message: 'Validation Error: Sender and receiver accounts cannot be the same account.'
        });
    }

    if (!isValidAmount(amount)) {
        return res.status(400).json({
            success: false,
            message: 'Validation Error: transfer amount must be greater than 0.'
        });
    }

    const transferAmount = parseFloat(amount);
    const txnDescription = description ? String(description).trim() : 'Fund Transfer';
    let client;

    try {
        // Acquire dedicated PostgreSQL client for ACID transaction
        client = await db.getClient();
        await client.query('BEGIN');

        // Deadlock Prevention: Deterministically lock accounts ordered by account_id
        const firstLockId = Math.min(Number(from_account_id), Number(to_account_id));
        const secondLockId = Math.max(Number(from_account_id), Number(to_account_id));

        const firstLockResult = await client.query(
            'SELECT account_id, account_number, balance, status FROM Account WHERE account_id = $1 FOR UPDATE',
            [firstLockId]
        );

        const secondLockResult = await client.query(
            'SELECT account_id, account_number, balance, status FROM Account WHERE account_id = $1 FOR UPDATE',
            [secondLockId]
        );

        // Map locked rows to account IDs
        const lockedAccounts = {};
        if (firstLockResult.rows.length > 0) {
            lockedAccounts[firstLockResult.rows[0].account_id] = firstLockResult.rows[0];
        }
        if (secondLockResult.rows.length > 0) {
            lockedAccounts[secondLockResult.rows[0].account_id] = secondLockResult.rows[0];
        }

        const senderAccount = lockedAccounts[Number(from_account_id)];
        const receiverAccount = lockedAccounts[Number(to_account_id)];

        // Verify existence of both accounts
        if (!senderAccount) {
            await client.query('ROLLBACK');
            return res.status(404).json({
                success: false,
                message: `Sender account with ID ${from_account_id} not found.`
            });
        }

        if (!receiverAccount) {
            await client.query('ROLLBACK');
            return res.status(404).json({
                success: false,
                message: `Receiver account with ID ${to_account_id} not found.`
            });
        }

        // Verify Active status for both accounts
        if (senderAccount.status !== 'Active') {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                message: `Transfer rejected: Sender account #${senderAccount.account_number} is ${senderAccount.status}. Both accounts must be Active.`
            });
        }

        if (receiverAccount.status !== 'Active') {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                message: `Transfer rejected: Receiver account #${receiverAccount.account_number} is ${receiverAccount.status}. Both accounts must be Active.`
            });
        }

        // Verify sender balance
        const senderBalance = parseFloat(senderAccount.balance);
        if (senderBalance < transferAmount) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                message: `Insufficient balance: Sender account #${senderAccount.account_number} balance is $${senderBalance.toFixed(2)}, which is insufficient for transfer of $${transferAmount.toFixed(2)}.`
            });
        }

        // Deduct from Sender
        const senderUpdate = await client.query(
            'UPDATE Account SET balance = balance - $1 WHERE account_id = $2 RETURNING account_id, account_number, balance',
            [transferAmount, from_account_id]
        );

        // Add to Receiver
        const receiverUpdate = await client.query(
            'UPDATE Account SET balance = balance + $1 WHERE account_id = $2 RETURNING account_id, account_number, balance',
            [transferAmount, to_account_id]
        );

        // Generate Transaction Reference and Insert Single Transaction Record
        const transactionRef = generateTransactionRef();
        const insertResult = await client.query(
            `INSERT INTO Transaction (transaction_ref, from_account_id, to_account_id, transaction_type, amount, description)
             VALUES ($1, $2, $3, 'Transfer', $4, $5)
             RETURNING transaction_id, transaction_ref, from_account_id, to_account_id, transaction_type, amount, description, transaction_date`,
            [transactionRef, from_account_id, to_account_id, transferAmount, txnDescription]
        );

        // Commit ACID Transaction
        await client.query('COMMIT');

        return res.status(200).json({
            success: true,
            message: 'Fund transfer completed successfully.',
            data: {
                transaction: insertResult.rows[0],
                sender_updated_balance: senderUpdate.rows[0].balance,
                receiver_updated_balance: receiverUpdate.rows[0].balance
            }
        });
    } catch (err) {
        if (client) {
            try {
                await client.query('ROLLBACK');
            } catch (rollbackErr) {
                console.error('Error rolling back transfer transaction:', rollbackErr.message);
            }
        }
        return handleDbError(err, res, 'process fund transfer');
    } finally {
        if (client) {
            client.release();
        }
    }
};

/**
 * 4. Retrieve All Transactions (History)
 * GET /api/transactions
 */
const getAllTransactions = async (req, res) => {
    try {
        const queryText = `
            SELECT
                t.transaction_id,
                t.transaction_ref,
                t.transaction_type,
                t.amount,
                t.description,
                t.transaction_date,
                t.from_account_id,
                fa.account_number AS from_account_number,
                t.to_account_id,
                ta.account_number AS to_account_number
            FROM Transaction t
            LEFT JOIN Account fa ON t.from_account_id = fa.account_id
            LEFT JOIN Account ta ON t.to_account_id = ta.account_id
            ORDER BY t.transaction_date DESC, t.transaction_id DESC
        `;

        const result = await db.query(queryText);

        return res.status(200).json({
            success: true,
            count: result.rows.length,
            data: result.rows
        });
    } catch (err) {
        return handleDbError(err, res, 'retrieve transaction history');
    }
};

/**
 * 5. Retrieve Transaction by ID
 * GET /api/transactions/:id
 */
const getTransactionById = async (req, res) => {
    const { id } = req.params;

    if (!isValidPositiveInteger(id)) {
        return res.status(400).json({
            success: false,
            message: 'Validation Error: Transaction ID must be a positive integer.'
        });
    }

    try {
        const queryText = `
            SELECT
                t.transaction_id,
                t.transaction_ref,
                t.transaction_type,
                t.amount,
                t.description,
                t.transaction_date,
                t.from_account_id,
                fa.account_number AS from_account_number,
                t.to_account_id,
                ta.account_number AS to_account_number
            FROM Transaction t
            LEFT JOIN Account fa ON t.from_account_id = fa.account_id
            LEFT JOIN Account ta ON t.to_account_id = ta.account_id
            WHERE t.transaction_id = $1
        `;

        const result = await db.query(queryText, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: `Transaction with ID ${id} not found.`
            });
        }

        return res.status(200).json({
            success: true,
            data: result.rows[0]
        });
    } catch (err) {
        return handleDbError(err, res, 'retrieve transaction by ID');
    }
};

/**
 * 6. Retrieve Account Transaction History
 * GET /api/transactions/account/:accountId
 */
const getTransactionsByAccountId = async (req, res) => {
    const { accountId } = req.params;

    if (!isValidPositiveInteger(accountId)) {
        return res.status(400).json({
            success: false,
            message: 'Validation Error: accountId must be a positive integer.'
        });
    }

    try {
        const queryText = `
            SELECT
                t.transaction_id,
                t.transaction_ref,
                t.transaction_type,
                t.amount,
                t.description,
                t.transaction_date,
                t.from_account_id,
                fa.account_number AS from_account_number,
                t.to_account_id,
                ta.account_number AS to_account_number
            FROM Transaction t
            LEFT JOIN Account fa ON t.from_account_id = fa.account_id
            LEFT JOIN Account ta ON t.to_account_id = ta.account_id
            WHERE t.from_account_id = $1 OR t.to_account_id = $1
            ORDER BY t.transaction_date DESC, t.transaction_id DESC
        `;

        const result = await db.query(queryText, [accountId]);

        return res.status(200).json({
            success: true,
            account_id: parseInt(accountId, 10),
            count: result.rows.length,
            data: result.rows
        });
    } catch (err) {
        return handleDbError(err, res, 'retrieve account transaction history');
    }
};

module.exports = {
    depositMoney,
    withdrawMoney,
    transferMoney,
    getAllTransactions,
    getTransactionById,
    getTransactionsByAccountId
};
