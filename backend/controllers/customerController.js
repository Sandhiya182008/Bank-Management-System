// =====================================================================
// College DBMS Project: Bank Management System
// Module: Customer & Account Module
// Team Member: Sadhana
// Controller: Customer Controller (backend/controllers/customerController.js)
// Description: Implements CRUD and Search operations for Customer entity
//              using parameterized raw SQL queries via node-postgres (pg).
// =====================================================================

const db = require('../config/db');

// =====================================================================
// Validation & Error Handling Helpers
// =====================================================================

/**
 * Validates whether an ID is a valid positive integer.
 * Used for URL route parameters (:id).
 * @param {string|number} id
 * @returns {boolean}
 */
const isValidPositiveInteger = (id) => {
    if (id === undefined || id === null) return false;
    const str = String(id).trim();
    return /^[1-9]\d*$/.test(str);
};

/**
 * Validates customer input data according to the Customer table schema.
 * Schema constraints:
 *   - first_name: VARCHAR(50) NOT NULL
 *   - last_name:  VARCHAR(50) NOT NULL
 *   - email:      VARCHAR(100) UNIQUE NOT NULL
 *   - phone:      VARCHAR(15) UNIQUE NOT NULL
 *   - address:    TEXT (optional)
 *   - date_of_birth: DATE (optional, YYYY-MM-DD)
 *
 * @param {Object} body - Request body
 * @returns {Object} { isValid: boolean, message?: string, data?: Object }
 */
const validateCustomerInput = (body) => {
    if (!body || typeof body !== 'object') {
        return {
            isValid: false,
            message: 'Request body must be a valid JSON object.'
        };
    }

    const { first_name, last_name, email, phone, address, date_of_birth } = body;

    // 1. Required fields check
    if (!first_name || typeof first_name !== 'string' || !first_name.trim()) {
        return { isValid: false, message: 'First name is required and cannot be empty.' };
    }
    if (!last_name || typeof last_name !== 'string' || !last_name.trim()) {
        return { isValid: false, message: 'Last name is required and cannot be empty.' };
    }
    if (!email || typeof email !== 'string' || !email.trim()) {
        return { isValid: false, message: 'Email address is required and cannot be empty.' };
    }
    if (!phone || typeof phone !== 'string' || !phone.trim()) {
        return { isValid: false, message: 'Phone number is required and cannot be empty.' };
    }

    // 2. Length constraints
    if (first_name.trim().length > 50) {
        return { isValid: false, message: 'First name cannot exceed 50 characters.' };
    }
    if (last_name.trim().length > 50) {
        return { isValid: false, message: 'Last name cannot exceed 50 characters.' };
    }
    if (email.trim().length > 100) {
        return { isValid: false, message: 'Email cannot exceed 100 characters.' };
    }
    if (phone.trim().length > 15) {
        return { isValid: false, message: 'Phone number cannot exceed 15 characters.' };
    }

    // 3. Format validations
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
        return { isValid: false, message: 'Invalid email address format.' };
    }

    const phoneRegex = /^[\d\s+\-()]{7,15}$/;
    if (!phoneRegex.test(phone.trim())) {
        return { isValid: false, message: 'Invalid phone number format (must contain 7-15 valid phone characters).' };
    }

    // 4. Optional date_of_birth validation
    let formattedDob = null;
    if (date_of_birth !== undefined && date_of_birth !== null && String(date_of_birth).trim() !== '') {
        const dobStr = String(date_of_birth).trim();
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(dobStr)) {
            return { isValid: false, message: 'Date of birth must follow the YYYY-MM-DD format.' };
        }

        const parsedDate = new Date(dobStr);
        if (isNaN(parsedDate.getTime())) {
            return { isValid: false, message: 'Invalid date of birth provided.' };
        }

        if (parsedDate > new Date()) {
            return { isValid: false, message: 'Date of birth cannot be in the future.' };
        }
        formattedDob = dobStr;
    }

    return {
        isValid: true,
        data: {
            first_name: first_name.trim(),
            last_name: last_name.trim(),
            email: email.trim().toLowerCase(),
            phone: phone.trim(),
            address: address && typeof address === 'string' && address.trim() ? address.trim() : null,
            date_of_birth: formattedDob
        }
    };
};

