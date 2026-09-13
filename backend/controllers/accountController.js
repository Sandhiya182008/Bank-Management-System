// =====================================================================
// College DBMS Project: Bank Management System
// Module: Customer & Account Module
// Team Member: Sadhana
// Controller: Account Controller (backend/controllers/accountController.js)
// Description: Implements CRUD and Search operations for Account entity
//              using parameterized raw SQL queries via node-postgres (pg).
// =====================================================================

const db = require('../config/db');

// Allowed enum values defined by PostgreSQL schema CHECK constraints
const ALLOWED_ACCOUNT_TYPES = ['Savings', 'Current', 'Salary'];
const ALLOWED_ACCOUNT_STATUSES = ['Active', 'Inactive', 'Frozen'];

// =====================================================================
// Validation & Error Handling Helpers
// =====================================================================

/**
 * Validates whether an ID is a valid positive integer.
 * Used for URL route parameters (:id) and foreign keys.
 * @param {string|number} id
 * @returns {boolean}
 */
const isValidPositiveInteger = (id) => {
    if (id === undefined || id === null) return false;
    const str = String(id).trim();
    return /^[1-9]\d*$/.test(str);
};

/**
 * Handles database errors with college DBMS project friendliness:
 * - Specific handling for PostgreSQL Unique Constraint (23505) e.g., duplicate account_number
 * - Specific handling for Foreign Key Restriction (23503) e.g., invalid customer_id or branch_id
 * - Specific handling for Check Constraints (23514) e.g., negative balance, invalid type/status
 * - Safe generic error messages to client while logging full trace to server console
 *
 * @param {Error} err - Caught error
 * @param {Object} res - Express response object
 * @param {string} actionDescription - Action context for logging
 */
const handleDbError = (err, res, actionDescription = 'process account request') => {
    console.error(`Database Error during ${actionDescription}:`, {
        code: err.code,
        message: err.message,
        detail: err.detail,
        constraint: err.constraint
    });

    // 23505: Unique violation (account_number already exists)
    if (err.code === '23505') {
        return res.status(409).json({
            success: false,
            message: 'An account with this account number already exists.'
        });
    }

    // 23503: Foreign key violation (customer_id or branch_id not found)
    if (err.code === '23503') {
        const detail = (err.detail || '').toLowerCase();
        const constraint = (err.constraint || '').toLowerCase();

        if (constraint.includes('customer') || detail.includes('customer')) {
            return res.status(400).json({
                success: false,
                message: 'Invalid foreign key: The specified customer does not exist.'
            });
        }
        if (constraint.includes('branch') || detail.includes('branch')) {
            return res.status(400).json({
                success: false,
                message: 'Invalid foreign key: The specified branch does not exist.'
            });
        }
        return res.status(400).json({
            success: false,
            message: 'Invalid foreign key: Referenced customer or branch does not exist.'
        });
    }

    // 23514: Check constraint violation
    if (err.code === '23514') {
        return res.status(400).json({
            success: false,
            message: 'Database check constraint failed: Balance cannot be negative, or invalid account type/status provided.'
        });
    }

    // Default internal server error
    return res.status(500).json({
        success: false,
        message: `Failed to ${actionDescription} due to an internal server error.`
    });
};

// =====================================================================
// Controller Functions
// =====================================================================

/**
 * 1. Create a new Account
 * Method: POST
 * Route: /api/accounts
 *
 * Creates an account for an existing customer and branch.
 * Required fields: account_number, customer_id, branch_id, account_type
 * Optional fields: balance (default 0.00), status (default 'Active')
 */
