// =====================================================================
// College DBMS Project: Bank Management System
// Module: Loan, Employee & Branch Module
// Team Member: Pavi
// Controller: Loan Controller (backend/controllers/loanController.js)
// Description: Implements CRUD, Search, and Filtering operations for Loan entity
//              using parameterized raw SQL queries via node-postgres (pg).
// =====================================================================

const db = require('../config/db');

// Allowed enum values defined by PostgreSQL schema CHECK constraints
const ALLOWED_LOAN_TYPES = ['Personal', 'Home', 'Education', 'Vehicle'];
const ALLOWED_LOAN_STATUSES = ['Applied', 'Approved', 'Rejected', 'Closed'];

// =====================================================================
// Validation & Error Handling Helpers
// =====================================================================

/**
 * Validates whether an ID is a valid positive integer.
 * Used for URL route parameters (:id, :customerId, :branchId) and foreign keys.
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
 * Used for loan amounts and interest rates.
 * @param {string|number} val
 * @returns {boolean}
 */
const isValidPositiveNumber = (val) => {
    if (val === undefined || val === null || String(val).trim() === '') return false;
    const num = parseFloat(val);
    return !isNaN(num) && num > 0;
};

/**
 * Helper to match string against allowed values case-insensitively.
 * @param {string} val
 * @param {string[]} allowedList
 * @returns {string|null} Canonical string from allowedList or null if invalid
 */
const matchCaseInsensitive = (val, allowedList) => {
    if (!val || typeof val !== 'string') return null;
    const trimmed = val.trim().toLowerCase();
    return allowedList.find((item) => item.toLowerCase() === trimmed) || null;
};

/**
 * Handles database errors with college DBMS project friendliness:
 * - 23505: Unique constraint violation (duplicate loan_number)
 * - 23503: Foreign key violation (invalid customer_id or branch_id)
 * - 23514: Check constraint violation (invalid loan_type, loan_amount, interest_rate, duration, status)
 * - 500: Generic internal server error
 *
 * @param {Error} err - Caught error
 * @param {Object} res - Express response object
 * @param {string} actionDescription - Action context for logging
 */