/**
 * Handles database errors with college DBMS project friendliness:
 * - Specific handling for PostgreSQL Unique Constraint (23505)
 * - Specific handling for Foreign Key Restriction (23503)
 * - Safe generic error messages to client while logging full trace to server console
 *
 * @param {Error} err - Caught error
 * @param {Object} res - Express response object
 * @param {string} actionDescription - Action context for logging
 */
const handleDbError = (err, res, actionDescription = 'process request') => {
    console.error(`Database Error during ${actionDescription}:`, {
        code: err.code,
        message: err.message,
        detail: err.detail,
        constraint: err.constraint
    });

    // 23505: Unique violation (email or phone already registered)
    if (err.code === '23505') {
        const detail = (err.detail || '').toLowerCase();
        const constraint = (err.constraint || '').toLowerCase();

        if (detail.includes('email') || constraint.includes('email')) {
            return res.status(409).json({
                success: false,
                message: 'A customer with this email address already exists.'
            });
        }
        if (detail.includes('phone') || constraint.includes('phone')) {
            return res.status(409).json({
                success: false,
                message: 'A customer with this phone number already exists.'
            });
        }
        return res.status(409).json({
            success: false,
            message: 'Duplicate value conflict: email or phone already registered.'
        });
    }

    // 23503: Foreign key restriction violation (e.g. Account or Loan references Customer)
    if (err.code === '23503') {
        return res.status(409).json({
            success: false,
            message: 'Cannot delete customer because active bank accounts or loans are linked to this customer record. Close or remove linked records first.'
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
 * 1. Create a new Customer
 * Method: POST
 * Route: /api/customers
 *
 * Inserts a new customer record into PostgreSQL Customer table.
 * Validates required fields and catches duplicate email/phone (23505).
 */
const createCustomer = async (req, res) => {
    const validation = validateCustomerInput(req.body);
    if (!validation.isValid) {
        return res.status(400).json({
            success: false,
            message: validation.message
        });
    }

    const { first_name, last_name, email, phone, address, date_of_birth } = validation.data;

    const sql = `
        INSERT INTO Customer (first_name, last_name, email, phone, address, date_of_birth)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING customer_id, first_name, last_name, email, phone, address, date_of_birth, created_at;
    `;
    const params = [first_name, last_name, email, phone, address, date_of_birth];

    try {
        const result = await db.query(sql, params);
        return res.status(201).json({
            success: true,
            message: 'Customer created successfully.',
            data: result.rows[0]
        });
    } catch (err) {
        return handleDbError(err, res, 'create customer');
    }
};

/**
 * 2. Get All Customers
 * Method: GET
 * Route: /api/customers
 *
 * Fetches all registered customers ordered by customer_id ascending.
 */
const getAllCustomers = async (req, res) => {
    const sql = `
        SELECT customer_id, first_name, last_name, email, phone, address, date_of_birth, created_at
        FROM Customer
        ORDER BY customer_id ASC;
    `;

    try {
        const result = await db.query(sql);
        return res.status(200).json({
            success: true,
            count: result.rows.length,
            data: result.rows
        });
    } catch (err) {
        return handleDbError(err, res, 'fetch all customers');
    }
};

/**
 * 3. Get Customer by ID
 * Method: GET
 * Route: /api/customers/:id
 *
 * Validates customer_id as positive integer and retrieves the matching record.
 * Returns 404 if customer does not exist.
 */
const getCustomerById = async (req, res) => {
    const { id } = req.params;

    if (!isValidPositiveInteger(id)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid customer ID. Customer ID must be a positive integer.'
        });
    }

    const sql = `
        SELECT customer_id, first_name, last_name, email, phone, address, date_of_birth, created_at
        FROM Customer
        WHERE customer_id = $1;
    `;
    const params = [parseInt(id, 10)];

    try {
        const result = await db.query(sql, params);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: `Customer with ID ${id} not found.`
            });
        }

        return res.status(200).json({
            success: true,
            data: result.rows[0]
        });
    } catch (err) {
        return handleDbError(err, res, `fetch customer with ID ${id}`);
    }
};

/**
 * 4. Update Customer
 * Method: PUT
 * Route: /api/customers/:id
 *
 * Validates customer_id and input payload, then updates the customer record.
 * Handles duplicate constraints (23505) and returns 404 if customer not found.
 */