const createAccount = async (req, res) => {
    const { account_number, customer_id, branch_id, account_type, balance, status } = req.body || {};

    // 1. Validate required fields existence
    if (!account_number || typeof account_number !== 'string' || !account_number.trim()) {
        return res.status(400).json({
            success: false,
            message: 'Account number is required and cannot be empty.'
        });
    }
    if (account_number.trim().length > 20) {
        return res.status(400).json({
            success: false,
            message: 'Account number cannot exceed 20 characters.'
        });
    }

    if (customer_id === undefined || customer_id === null || !isValidPositiveInteger(customer_id)) {
        return res.status(400).json({
            success: false,
            message: 'Customer ID is required and must be a positive integer.'
        });
    }

    if (branch_id === undefined || branch_id === null || !isValidPositiveInteger(branch_id)) {
        return res.status(400).json({
            success: false,
            message: 'Branch ID is required and must be a positive integer.'
        });
    }

    if (!account_type || typeof account_type !== 'string' || !account_type.trim()) {
        return res.status(400).json({
            success: false,
            message: `Account type is required. Allowed types: ${ALLOWED_ACCOUNT_TYPES.join(', ')}.`
        });
    }
    const trimmedAccountType = account_type.trim();
    if (!ALLOWED_ACCOUNT_TYPES.includes(trimmedAccountType)) {
        return res.status(400).json({
            success: false,
            message: `Invalid account type '${trimmedAccountType}'. Allowed types: ${ALLOWED_ACCOUNT_TYPES.join(', ')}.`
        });
    }

    // 2. Validate optional balance (defaults to 0.00)
    let parsedBalance = 0.00;
    if (balance !== undefined && balance !== null && String(balance).trim() !== '') {
        parsedBalance = parseFloat(balance);
        if (isNaN(parsedBalance) || parsedBalance < 0) {
            return res.status(400).json({
                success: false,
                message: 'Balance must be a non-negative number (>= 0.00).'
            });
        }
    }

    // 3. Validate optional status (defaults to 'Active')
    let finalStatus = 'Active';
    if (status !== undefined && status !== null && String(status).trim() !== '') {
        const trimmedStatus = String(status).trim();
        if (!ALLOWED_ACCOUNT_STATUSES.includes(trimmedStatus)) {
            return res.status(400).json({
                success: false,
                message: `Invalid status '${trimmedStatus}'. Allowed values: ${ALLOWED_ACCOUNT_STATUSES.join(', ')}.`
            });
        }
        finalStatus = trimmedStatus;
    }

    const sql = `
        INSERT INTO Account (account_number, customer_id, branch_id, account_type, balance, status)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING account_id, account_number, customer_id, branch_id, account_type, balance, status, created_at;
    `;
    const params = [
        account_number.trim(),
        parseInt(customer_id, 10),
        parseInt(branch_id, 10),
        trimmedAccountType,
        parsedBalance,
        finalStatus
    ];

    try {
        const result = await db.query(sql, params);
        return res.status(201).json({
            success: true,
            message: 'Account created successfully.',
            data: result.rows[0]
        });
    } catch (err) {
        return handleDbError(err, res, 'create account');
    }
};

/**
 * 2. Get All Accounts
 * Method: GET
 * Route: /api/accounts
 *
 * Fetches all accounts ordered by account_id ascending.
 * Enriches data with customer and branch details via JOINs.
 */
const getAllAccounts = async (req, res) => {
    const sql = `
        SELECT
            a.account_id,
            a.account_number,
            a.customer_id,
            a.branch_id,
            a.account_type,
            a.balance,
            a.status,
            a.created_at,
            c.first_name,
            c.last_name,
            (c.first_name || ' ' || c.last_name) AS customer_name,
            c.email AS customer_email,
            c.phone AS customer_phone,
            b.branch_name,
            b.branch_code,
            b.ifsc_code,
            b.city AS branch_city
        FROM Account a
        JOIN Customer c ON a.customer_id = c.customer_id
        JOIN Branch b ON a.branch_id = b.branch_id
        ORDER BY a.account_id ASC;
    `;

    try {
        const result = await db.query(sql);
        return res.status(200).json({
            success: true,
            count: result.rows.length,
            data: result.rows
        });
    } catch (err) {
        return handleDbError(err, res, 'fetch all accounts');
    }
};

/**
 * 3. Get Account by ID
 * Method: GET
 * Route: /api/accounts/:id
 *
 * Validates account_id as positive integer.
 * Returns account along with joined customer and branch information.
 * Returns 404 if the account is not found.
 */
const getAccountById = async (req, res) => {
    const { id } = req.params;

    if (!isValidPositiveInteger(id)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid account ID. Account ID must be a positive integer.'
        });
    }

    const sql = `
        SELECT
            a.account_id,
            a.account_number,
            a.customer_id,
            a.branch_id,
            a.account_type,
            a.balance,
            a.status,
            a.created_at,
            c.first_name,
            c.last_name,
            (c.first_name || ' ' || c.last_name) AS customer_name,
            c.email AS customer_email,
            c.phone AS customer_phone,
            b.branch_name,
            b.branch_code,
            b.ifsc_code,
            b.city AS branch_city
        FROM Account a
        JOIN Customer c ON a.customer_id = c.customer_id
        JOIN Branch b ON a.branch_id = b.branch_id
        WHERE a.account_id = $1;
    `;
    const params = [parseInt(id, 10)];

    try {
        const result = await db.query(sql, params);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: `Account with ID ${id} not found.`
            });
        }

        return res.status(200).json({
            success: true,
            data: result.rows[0]
        });
    } catch (err) {
        return handleDbError(err, res, `fetch account with ID ${id}`);
    }
};

/**
 * 4. Update Account
 * Method: PUT
 * Route: /api/accounts/:id
 *
 * Validates account_id and supplied fields.
 * Allows updating: account_number, customer_id, branch_id, account_type, balance, status.
 * Handles duplicate account_number (23505) and foreign-key restrictions (23503).
 */