const handleDbError = (err, res, actionDescription = 'process loan request') => {
    console.error(`Database Error during ${actionDescription}:`, {
        code: err.code,
        message: err.message,
        detail: err.detail,
        constraint: err.constraint
    });

    // 23505: Unique violation (loan_number already exists)
    if (err.code === '23505') {
        return res.status(409).json({
            success: false,
            message: 'A loan with this loan number already exists.'
        });
    }

    // 23503: Foreign key violation
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
            message: 'Database check constraint failed: Loan amount, interest rate, and duration must be greater than 0, with valid loan type and status.'
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
 * 1. Create a new Loan
 * Method: POST
 * Route: /api/loans
 *
 * Creates a loan for a valid customer and branch.
 * Required fields: loan_number, customer_id, branch_id, loan_type, loan_amount, interest_rate, duration_months
 * Optional fields: status (default 'Applied'), applied_date (default CURRENT_DATE)
 */
const createLoan = async (req, res) => {
    const {
        loan_number,
        customer_id,
        branch_id,
        loan_type,
        loan_amount,
        interest_rate,
        duration_months,
        status,
        applied_date
    } = req.body || {};

    // 1. Validate loan_number
    if (!loan_number || typeof loan_number !== 'string' || !loan_number.trim()) {
        return res.status(400).json({
            success: false,
            message: 'Loan number is required and cannot be empty.'
        });
    }
    if (loan_number.trim().length > 30) {
        return res.status(400).json({
            success: false,
            message: 'Loan number cannot exceed 30 characters.'
        });
    }

    // 2. Validate customer_id
    if (!isValidPositiveInteger(customer_id)) {
        return res.status(400).json({
            success: false,
            message: 'Customer ID is required and must be a positive integer.'
        });
    }

    // 3. Validate branch_id
    if (!isValidPositiveInteger(branch_id)) {
        return res.status(400).json({
            success: false,
            message: 'Branch ID is required and must be a positive integer.'
        });
    }

    // 4. Validate loan_type
    const matchedType = matchCaseInsensitive(loan_type, ALLOWED_LOAN_TYPES);
    if (!matchedType) {
        return res.status(400).json({
            success: false,
            message: `Invalid loan type '${loan_type}'. Allowed types: ${ALLOWED_LOAN_TYPES.join(', ')}.`
        });
    }

    // 5. Validate loan_amount
    if (!isValidPositiveNumber(loan_amount)) {
        return res.status(400).json({
            success: false,
            message: 'Loan amount is required and must be a positive number (> 0).'
        });
    }

    // 6. Validate interest_rate
    if (!isValidPositiveNumber(interest_rate)) {
        return res.status(400).json({
            success: false,
            message: 'Interest rate is required and must be a positive number (> 0).'
        });
    }

    // 7. Validate duration_months
    if (!isValidPositiveInteger(duration_months)) {
        return res.status(400).json({
            success: false,
            message: 'Duration in months is required and must be a positive integer (> 0).'
        });
    }

    // 8. Validate optional status (defaults to 'Applied')
    let finalStatus = 'Applied';
    if (status !== undefined && status !== null && String(status).trim() !== '') {
        const matchedStatus = matchCaseInsensitive(status, ALLOWED_LOAN_STATUSES);
        if (!matchedStatus) {
            return res.status(400).json({
                success: false,
                message: `Invalid loan status '${status}'. Allowed statuses: ${ALLOWED_LOAN_STATUSES.join(', ')}.`
            });
        }
        finalStatus = matchedStatus;
    }

    // 9. Validate optional applied_date
    let finalAppliedDate = null;
    if (applied_date !== undefined && applied_date !== null && String(applied_date).trim() !== '') {
        const dateStr = String(applied_date).trim();
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(dateStr)) {
            return res.status(400).json({
                success: false,
                message: 'Applied date must follow the YYYY-MM-DD format.'
            });
        }
        const parsedDate = new Date(dateStr);
        if (isNaN(parsedDate.getTime())) {
            return res.status(400).json({
                success: false,
                message: 'Invalid applied date provided.'
            });
        }
        finalAppliedDate = dateStr;
    }

    let sql;
    let params;

    if (finalAppliedDate) {
        sql = `
            INSERT INTO Loan (loan_number, customer_id, branch_id, loan_type, loan_amount, interest_rate, duration_months, status, applied_date)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING loan_id, loan_number, customer_id, branch_id, loan_type, loan_amount, interest_rate, duration_months, status, applied_date;
        `;
        params = [
            loan_number.trim(),
            parseInt(customer_id, 10),
            parseInt(branch_id, 10),
            matchedType,
            parseFloat(loan_amount),
            parseFloat(interest_rate),
            parseInt(duration_months, 10),
            finalStatus,
            finalAppliedDate
        ];
    } else {
        sql = `
            INSERT INTO Loan (loan_number, customer_id, branch_id, loan_type, loan_amount, interest_rate, duration_months, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING loan_id, loan_number, customer_id, branch_id, loan_type, loan_amount, interest_rate, duration_months, status, applied_date;
        `;
        params = [
            loan_number.trim(),
            parseInt(customer_id, 10),
            parseInt(branch_id, 10),
            matchedType,
            parseFloat(loan_amount),
            parseFloat(interest_rate),
            parseInt(duration_months, 10),
            finalStatus
        ];
    }

    try {
        const result = await db.query(sql, params);
        return res.status(201).json({
            success: true,
            message: 'Loan created successfully.',
            data: result.rows[0]
        });
    } catch (err) {
        return handleDbError(err, res, 'create loan');
    }
};

/**
 * 2. Get All Loans
 * Method: GET
 * Route: /api/loans
 *
 * Retrieves all loans enriched with customer and branch details via JOINs.
 */
const getAllLoans = async (req, res) => {
    const sql = `
        SELECT
            l.loan_id,
            l.loan_number,
            l.customer_id,
            l.branch_id,
            l.loan_type,
            l.loan_amount,
            l.interest_rate,
            l.duration_months,
            l.status,
            l.applied_date,
            c.first_name AS customer_first_name,
            c.last_name AS customer_last_name,
            (c.first_name || ' ' || c.last_name) AS customer_name,
            c.email AS customer_email,
            c.phone AS customer_phone,
            b.branch_name,
            b.branch_code,
            b.ifsc_code,
            b.city AS branch_city
        FROM Loan l
        JOIN Customer c ON l.customer_id = c.customer_id
        JOIN Branch b ON l.branch_id = b.branch_id
        ORDER BY l.loan_id ASC;
    `;

    try {
        const result = await db.query(sql);
        return res.status(200).json({
            success: true,
            count: result.rows.length,
            data: result.rows
        });
    } catch (err) {
        return handleDbError(err, res, 'fetch all loans');
    }
};