const updateCustomer = async (req, res) => {
    const { id } = req.params;

    if (!isValidPositiveInteger(id)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid customer ID. Customer ID must be a positive integer.'
        });
    }

    const validation = validateCustomerInput(req.body);
    if (!validation.isValid) {
        return res.status(400).json({
            success: false,
            message: validation.message
        });
    }

    const { first_name, last_name, email, phone, address, date_of_birth } = validation.data;

    const sql = `
        UPDATE Customer
        SET first_name = $1,
            last_name = $2,
            email = $3,
            phone = $4,
            address = $5,
            date_of_birth = $6
        WHERE customer_id = $7
        RETURNING customer_id, first_name, last_name, email, phone, address, date_of_birth, created_at;
    `;
    const params = [first_name, last_name, email, phone, address, date_of_birth, parseInt(id, 10)];

    try {
        const result = await db.query(sql, params);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: `Customer with ID ${id} not found.`
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Customer updated successfully.',
            data: result.rows[0]
        });
    } catch (err) {
        return handleDbError(err, res, `update customer with ID ${id}`);
    }
};

/**
 * 5. Delete Customer
 * Method: DELETE
 * Route: /api/customers/:id
 *
 * Validates customer_id and deletes the customer record.
 * Handles foreign-key restriction error (23503) if customer has linked accounts/loans.
 * Returns 404 if customer not found.
 */
const deleteCustomer = async (req, res) => {
    const { id } = req.params;

    if (!isValidPositiveInteger(id)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid customer ID. Customer ID must be a positive integer.'
        });
    }

    const sql = `
        DELETE FROM Customer
        WHERE customer_id = $1
        RETURNING customer_id, first_name, last_name;
    `;
    const params = [parseInt(id, 10)];

    try {
        const result = await db.query(sql, params);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: `Customer with ID ${id} not found.`
            });
        }

        return res.status(200).json({
            success: true,
            message: `Customer with ID ${id} (${result.rows[0].first_name} ${result.rows[0].last_name}) deleted successfully.`,
            data: result.rows[0]
        });
    } catch (err) {
        return handleDbError(err, res, `delete customer with ID ${id}`);
    }
};

/**
 * 6. Search Customers
 * Method: GET
 * Route: /api/customers/search
 *
 * Supports flexible parameterized search queries:
 *  - General query parameter (?q=...): Searches across first_name, last_name,
 *    combined full name, email, and phone.
 *  - Targeted parameters: ?name=..., ?email=..., ?phone=...
 */
const searchCustomers = async (req, res) => {
    const { q, name, email, phone } = req.query;

    const conditions = [];
    const params = [];

    // General keyword search across multiple columns
    if (q && typeof q === 'string' && q.trim()) {
        params.push(`%${q.trim()}%`);
        const idx = params.length;
        conditions.push(`(first_name ILIKE $${idx} OR last_name ILIKE $${idx} OR (first_name || ' ' || last_name) ILIKE $${idx} OR email ILIKE $${idx} OR phone ILIKE $${idx})`);
    } else {
        // Individual field search
        if (name && typeof name === 'string' && name.trim()) {
            params.push(`%${name.trim()}%`);
            const idx = params.length;
            conditions.push(`(first_name ILIKE $${idx} OR last_name ILIKE $${idx} OR (first_name || ' ' || last_name) ILIKE $${idx})`);
        }
        if (email && typeof email === 'string' && email.trim()) {
            params.push(`%${email.trim()}%`);
            const idx = params.length;
            conditions.push(`email ILIKE $${idx}`);
        }
        if (phone && typeof phone === 'string' && phone.trim()) {
            params.push(`%${phone.trim()}%`);
            const idx = params.length;
            conditions.push(`phone ILIKE $${idx}`);
        }
    }

    if (conditions.length === 0) {
        return res.status(400).json({
            success: false,
            message: 'Please provide at least one search parameter (e.g., ?q=keyword, ?name=..., ?email=..., ?phone=...).'
        });
    }

    const sql = `
        SELECT customer_id, first_name, last_name, email, phone, address, date_of_birth, created_at
        FROM Customer
        WHERE ${conditions.join(' AND ')}
        ORDER BY customer_id ASC;
    `;

    try {
        const result = await db.query(sql, params);
        return res.status(200).json({
            success: true,
            count: result.rows.length,
            data: result.rows
        });
    } catch (err) {
        return handleDbError(err, res, 'search customers');
    }
};

// =====================================================================
// Module Exports
// =====================================================================
module.exports = {
    createCustomer,
    getAllCustomers,
    getCustomerById,
    updateCustomer,
    deleteCustomer,
    searchCustomers
};
