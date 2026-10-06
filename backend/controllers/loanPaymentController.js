// =====================================================================
// College DBMS Project: Bank Management System
// Module: Loan, Employee & Branch Module
// Team Member: Pavi
// Controller: Loan Payment Controller (backend/controllers/loanPaymentController.js)
// Description: Implements payment recording and retrieval operations for
//              Loan_Payment entity using parameterized raw SQL queries via node-postgres (pg).
// =====================================================================

const db = require('../config/db');

// Allowed enum values defined by PostgreSQL schema CHECK constraint
const ALLOWED_PAYMENT_MODES = ['Cash', 'Online', 'Cheque'];

// =====================================================================
// Validation & Error Handling Helpers
// =====================================================================

/**
 * Validates whether an ID is a valid positive integer.
 * Used for URL route parameters (:id, :loanId) and foreign keys.
 * @param {string|number} id
 * @returns {boolean}
 */
const isValidPositiveInteger = (id) => {
    if (id === undefined || id === null) return false;
    const str = String(id).trim();
    return /^[1-9]\d*$/.test(str);
};

/**
 * Validates whether a value is a valid positive number (> 0).
 * Used for payment amounts.
 * @param {string|number} val
 * @returns {boolean}
 */
const isValidPositiveNumber = (val) => {
    if (val === undefined || val === null || String(val).trim() === '') return false;
    const num = parseFloat(val);
    return !isNaN(num) && num > 0;
};

/**
 * Helper to match payment mode case-insensitively.
 * @param {string} val
 * @returns {string|null}
 */
const matchPaymentMode = (val) => {
    if (!val || typeof val !== 'string') return null;
    const trimmed = val.trim().toLowerCase();
    return ALLOWED_PAYMENT_MODES.find((mode) => mode.toLowerCase() === trimmed) || null;
};

/**
 * Handles database errors with college DBMS project friendliness:
 * - 23503: Foreign key violation (invalid loan_id)
 * - 23514: Check constraint violation (amount <= 0 or invalid payment mode)
 * - 500: Generic internal server error
 *
 * @param {Error} err - Caught error
 * @param {Object} res - Express response object
 * @param {string} actionDescription - Action context for logging
 */