/**
 * 3. Search and Filter Loans
 * Method: GET
 * Route: /api/loans/search
 *
 * Supports searching and filtering loans using parameterized queries:
 *  - General keyword (?q=...): searches across loan_number, loan_type, status, customer_name, email, branch_name
 *  - Specific filters: ?loan_number=..., ?loan_type=..., ?status=..., ?customer_name=..., ?min_amount=..., ?max_amount=...
 */
const searchLoans = async (req, res) => {
    const { q, loan_number, loan_type, status, customer_name, min_amount, max_amount } = req.query;

    const conditions = [];
    const params = [];

    // General keyword search
    if (q && typeof q === 'string' && q.trim()) {
        params.push(`%${q.trim()}%`);
        const idx = params.length;
        conditions.push(`(
            l.loan_number ILIKE $${idx} OR 
            l.loan_type ILIKE $${idx} OR 
            l.status ILIKE $${idx} OR 
            (c.first_name || ' ' || c.last_name) ILIKE $${idx} OR 
            c.email ILIKE $${idx} OR 
            b.branch_name ILIKE $${idx} OR 
            b.branch_code ILIKE $${idx}
        )`);
    } else {
        // Targeted parameter filters
        if (loan_number && typeof loan_number === 'string' && loan_number.trim()) {
            params.push(`%${loan_number.trim()}%`);
            const idx = params.length;
            conditions.push(`l.loan_number ILIKE $${idx}`);
        }
        if (loan_type && typeof loan_type === 'string' && loan_type.trim()) {
            params.push(loan_type.trim());
            const idx = params.length;
            conditions.push(`l.loan_type ILIKE $${idx}`);
        }
        if (status && typeof status === 'string' && status.trim()) {
            params.push(status.trim());
            const idx = params.length;
            conditions.push(`l.status ILIKE $${idx}`);
        }
        if (customer_name && typeof customer_name === 'string' && customer_name.trim()) {
            params.push(`%${customer_name.trim()}%`);
            const idx = params.length;
            conditions.push(`(c.first_name ILIKE $${idx} OR c.last_name ILIKE $${idx} OR (c.first_name || ' ' || c.last_name) ILIKE $${idx})`);
        }
        if (min_amount !== undefined && min_amount !== null && String(min_amount).trim() !== '') {
            const minNum = parseFloat(min_amount);
            if (!isNaN(minNum) && minNum >= 0) {
                params.push(minNum);
                const idx = params.length;
                conditions.push(`l.loan_amount >= $${idx}`);
            }
        }
        if (max_amount !== undefined && max_amount !== null && String(max_amount).trim() !== '') {
            const maxNum = parseFloat(max_amount);
            if (!isNaN(maxNum) && maxNum >= 0) {
                params.push(maxNum);
                const idx = params.length;
                conditions.push(`l.loan_amount <= $${idx}`);
            }
        }
    }

    if (conditions.length === 0) {
        return res.status(400).json({
            success: false,
            message: 'Please provide at least one search/filter parameter (e.g., ?q=..., ?loan_number=..., ?loan_type=..., ?status=...).'
        });
    }

    const sql = `
        SELECT
            l.loan_id,
            l.loan_number,
            l.customer_id,
            l.branch_id,
            l.loan_type,
            l.loan_amount,
            l.interest_rate,
            l.duration_months,
            l.status,
            l.applied_date,
            c.first_name AS customer_first_name,
            c.last_name AS customer_last_name,
            (c.first_name || ' ' || c.last_name) AS customer_name,
            c.email AS customer_email,
            c.phone AS customer_phone,
            b.branch_name,
            b.branch_code,
            b.ifsc_code,
            b.city AS branch_city
        FROM Loan l
        JOIN Customer c ON l.customer_id = c.customer_id
        JOIN Branch b ON l.branch_id = b.branch_id
        WHERE ${conditions.join(' AND ')}
        ORDER BY l.loan_id ASC;
    `;

    try {
        const result = await db.query(sql, params);
        return res.status(200).json({
            success: true,
            count: result.rows.length,
            data: result.rows
        });
    } catch (err) {
        return handleDbError(err, res, 'search loans');
    }
};

/**
 * 4. Get Loans for a Specific Customer
 * Method: GET
 * Route: /api/loans/customer/:customerId
 *
 * Retrieves all loans associated with a customer.
 * Returns 404 if customer not found.
 */
