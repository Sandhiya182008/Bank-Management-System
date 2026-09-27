// =====================================================================
// College DBMS Project: Bank Management System
// Module: Loan, Employee & Branch Module
// Team Member: Pavi
// Controller: Employee Controller (backend/controllers/employeeController.js)
// Description: Implements CRUD and Search operations for Employee entity
//              using parameterized raw SQL queries via node-postgres (pg).
// =====================================================================

const db = require('../config/db');

// Allowed enum values defined by PostgreSQL schema CHECK constraint
const ALLOWED_EMPLOYEE_ROLES = ['Manager', 'Cashier', 'Loan Officer', 'Clerk'];

// =====================================================================
// Validation & Error Handling Helpers
// =====================================================================

/**
 * Validates whether an ID is a valid positive integer.
 * Used for URL route parameters (:id, :branchId) and foreign keys.
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
 * Used for employee salary.
 * @param {string|number} val
 * @returns {boolean}
 */
const isValidPositiveNumber = (val) => {
    if (val === undefined || val === null || String(val).trim() === '') return false;
    const num = parseFloat(val);
    return !isNaN(num) && num > 0;
};

/**
 * Validates employee input data according to Employee table schema and check constraints.
 * @param {Object} body - Request payload
 * @param {boolean} isUpdate - Whether this validation is for an update (optional fields)
 * @returns {Object} { isValid: boolean, message?: string, data?: Object }
 */
const validateEmployeeInput = (body, isUpdate = false) => {
    if (!body || typeof body !== 'object') {
        return { isValid: false, message: 'Request body must be a valid JSON object.' };
    }

    const { branch_id, first_name, last_name, email, phone, role, salary, joining_date } = body;
    const validatedData = {};

    // 1. Validate branch_id
    if (!isUpdate || branch_id !== undefined) {
        if (!isValidPositiveInteger(branch_id)) {
            return { isValid: false, message: 'Branch ID is required and must be a positive integer.' };
        }
        validatedData.branch_id = parseInt(branch_id, 10);
    }

    // 2. Validate first_name
    if (!isUpdate || first_name !== undefined) {
        if (!first_name || typeof first_name !== 'string' || !first_name.trim()) {
            return { isValid: false, message: 'First name is required and cannot be empty.' };
        }
        if (first_name.trim().length > 50) {
            return { isValid: false, message: 'First name cannot exceed 50 characters.' };
        }
        validatedData.first_name = first_name.trim();
    }

    // 3. Validate last_name
    if (!isUpdate || last_name !== undefined) {
        if (!last_name || typeof last_name !== 'string' || !last_name.trim()) {
            return { isValid: false, message: 'Last name is required and cannot be empty.' };
        }
        if (last_name.trim().length > 50) {
            return { isValid: false, message: 'Last name cannot exceed 50 characters.' };
        }
        validatedData.last_name = last_name.trim();
    }

    // 4. Validate email
    if (!isUpdate || email !== undefined) {
        if (!email || typeof email !== 'string' || !email.trim()) {
            return { isValid: false, message: 'Email is required and cannot be empty.' };
        }
        if (email.trim().length > 100) {
            return { isValid: false, message: 'Email cannot exceed 100 characters.' };
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
            return { isValid: false, message: 'Invalid email address format.' };
        }
        validatedData.email = email.trim().toLowerCase();
    }

    // 5. Validate role
    if (!isUpdate || role !== undefined) {
        if (!role || typeof role !== 'string' || !role.trim()) {
            return {
                isValid: false,
                message: `Role is required. Allowed roles: ${ALLOWED_EMPLOYEE_ROLES.join(', ')}.`
            };
        }
        const trimmedRole = role.trim();
        // Match case-insensitively with allowed roles
        const matchedRole = ALLOWED_EMPLOYEE_ROLES.find(
            (r) => r.toLowerCase() === trimmedRole.toLowerCase()
        );
        if (!matchedRole) {
            return {
                isValid: false,
                message: `Invalid role '${trimmedRole}'. Allowed roles: ${ALLOWED_EMPLOYEE_ROLES.join(', ')}.`
            };
        }
        validatedData.role = matchedRole;
    }

    // 6. Validate salary
    if (!isUpdate || salary !== undefined) {
        if (!isValidPositiveNumber(salary)) {
            return { isValid: false, message: 'Salary is required and must be a positive number (> 0).' };
        }
        validatedData.salary = parseFloat(salary);
    }

    // 7. Validate optional phone
    if (phone !== undefined) {
        if (phone === null || String(phone).trim() === '') {
            validatedData.phone = null;
        } else {
            const phoneStr = String(phone).trim();
            if (phoneStr.length > 15) {
                return { isValid: false, message: 'Phone number cannot exceed 15 characters.' };
            }
            const phoneRegex = /^[\d\s+\-()]{7,15}$/;
            if (!phoneRegex.test(phoneStr)) {
                return { isValid: false, message: 'Invalid phone number format (must contain 7-15 valid phone characters).' };
            }
            validatedData.phone = phoneStr;
        }
    } else if (!isUpdate) {
        validatedData.phone = null;
    }

    // 8. Validate optional joining_date
    if (joining_date !== undefined) {
        if (joining_date === null || String(joining_date).trim() === '') {
            validatedData.joining_date = null;
        } else {
            const dateStr = String(joining_date).trim();
            const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
            if (!dateRegex.test(dateStr)) {
                return { isValid: false, message: 'Joining date must follow the YYYY-MM-DD format.' };
            }
            const parsedDate = new Date(dateStr);
            if (isNaN(parsedDate.getTime())) {
                return { isValid: false, message: 'Invalid joining date provided.' };
            }
            validatedData.joining_date = dateStr;
        }
    }

    return { isValid: true, data: validatedData };
};