const handleDbError = (err, res, actionDescription = 'process loan payment request') => {
    console.error(`Database Error during ${actionDescription}:`, {
        code: err.code,
        message: err.message,
        detail: err.detail,
        constraint: err.constraint
    });

    // 23503: Foreign key violation (loan_id does not exist)
    if (err.code === '23503') {
        return res.status(400).json({
            success: false,
            message: 'Invalid foreign key: The specified loan does not exist.'
        });
    }

    // 23514: Check constraint violation
    if (err.code === '23514') {
        return res.status(400).json({
            success: false,
            message: `Database check constraint failed: Amount paid must be greater than 0, and payment mode must be one of [${ALLOWED_PAYMENT_MODES.join(', ')}].`
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
 * 1. Record a Loan Payment
 * Method: POST
 * Route: /api/loan-payments
 *
 * Records an installment/payment against an existing loan.
 * Note: Per schema specifications, Loan table does not track outstanding balance,
 * so we record the payment transaction without altering unsupported tables.
 *
 * Required fields: loan_id, amount_paid
 * Optional fields: payment_mode (default 'Online')
 */
const recordLoanPayment = async (req, res) => {
    const { loan_id, amount_paid, payment_mode } = req.body || {};

    // 1. Validate loan_id
    if (!isValidPositiveInteger(loan_id)) {
        return res.status(400).json({
            success: false,
            message: 'Loan ID is required and must be a positive integer.'
        });
    }

    // 2. Validate amount_paid
    if (!isValidPositiveNumber(amount_paid)) {
        return res.status(400).json({
            success: false,
            message: 'Amount paid is required and must be a positive number (> 0).'
        });
    }

    // 3. Validate payment_mode (defaults to 'Online')
    let finalMode = 'Online';
    if (payment_mode !== undefined && payment_mode !== null && String(payment_mode).trim() !== '') {
        const matched = matchPaymentMode(payment_mode);
        if (!matched) {
            return res.status(400).json({
                success: false,
                message: `Invalid payment mode '${payment_mode}'. Allowed modes: ${ALLOWED_PAYMENT_MODES.join(', ')}.`
            });
        }
        finalMode = matched;
    }

    // 4. Verify loan exists in database
    try {
        const loanCheck = await db.query(
            'SELECT loan_id, loan_number, status, loan_amount FROM Loan WHERE loan_id = $1;',
            [parseInt(loan_id, 10)]
        );

        if (loanCheck.rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: `Invalid loan: Loan with ID ${loan_id} does not exist.`
            });
        }

        const sql = `
            INSERT INTO Loan_Payment (loan_id, amount_paid, payment_mode)
            VALUES ($1, $2, $3)
            RETURNING payment_id, loan_id, amount_paid, payment_date, payment_mode;
        `;
        const params = [
            parseInt(loan_id, 10),
            parseFloat(amount_paid),
            finalMode
        ];

        const result = await db.query(sql, params);

        return res.status(201).json({
            success: true,
            message: 'Loan payment recorded successfully.',
            data: {
                ...result.rows[0],
                loan_number: loanCheck.rows[0].loan_number,
                loan_status: loanCheck.rows[0].status
            }
        });
    } catch (err) {
        return handleDbError(err, res, 'record loan payment');
    }
};

/**
 * 2. Get All Loan Payments
 * Method: GET
 * Route: /api/loan-payments
 *
 * Retrieves all loan payment records ordered by payment_date descending.
 * Enriches data with loan and customer details via JOINs.
 */
const getAllLoanPayments = async (req, res) => {
    const sql = `
        SELECT
            lp.payment_id,
            lp.loan_id,
            lp.amount_paid,
            lp.payment_date,
            lp.payment_mode,
            l.loan_number,
            l.loan_type,
            l.loan_amount,
            l.status AS loan_status,
            c.customer_id,
            (c.first_name || ' ' || c.last_name) AS customer_name,
            c.email AS customer_email,
            b.branch_name,
            b.branch_code
        FROM Loan_Payment lp
        JOIN Loan l ON lp.loan_id = l.loan_id
        JOIN Customer c ON l.customer_id = c.customer_id
        JOIN Branch b ON l.branch_id = b.branch_id
        ORDER BY lp.payment_date DESC, lp.payment_id DESC;
    `;

    try {
        const result = await db.query(sql);
        return res.status(200).json({
            success: true,
            count: result.rows.length,
            data: result.rows
        });
    } catch (err) {
        return handleDbError(err, res, 'fetch all loan payments');
    }
};

/**
 * 3. Get Loan Payments for a Specific Loan
 * Method: GET
 * Route: /api/loan-payments/loan/:loanId
 *
 * Retrieves all payment history for a specific loan.
 * Returns 404 if the loan does not exist.
 */
const getPaymentsByLoan = async (req, res) => {
    const { loanId } = req.params;

    if (!isValidPositiveInteger(loanId)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid loan ID. Loan ID must be a positive integer.'
        });
    }

    try {
        // Verify loan exists
        const loanCheck = await db.query(
            `SELECT 
                l.loan_id, 
                l.loan_number, 
                l.loan_type, 
                l.loan_amount, 
                l.status,
                (c.first_name || ' ' || c.last_name) AS customer_name
             FROM Loan l
             JOIN Customer c ON l.customer_id = c.customer_id
             WHERE l.loan_id = $1;`,
            [parseInt(loanId, 10)]
        );

        if (loanCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: `Loan with ID ${loanId} not found.`
            });
        }

        const sql = `
            SELECT
                lp.payment_id,
                lp.loan_id,
                lp.amount_paid,
                lp.payment_date,
                lp.payment_mode
            FROM Loan_Payment lp
            WHERE lp.loan_id = $1
            ORDER BY lp.payment_date DESC, lp.payment_id DESC;
        `;
        const result = await db.query(sql, [parseInt(loanId, 10)]);

        // Calculate total amount paid across payments
        const totalPaid = result.rows.reduce(
            (sum, row) => sum + parseFloat(row.amount_paid || 0),
            0
        );

        return res.status(200).json({
            success: true,
            loan_id: parseInt(loanId, 10),
            loan_number: loanCheck.rows[0].loan_number,
            customer_name: loanCheck.rows[0].customer_name,
            loan_type: loanCheck.rows[0].loan_type,
            loan_amount: parseFloat(loanCheck.rows[0].loan_amount),
            loan_status: loanCheck.rows[0].status,
            total_amount_paid: totalPaid,
            count: result.rows.length,
            data: result.rows
        });
    } catch (err) {
        return handleDbError(err, res, `fetch payments for loan with ID ${loanId}`);
    }
};

/**
 * 4. Get Loan Payment by ID
 * Method: GET
 * Route: /api/loan-payments/:id
 *
 * Validates payment_id and returns payment record enriched with loan and customer details.
 * Returns 404 if payment record not found.
 */
const getLoanPaymentById = async (req, res) => {
    const { id } = req.params;

    if (!isValidPositiveInteger(id)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid payment ID. Payment ID must be a positive integer.'
        });
    }

    const sql = `
        SELECT
            lp.payment_id,
            lp.loan_id,
            lp.amount_paid,
            lp.payment_date,
            lp.payment_mode,
            l.loan_number,
            l.loan_type,
            l.loan_amount,
            l.status AS loan_status,
            c.customer_id,
            (c.first_name || ' ' || c.last_name) AS customer_name,
            c.email AS customer_email,
            b.branch_name,
            b.branch_code
        FROM Loan_Payment lp
        JOIN Loan l ON lp.loan_id = l.loan_id
        JOIN Customer c ON l.customer_id = c.customer_id
        JOIN Branch b ON l.branch_id = b.branch_id
        WHERE lp.payment_id = $1;
    `;
    const params = [parseInt(id, 10)];

    try {
        const result = await db.query(sql, params);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: `Loan payment with ID ${id} not found.`
            });
        }

        return res.status(200).json({
            success: true,
            data: result.rows[0]
        });
    } catch (err) {
        return handleDbError(err, res, `fetch loan payment with ID ${id}`);
    }
};

// =====================================================================
// Module Exports
// =====================================================================
module.exports = {
    recordLoanPayment,
    getAllLoanPayments,
    getPaymentsByLoan,
    getLoanPaymentById
};