const getLoansByCustomer = async (req, res) => {
    const { customerId } = req.params;

    if (!isValidPositiveInteger(customerId)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid customer ID. Customer ID must be a positive integer.'
        });
    }

    try {
        // Verify customer existence
        const customerCheck = await db.query(
            'SELECT customer_id, first_name, last_name FROM Customer WHERE customer_id = $1;',
            [parseInt(customerId, 10)]
        );
        if (customerCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: `Customer with ID ${customerId} not found.`
            });
        }

        const sql = `
            SELECT
                l.loan_id,
                l.loan_number,
                l.customer_id,
                l.branch_id,
                l.loan_type,
                l.loan_amount,
                l.interest_rate,
                l.duration_months,
                l.status,
                l.applied_date,
                c.first_name AS customer_first_name,
                c.last_name AS customer_last_name,
                (c.first_name || ' ' || c.last_name) AS customer_name,
                c.email AS customer_email,
                b.branch_name,
                b.branch_code,
                b.ifsc_code,
                b.city AS branch_city
            FROM Loan l
            JOIN Customer c ON l.customer_id = c.customer_id
            JOIN Branch b ON l.branch_id = b.branch_id
            WHERE l.customer_id = $1
            ORDER BY l.loan_id ASC;
        `;
        const result = await db.query(sql, [parseInt(customerId, 10)]);

        return res.status(200).json({
            success: true,
            customer_id: parseInt(customerId, 10),
            customer_name: `${customerCheck.rows[0].first_name} ${customerCheck.rows[0].last_name}`,
            count: result.rows.length,
            data: result.rows
        });
    } catch (err) {
        return handleDbError(err, res, `fetch loans for customer ${customerId}`);
    }
};

/**
 * 5. Get Loans for a Specific Branch
 * Method: GET
 * Route: /api/loans/branch/:branchId
 *
 * Retrieves all loans disbursed/managed by a specific branch.
 * Returns 404 if branch not found.
 */
const getLoansByBranch = async (req, res) => {
    const { branchId } = req.params;

    if (!isValidPositiveInteger(branchId)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid branch ID. Branch ID must be a positive integer.'
        });
    }

    try {
        // Verify branch existence
        const branchCheck = await db.query(
            'SELECT branch_id, branch_name FROM Branch WHERE branch_id = $1;',
            [parseInt(branchId, 10)]
        );
        if (branchCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: `Branch with ID ${branchId} not found.`
            });
        }

        const sql = `
            SELECT
                l.loan_id,
                l.loan_number,
                l.customer_id,
                l.branch_id,
                l.loan_type,
                l.loan_amount,
                l.interest_rate,
                l.duration_months,
                l.status,
                l.applied_date,
                c.first_name AS customer_first_name,
                c.last_name AS customer_last_name,
                (c.first_name || ' ' || c.last_name) AS customer_name,
                c.email AS customer_email,
                b.branch_name,
                b.branch_code,
                b.ifsc_code,
                b.city AS branch_city
            FROM Loan l
            JOIN Customer c ON l.customer_id = c.customer_id
            JOIN Branch b ON l.branch_id = b.branch_id
            WHERE l.branch_id = $1
            ORDER BY l.loan_id ASC;
        `;
        const result = await db.query(sql, [parseInt(branchId, 10)]);

        return res.status(200).json({
            success: true,
            branch_id: parseInt(branchId, 10),
            branch_name: branchCheck.rows[0].branch_name,
            count: result.rows.length,
            data: result.rows
        });
    } catch (err) {
        return handleDbError(err, res, `fetch loans for branch ${branchId}`);
    }
};

/**
 * 6. Get Loans by Status
 * Method: GET
 * Route: /api/loans/status/:status
 *
 * Retrieves all loans with a given status ('Applied', 'Approved', 'Rejected', 'Closed').
 * Validates status against allowed enum values.
 */