/**
 * Handles database errors with college DBMS project friendliness:
 * - 23505: Unique violation (e.g. employee email already registered)
 * - 23503: Foreign key violation (e.g. invalid branch_id)
 * - 23514: Check constraint violation (e.g. invalid role, non-positive salary)
 * - 500: Generic internal server error
 *
 * @param {Error} err - Caught error
 * @param {Object} res - Express response object
 * @param {string} actionDescription - Action context for logging
 */
const handleDbError = (err, res, actionDescription = 'process employee request') => {
    console.error(`Database Error during ${actionDescription}:`, {
        code: err.code,
        message: err.message,
        detail: err.detail,
        constraint: err.constraint
    });

    // 23505: Unique constraint violation (email)
    if (err.code === '23505') {
        return res.status(409).json({
            success: false,
            message: 'An employee with this email address already exists.'
        });
    }

    // 23503: Foreign key violation (branch_id)
    if (err.code === '23503') {
        return res.status(400).json({
            success: false,
            message: 'Invalid branch: The specified branch does not exist.'
        });
    }

    // 23514: Check constraint violation
    if (err.code === '23514') {
        return res.status(400).json({
            success: false,
            message: `Check constraint failed: Role must be one of [${ALLOWED_EMPLOYEE_ROLES.join(', ')}] and salary must be greater than 0.`
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
 * 1. Create a new Employee
 * Method: POST
 * Route: /api/employees
 *
 * Creates an employee under a specific branch.
 * Validates branch_id, first_name, last_name, email, role, salary.
 * Optional fields: phone, joining_date (defaults to CURRENT_DATE in DB).
 */
const createEmployee = async (req, res) => {
    const validation = validateEmployeeInput(req.body, false);
    if (!validation.isValid) {
        return res.status(400).json({
            success: false,
            message: validation.message
        });
    }

    const { branch_id, first_name, last_name, email, phone, role, salary, joining_date } = validation.data;

    let sql;
    let params;

    if (joining_date) {
        sql = `
            INSERT INTO Employee (branch_id, first_name, last_name, email, phone, role, salary, joining_date)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING employee_id, branch_id, first_name, last_name, email, phone, role, salary, joining_date;
        `;
        params = [branch_id, first_name, last_name, email, phone, role, salary, joining_date];
    } else {
        sql = `
            INSERT INTO Employee (branch_id, first_name, last_name, email, phone, role, salary)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING employee_id, branch_id, first_name, last_name, email, phone, role, salary, joining_date;
        `;
        params = [branch_id, first_name, last_name, email, phone, role, salary];
    }

    try {
        const result = await db.query(sql, params);
        return res.status(201).json({
            success: true,
            message: 'Employee created successfully.',
            data: result.rows[0]
        });
    } catch (err) {
        return handleDbError(err, res, 'create employee');
    }
};

/**
 * 2. Get All Employees
 * Method: GET
 * Route: /api/employees
 *
 * Retrieves all employees enriched with branch details via JOIN.
 */
const getAllEmployees = async (req, res) => {
    const sql = `
        SELECT
            e.employee_id,
            e.branch_id,
            e.first_name,
            e.last_name,
            (e.first_name || ' ' || e.last_name) AS full_name,
            e.email,
            e.phone,
            e.role,
            e.salary,
            e.joining_date,
            b.branch_name,
            b.branch_code,
            b.ifsc_code,
            b.city AS branch_city
        FROM Employee e
        JOIN Branch b ON e.branch_id = b.branch_id
        ORDER BY e.employee_id ASC;
    `;

    try {
        const result = await db.query(sql);
        return res.status(200).json({
            success: true,
            count: result.rows.length,
            data: result.rows
        });
    } catch (err) {
        return handleDbError(err, res, 'fetch all employees');
    }
};

/**
 * 3. Search Employees
 * Method: GET
 * Route: /api/employees/search
 *
 * Supports flexible parameterized search queries by name, email, role, or branch:
 *  - General keyword (?q=...): Searches across first_name, last_name, full name, email, role, branch_name, branch_code
 *  - Specific fields: ?name=..., ?email=..., ?role=..., ?branch=...
 */
const searchEmployees = async (req, res) => {
    const { q, name, email, role, branch } = req.query;

    const conditions = [];
    const params = [];

    // General keyword search
    if (q && typeof q === 'string' && q.trim()) {
        params.push(`%${q.trim()}%`);
        const idx = params.length;
        conditions.push(`(
            e.first_name ILIKE $${idx} OR 
            e.last_name ILIKE $${idx} OR 
            (e.first_name || ' ' || e.last_name) ILIKE $${idx} OR 
            e.email ILIKE $${idx} OR 
            e.role ILIKE $${idx} OR 
            b.branch_name ILIKE $${idx} OR 
            b.branch_code ILIKE $${idx}
        )`);
    } else {
        // Individual field search
        if (name && typeof name === 'string' && name.trim()) {
            params.push(`%${name.trim()}%`);
            const idx = params.length;
            conditions.push(`(e.first_name ILIKE $${idx} OR e.last_name ILIKE $${idx} OR (e.first_name || ' ' || e.last_name) ILIKE $${idx})`);
        }
        if (email && typeof email === 'string' && email.trim()) {
            params.push(`%${email.trim()}%`);
            const idx = params.length;
            conditions.push(`e.email ILIKE $${idx}`);
        }
        if (role && typeof role === 'string' && role.trim()) {
            params.push(`%${role.trim()}%`);
            const idx = params.length;
            conditions.push(`e.role ILIKE $${idx}`);
        }
        if (branch && typeof branch === 'string' && branch.trim()) {
            params.push(`%${branch.trim()}%`);
            const idx = params.length;
            conditions.push(`(b.branch_name ILIKE $${idx} OR b.branch_code ILIKE $${idx} OR b.city ILIKE $${idx})`);
        }
    }

    if (conditions.length === 0) {
        return res.status(400).json({
            success: false,
            message: 'Please provide at least one search parameter (e.g., ?q=..., ?name=..., ?email=..., ?role=..., ?branch=...).'
        });
    }

    const sql = `
        SELECT
            e.employee_id,
            e.branch_id,
            e.first_name,
            e.last_name,
            (e.first_name || ' ' || e.last_name) AS full_name,
            e.email,
            e.phone,
            e.role,
            e.salary,
            e.joining_date,
            b.branch_name,
            b.branch_code,
            b.ifsc_code,
            b.city AS branch_city
        FROM Employee e
        JOIN Branch b ON e.branch_id = b.branch_id
        WHERE ${conditions.join(' AND ')}
        ORDER BY e.employee_id ASC;
    `;

    try {
        const result = await db.query(sql, params);
        return res.status(200).json({
            success: true,
            count: result.rows.length,
            data: result.rows
        });
    } catch (err) {
        return handleDbError(err, res, 'search employees');
    }
};

/**
 * 4. Get Employees by Branch ID
 * Method: GET
 * Route: /api/employees/branch/:branchId
 *
 * Retrieves all employees belonging to a specific branch.
 * Returns 404 if the branch does not exist.
 */
const getEmployeesByBranch = async (req, res) => {
    const { branchId } = req.params;

    if (!isValidPositiveInteger(branchId)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid branch ID. Branch ID must be a positive integer.'
        });
    }

    try {
        // First verify that the branch exists
        const branchCheck = await db.query('SELECT branch_id, branch_name, branch_code FROM Branch WHERE branch_id = $1;', [parseInt(branchId, 10)]);
        if (branchCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: `Branch with ID ${branchId} not found.`
            });
        }

        const sql = `
            SELECT
                e.employee_id,
                e.branch_id,
                e.first_name,
                e.last_name,
                (e.first_name || ' ' || e.last_name) AS full_name,
                e.email,
                e.phone,
                e.role,
                e.salary,
                e.joining_date,
                b.branch_name,
                b.branch_code,
                b.ifsc_code,
                b.city AS branch_city
            FROM Employee e
            JOIN Branch b ON e.branch_id = b.branch_id
            WHERE e.branch_id = $1
            ORDER BY e.employee_id ASC;
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
        return handleDbError(err, res, `fetch employees for branch ${branchId}`);
    }
};

/**
 * 5. Get Employee by ID
 * Method: GET
 * Route: /api/employees/:id
 *
 * Validates employee_id and retrieves record with joined branch details.
 * Returns 404 if employee not found.
 */
const getEmployeeById = async (req, res) => {
    const { id } = req.params;

    if (!isValidPositiveInteger(id)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid employee ID. Employee ID must be a positive integer.'
        });
    }

    const sql = `
        SELECT
            e.employee_id,
            e.branch_id,
            e.first_name,
            e.last_name,
            (e.first_name || ' ' || e.last_name) AS full_name,
            e.email,
            e.phone,
            e.role,
            e.salary,
            e.joining_date,
            b.branch_name,
            b.branch_code,
            b.ifsc_code,
            b.city AS branch_city
        FROM Employee e
        JOIN Branch b ON e.branch_id = b.branch_id
        WHERE e.employee_id = $1;
    `;
    const params = [parseInt(id, 10)];

    try {
        const result = await db.query(sql, params);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: `Employee with ID ${id} not found.`
            });
        }

        return res.status(200).json({
            success: true,
            data: result.rows[0]
        });
    } catch (err) {
        return handleDbError(err, res, `fetch employee with ID ${id}`);
    }
};

/**
 * 6. Update Employee
 * Method: PUT
 * Route: /api/employees/:id
 *
 * Validates employee_id and provided fields.
 * Handles duplicate email (23505), invalid branch_id (23503), check constraints (23514).
 * Returns 404 if employee not found.
 */
const updateEmployee = async (req, res) => {
    const { id } = req.params;

    if (!isValidPositiveInteger(id)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid employee ID. Employee ID must be a positive integer.'
        });
    }

    const validation = validateEmployeeInput(req.body, true);
    if (!validation.isValid) {
        return res.status(400).json({
            success: false,
            message: validation.message
        });
    }

    const data = validation.data;
    const updates = [];
    const params = [];

    // Dynamically build SET clauses for provided fields
    for (const [key, value] of Object.entries(data)) {
        params.push(value);
        updates.push(`${key} = $${params.length}`);
    }

    if (updates.length === 0) {
        return res.status(400).json({
            success: false,
            message: 'Please provide at least one valid employee field to update.'
        });
    }

    params.push(parseInt(id, 10));
    const sql = `
        UPDATE Employee
        SET ${updates.join(', ')}
        WHERE employee_id = $${params.length}
        RETURNING employee_id, branch_id, first_name, last_name, email, phone, role, salary, joining_date;
    `;

    try {
        const result = await db.query(sql, params);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: `Employee with ID ${id} not found.`
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Employee updated successfully.',
            data: result.rows[0]
        });
    } catch (err) {
        return handleDbError(err, res, `update employee with ID ${id}`);
    }
};

// =====================================================================
// Module Exports
// =====================================================================
module.exports = {
    createEmployee,
    getAllEmployees,
    searchEmployees,
    getEmployeesByBranch,
    getEmployeeById,
    updateEmployee
};