const updateAccount = async (req, res) => {
    const { id } = req.params;

    if (!isValidPositiveInteger(id)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid account ID. Account ID must be a positive integer.'
        });
    }

    const { account_number, customer_id, branch_id, account_type, balance, status } = req.body || {};

    const updates = [];
    const params = [];

    // Validate and prepare update for account_number
    if (account_number !== undefined) {
        if (typeof account_number !== 'string' || !account_number.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Account number cannot be empty.'
            });
        }
        if (account_number.trim().length > 20) {
            return res.status(400).json({
                success: false,
                message: 'Account number cannot exceed 20 characters.'
            });
        }
        params.push(account_number.trim());
        updates.push(`account_number = $${params.length}`);
    }

    // Validate and prepare update for customer_id
    if (customer_id !== undefined) {
        if (!isValidPositiveInteger(customer_id)) {
            return res.status(400).json({
                success: false,
                message: 'Customer ID must be a positive integer.'
            });
        }
        params.push(parseInt(customer_id, 10));
        updates.push(`customer_id = $${params.length}`);
    }

    // Validate and prepare update for branch_id
    if (branch_id !== undefined) {
        if (!isValidPositiveInteger(branch_id)) {
            return res.status(400).json({
                success: false,
                message: 'Branch ID must be a positive integer.'
            });
        }
        params.push(parseInt(branch_id, 10));
        updates.push(`branch_id = $${params.length}`);
    }

    // Validate and prepare update for account_type
    if (account_type !== undefined) {
        if (typeof account_type !== 'string' || !account_type.trim()) {
            return res.status(400).json({
                success: false,
                message: `Account type cannot be empty. Allowed types: ${ALLOWED_ACCOUNT_TYPES.join(', ')}.`
            });
        }
        const trimmedAccountType = account_type.trim();
        if (!ALLOWED_ACCOUNT_TYPES.includes(trimmedAccountType)) {
            return res.status(400).json({
                success: false,
                message: `Invalid account type '${trimmedAccountType}'. Allowed types: ${ALLOWED_ACCOUNT_TYPES.join(', ')}.`
            });
        }
        params.push(trimmedAccountType);
        updates.push(`account_type = $${params.length}`);
    }

    // Validate and prepare update for balance
    if (balance !== undefined) {
        const parsedBalance = parseFloat(balance);
        if (isNaN(parsedBalance) || parsedBalance < 0) {
            return res.status(400).json({
                success: false,
                message: 'Balance must be a non-negative number (>= 0.00).'
            });
        }
        params.push(parsedBalance);
        updates.push(`balance = $${params.length}`);
    }

    // Validate and prepare update for status
    if (status !== undefined) {
        if (typeof status !== 'string' || !status.trim()) {
            return res.status(400).json({
                success: false,
                message: `Status cannot be empty. Allowed values: ${ALLOWED_ACCOUNT_STATUSES.join(', ')}.`
            });
        }
        const trimmedStatus = status.trim();
        if (!ALLOWED_ACCOUNT_STATUSES.includes(trimmedStatus)) {
            return res.status(400).json({
                success: false,
                message: `Invalid status '${trimmedStatus}'. Allowed values: ${ALLOWED_ACCOUNT_STATUSES.join(', ')}.`
            });
        }
        params.push(trimmedStatus);
        updates.push(`status = $${params.length}`);
    }

    // Ensure at least one field was supplied for update
    if (updates.length === 0) {
        return res.status(400).json({
            success: false,
            message: 'Please provide at least one valid account field to update.'
        });
    }

    params.push(parseInt(id, 10));
    const sql = `
        UPDATE Account
        SET ${updates.join(', ')}
        WHERE account_id = $${params.length}
        RETURNING account_id, account_number, customer_id, branch_id, account_type, balance, status, created_at;
    `;

    try {
        const result = await db.query(sql, params);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: `Account with ID ${id} not found.`
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Account updated successfully.',
            data: result.rows[0]
        });
    } catch (err) {
        return handleDbError(err, res, `update account with ID ${id}`);
    }
};

/**
 * 5. Search Accounts
 * Method: GET
 * Route: /api/accounts/search
 *
 * Supports searching accounts by account_number using parameterized ILIKE.
 * Returns account details enriched with customer and branch information.
 * Returns 400 validation error if no search parameter is supplied.
 */
const searchAccounts = async (req, res) => {
    const { account_number, q } = req.query;
    const searchTerm = (account_number || q || '').trim();

    if (!searchTerm) {
        return res.status(400).json({
            success: false,
            message: 'Please provide a search parameter (e.g., ?account_number=ACC100101 or ?q=ACC100).'
        });
    }

    const sql = `
        SELECT
            a.account_id,
            a.account_number,
            a.customer_id,
            a.branch_id,
            a.account_type,
            a.balance,
            a.status,
            a.created_at,
            c.first_name,
            c.last_name,
            (c.first_name || ' ' || c.last_name) AS customer_name,
            c.email AS customer_email,
            c.phone AS customer_phone,
            b.branch_name,
            b.branch_code,
            b.ifsc_code,
            b.city AS branch_city
        FROM Account a
        JOIN Customer c ON a.customer_id = c.customer_id
        JOIN Branch b ON a.branch_id = b.branch_id
        WHERE a.account_number ILIKE $1
        ORDER BY a.account_id ASC;
    `;
    const params = [`%${searchTerm}%`];

    try {
        const result = await db.query(sql, params);
        return res.status(200).json({
            success: true,
            count: result.rows.length,
            data: result.rows
        });
    } catch (err) {
        return handleDbError(err, res, 'search accounts');
    }
};

// =====================================================================
// Module Exports
// =====================================================================
module.exports = {
    createAccount,
    getAllAccounts,
    getAccountById,
    updateAccount,
    searchAccounts
};