const getLoansByStatus = async (req, res) => {
    const { status } = req.params;

    const matchedStatus = matchCaseInsensitive(status, ALLOWED_LOAN_STATUSES);
    if (!matchedStatus) {
        return res.status(400).json({
            success: false,
            message: `Invalid loan status '${status}'. Allowed statuses: ${ALLOWED_LOAN_STATUSES.join(', ')}.`
        });
    }

    const sql = `
        SELECT
            l.loan_id,
            l.loan_number,
            l.customer_id,
            l.branch_id,
            l.loan_type,
            l.loan_amount,
            l.interest_rate,
            l.duration_months,
            l.status,
            l.applied_date,
            c.first_name AS customer_first_name,
            c.last_name AS customer_last_name,
            (c.first_name || ' ' || c.last_name) AS customer_name,
            c.email AS customer_email,
            b.branch_name,
            b.branch_code,
            b.ifsc_code,
            b.city AS branch_city
        FROM Loan l
        JOIN Customer c ON l.customer_id = c.customer_id
        JOIN Branch b ON l.branch_id = b.branch_id
        WHERE l.status = $1
        ORDER BY l.loan_id ASC;
    `;
    const params = [matchedStatus];

    try {
        const result = await db.query(sql, params);
        return res.status(200).json({
            success: true,
            status: matchedStatus,
            count: result.rows.length,
            data: result.rows
        });
    } catch (err) {
        return handleDbError(err, res, `fetch loans with status ${status}`);
    }
};

/**
 * 7. Get Loan by ID
 * Method: GET
 * Route: /api/loans/:id
 *
 * Validates loan_id as positive integer and returns loan joined with customer and branch.
 * Returns 404 if loan not found.
 */
const getLoanById = async (req, res) => {
    const { id } = req.params;

    if (!isValidPositiveInteger(id)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid loan ID. Loan ID must be a positive integer.'
        });
    }

    const sql = `
        SELECT
            l.loan_id,
            l.loan_number,
            l.customer_id,
            l.branch_id,
            l.loan_type,
            l.loan_amount,
            l.interest_rate,
            l.duration_months,
            l.status,
            l.applied_date,
            c.first_name AS customer_first_name,
            c.last_name AS customer_last_name,
            (c.first_name || ' ' || c.last_name) AS customer_name,
            c.email AS customer_email,
            c.phone AS customer_phone,
            b.branch_name,
            b.branch_code,
            b.ifsc_code,
            b.city AS branch_city
        FROM Loan l
        JOIN Customer c ON l.customer_id = c.customer_id
        JOIN Branch b ON l.branch_id = b.branch_id
        WHERE l.loan_id = $1;
    `;
    const params = [parseInt(id, 10)];

    try {
        const result = await db.query(sql, params);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: `Loan with ID ${id} not found.`
            });
        }

        return res.status(200).json({
            success: true,
            data: result.rows[0]
        });
    } catch (err) {
        return handleDbError(err, res, `fetch loan with ID ${id}`);
    }
};

/**
 * 8. Update Loan Details
 * Method: PUT
 * Route: /api/loans/:id
 *
 * Validates loan_id and updates provided loan fields.
 * Handles duplicate loan_number (23505), foreign key (23503), check constraints (23514).
 * Returns 404 if loan not found.
 */
const updateLoan = async (req, res) => {
    const { id } = req.params;

    if (!isValidPositiveInteger(id)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid loan ID. Loan ID must be a positive integer.'
        });
    }

    const {
        loan_number,
        customer_id,
        branch_id,
        loan_type,
        loan_amount,
        interest_rate,
        duration_months,
        status,
        applied_date
    } = req.body || {};

    const updates = [];
    const params = [];

    // Validate loan_number
    if (loan_number !== undefined) {
        if (typeof loan_number !== 'string' || !loan_number.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Loan number cannot be empty.'
            });
        }
        if (loan_number.trim().length > 30) {
            return res.status(400).json({
                success: false,
                message: 'Loan number cannot exceed 30 characters.'
            });
        }
        params.push(loan_number.trim());
        updates.push(`loan_number = $${params.length}`);
    }

    // Validate customer_id
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

    // Validate branch_id
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

    // Validate loan_type
    if (loan_type !== undefined) {
        const matchedType = matchCaseInsensitive(loan_type, ALLOWED_LOAN_TYPES);
        if (!matchedType) {
            return res.status(400).json({
                success: false,
                message: `Invalid loan type '${loan_type}'. Allowed types: ${ALLOWED_LOAN_TYPES.join(', ')}.`
            });
        }
        params.push(matchedType);
        updates.push(`loan_type = $${params.length}`);
    }

    // Validate loan_amount
    if (loan_amount !== undefined) {
        if (!isValidPositiveNumber(loan_amount)) {
            return res.status(400).json({
                success: false,
                message: 'Loan amount must be a positive number (> 0).'
            });
        }
        params.push(parseFloat(loan_amount));
        updates.push(`loan_amount = $${params.length}`);
    }

    // Validate interest_rate
    if (interest_rate !== undefined) {
        if (!isValidPositiveNumber(interest_rate)) {
            return res.status(400).json({
                success: false,
                message: 'Interest rate must be a positive number (> 0).'
            });
        }
        params.push(parseFloat(interest_rate));
        updates.push(`interest_rate = $${params.length}`);
    }

    // Validate duration_months
    if (duration_months !== undefined) {
        if (!isValidPositiveInteger(duration_months)) {
            return res.status(400).json({
                success: false,
                message: 'Duration in months must be a positive integer (> 0).'
            });
        }
        params.push(parseInt(duration_months, 10));
        updates.push(`duration_months = $${params.length}`);
    }

    // Validate status
    if (status !== undefined) {
        const matchedStatus = matchCaseInsensitive(status, ALLOWED_LOAN_STATUSES);
        if (!matchedStatus) {
            return res.status(400).json({
                success: false,
                message: `Invalid loan status '${status}'. Allowed statuses: ${ALLOWED_LOAN_STATUSES.join(', ')}.`
            });
        }
        params.push(matchedStatus);
        updates.push(`status = $${params.length}`);
    }

    // Validate applied_date
    if (applied_date !== undefined) {
        if (applied_date === null || String(applied_date).trim() === '') {
            return res.status(400).json({
                success: false,
                message: 'Applied date cannot be empty.'
            });
        }
        const dateStr = String(applied_date).trim();
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(dateStr)) {
            return res.status(400).json({
                success: false,
                message: 'Applied date must follow the YYYY-MM-DD format.'
            });
        }
        const parsedDate = new Date(dateStr);
        if (isNaN(parsedDate.getTime())) {
            return res.status(400).json({
                success: false,
                message: 'Invalid applied date provided.'
            });
        }
        params.push(dateStr);
        updates.push(`applied_date = $${params.length}`);
    }

    if (updates.length === 0) {
        return res.status(400).json({
            success: false,
            message: 'Please provide at least one valid loan field to update.'
        });
    }

    params.push(parseInt(id, 10));
    const sql = `
        UPDATE Loan
        SET ${updates.join(', ')}
        WHERE loan_id = $${params.length}
        RETURNING loan_id, loan_number, customer_id, branch_id, loan_type, loan_amount, interest_rate, duration_months, status, applied_date;
    `;

    try {
        const result = await db.query(sql, params);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: `Loan with ID ${id} not found.`
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Loan updated successfully.',
            data: result.rows[0]
        });
    } catch (err) {
        return handleDbError(err, res, `update loan with ID ${id}`);
    }
};

/**
 * 9. Update Loan Status
 * Method: PATCH
 * Route: /api/loans/:id/status
 *
 * Dedicated endpoint to transition a loan's status (Applied -> Approved / Rejected / Closed).
 * Validates status against allowed enum values.
 * Returns 404 if loan not found.
 */
const updateLoanStatus = async (req, res) => {
    const { id } = req.params;

    if (!isValidPositiveInteger(id)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid loan ID. Loan ID must be a positive integer.'
        });
    }

    const { status } = req.body || {};

    if (!status || typeof status !== 'string' || !status.trim()) {
        return res.status(400).json({
            success: false,
            message: `Status is required. Allowed statuses: ${ALLOWED_LOAN_STATUSES.join(', ')}.`
        });
    }

    const matchedStatus = matchCaseInsensitive(status, ALLOWED_LOAN_STATUSES);
    if (!matchedStatus) {
        return res.status(400).json({
            success: false,
            message: `Invalid loan status '${status}'. Allowed statuses: ${ALLOWED_LOAN_STATUSES.join(', ')}.`
        });
    }

    const sql = `
        UPDATE Loan
        SET status = $1
        WHERE loan_id = $2
        RETURNING loan_id, loan_number, customer_id, branch_id, loan_type, loan_amount, interest_rate, duration_months, status, applied_date;
    `;
    const params = [matchedStatus, parseInt(id, 10)];

    try {
        const result = await db.query(sql, params);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: `Loan with ID ${id} not found.`
            });
        }

        return res.status(200).json({
            success: true,
            message: `Loan status successfully updated to '${matchedStatus}'.`,
            data: result.rows[0]
        });
    } catch (err) {
        return handleDbError(err, res, `update status for loan with ID ${id}`);
    }
};

// =====================================================================
// Module Exports
// =====================================================================
module.exports = {
    createLoan,
    getAllLoans,
    searchLoans,
    getLoansByCustomer,
    getLoansByBranch,
    getLoansByStatus,
    getLoanById,
    updateLoan,
    updateLoanStatus
};
