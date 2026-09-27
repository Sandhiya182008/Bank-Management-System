// =====================================================================
// College DBMS Project: Bank Management System
// Module: Loan, Employee & Branch Module
// Team Member: Pavi
// Controller: Branch Controller (backend/controllers/branchController.js)
// Description: Implements CRUD and Search operations for Branch entity
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
 * Handles database errors with college DBMS project friendliness:
 * - 23505: Unique constraint violation (duplicate branch_code or ifsc_code)
 * - 23503: Foreign key restriction violation (e.g., active accounts/employees/loans reference this branch)
 * - 23514: Check constraint violation
 * - 500: Generic internal server error (logs full trace to server console)
 *
 * @param {Error} err - Caught error
 * @param {Object} res - Express response object
 * @param {string} actionDescription - Action context for logging
 */
const handleDbError = (err, res, actionDescription = 'process branch request') => {
    console.error(`Database Error during ${actionDescription}:`, {
        code: err.code,
        message: err.message,
        detail: err.detail,
        constraint: err.constraint
    });

    // 23505: Unique violation (branch_code or ifsc_code already exists)
    if (err.code === '23505') {
        const detail = (err.detail || '').toLowerCase();
        const constraint = (err.constraint || '').toLowerCase();

        if (detail.includes('branch_code') || constraint.includes('branch_code')) {
            return res.status(409).json({
                success: false,
                message: 'A branch with this branch code already exists.'
            });
        }
        if (detail.includes('ifsc_code') || constraint.includes('ifsc_code')) {
            return res.status(409).json({
                success: false,
                message: 'A branch with this IFSC code already exists.'
            });
        }
        return res.status(409).json({
            success: false,
            message: 'Duplicate value conflict: Branch code or IFSC code already exists.'
        });
    }

    // 23503: Foreign key violation
    if (err.code === '23503') {
        return res.status(400).json({
            success: false,
            message: 'Foreign key constraint violation: Cannot complete operation because of referenced records in other tables.'
        });
    }

    // 23514: Check constraint violation
    if (err.code === '23514') {
        return res.status(400).json({
            success: false,
            message: 'Database check constraint violation: Invalid branch data provided.'
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
 * 1. Create a new Branch
 * Method: POST
 * Route: /api/branches
 *
 * Required fields: branch_name, branch_code, ifsc_code, city
 * Optional fields: phone
 */
const createBranch = async (req, res) => {
    const { branch_name, branch_code, ifsc_code, city, phone } = req.body || {};

    // Validate required fields
    if (!branch_name || typeof branch_name !== 'string' || !branch_name.trim()) {
        return res.status(400).json({
            success: false,
            message: 'Branch name is required and cannot be empty.'
        });
    }
    if (branch_name.trim().length > 100) {
        return res.status(400).json({
            success: false,
            message: 'Branch name cannot exceed 100 characters.'
        });
    }

    if (!branch_code || typeof branch_code !== 'string' || !branch_code.trim()) {
        return res.status(400).json({
            success: false,
            message: 'Branch code is required and cannot be empty.'
        });
    }
    if (branch_code.trim().length > 20) {
        return res.status(400).json({
            success: false,
            message: 'Branch code cannot exceed 20 characters.'
        });
    }

    if (!ifsc_code || typeof ifsc_code !== 'string' || !ifsc_code.trim()) {
        return res.status(400).json({
            success: false,
            message: 'IFSC code is required and cannot be empty.'
        });
    }
    if (ifsc_code.trim().length > 20) {
        return res.status(400).json({
            success: false,
            message: 'IFSC code cannot exceed 20 characters.'
        });
    }

    if (!city || typeof city !== 'string' || !city.trim()) {
        return res.status(400).json({
            success: false,
            message: 'City is required and cannot be empty.'
        });
    }
    if (city.trim().length > 50) {
        return res.status(400).json({
            success: false,
            message: 'City cannot exceed 50 characters.'
        });
    }

    // Optional phone validation
    let formattedPhone = null;
    if (phone !== undefined && phone !== null && String(phone).trim() !== '') {
        const phoneStr = String(phone).trim();
        if (phoneStr.length > 15) {
            return res.status(400).json({
                success: false,
                message: 'Phone number cannot exceed 15 characters.'
            });
        }
        formattedPhone = phoneStr;
    }

    const sql = `
        INSERT INTO Branch (branch_name, branch_code, ifsc_code, city, phone)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING branch_id, branch_name, branch_code, ifsc_code, city, phone;
    `;
    const params = [
        branch_name.trim(),
        branch_code.trim(),
        ifsc_code.trim().toUpperCase(),
        city.trim(),
        formattedPhone
    ];

    try {
        const result = await db.query(sql, params);
        return res.status(201).json({
            success: true,
            message: 'Branch created successfully.',
            data: result.rows[0]
        });
    } catch (err) {
        return handleDbError(err, res, 'create branch');
    }
};

/**
 * 2. Get All Branches
 * Method: GET
 * Route: /api/branches
 *
 * Retrieves all registered branches ordered by branch_id ascending.
 */
const getAllBranches = async (req, res) => {
    const sql = `
        SELECT branch_id, branch_name, branch_code, ifsc_code, city, phone
        FROM Branch
        ORDER BY branch_id ASC;
    `;

    try {
        const result = await db.query(sql);
        return res.status(200).json({
            success: true,
            count: result.rows.length,
            data: result.rows
        });
    } catch (err) {
        return handleDbError(err, res, 'fetch all branches');
    }
};

/**
 * 3. Search Branches
 * Method: GET
 * Route: /api/branches/search
 *
 * Supports searching branches by branch name, branch code, IFSC code, or city
 * using parameterized ILIKE queries to prevent SQL injection.
 * Parameter formats supported:
 *  - General query: ?q=... (searches across name, code, IFSC, and city)
 *  - Specific queries: ?branch_name=..., ?branch_code=..., ?ifsc_code=..., ?city=...
 */
const searchBranches = async (req, res) => {
    const { q, branch_name, branch_code, ifsc_code, city } = req.query;

    const conditions = [];
    const params = [];

    // General keyword search
    if (q && typeof q === 'string' && q.trim()) {
        params.push(`%${q.trim()}%`);
        const idx = params.length;
        conditions.push(`(branch_name ILIKE $${idx} OR branch_code ILIKE $${idx} OR ifsc_code ILIKE $${idx} OR city ILIKE $${idx})`);
    } else {
        // Individual field search
        if (branch_name && typeof branch_name === 'string' && branch_name.trim()) {
            params.push(`%${branch_name.trim()}%`);
            const idx = params.length;
            conditions.push(`branch_name ILIKE $${idx}`);
        }
        if (branch_code && typeof branch_code === 'string' && branch_code.trim()) {
            params.push(`%${branch_code.trim()}%`);
            const idx = params.length;
            conditions.push(`branch_code ILIKE $${idx}`);
        }
        if (ifsc_code && typeof ifsc_code === 'string' && ifsc_code.trim()) {
            params.push(`%${ifsc_code.trim()}%`);
            const idx = params.length;
            conditions.push(`ifsc_code ILIKE $${idx}`);
        }
        if (city && typeof city === 'string' && city.trim()) {
            params.push(`%${city.trim()}%`);
            const idx = params.length;
            conditions.push(`city ILIKE $${idx}`);
        }
    }

    if (conditions.length === 0) {
        return res.status(400).json({
            success: false,
            message: 'Please provide at least one search parameter (e.g., ?q=..., ?branch_name=..., ?branch_code=..., ?ifsc_code=..., ?city=...).'
        });
    }

    const sql = `
        SELECT branch_id, branch_name, branch_code, ifsc_code, city, phone
        FROM Branch
        WHERE ${conditions.join(' AND ')}
        ORDER BY branch_id ASC;
    `;

    try {
        const result = await db.query(sql, params);
        return res.status(200).json({
            success: true,
            count: result.rows.length,
            data: result.rows
        });
    } catch (err) {
        return handleDbError(err, res, 'search branches');
    }
};

/**
 * 4. Get Branch by ID
 * Method: GET
 * Route: /api/branches/:id
 *
 * Validates branch_id as a positive integer.
 * Returns 404 if the branch is not found.
 */
const getBranchById = async (req, res) => {
    const { id } = req.params;

    if (!isValidPositiveInteger(id)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid branch ID. Branch ID must be a positive integer.'
        });
    }

    const sql = `
        SELECT branch_id, branch_name, branch_code, ifsc_code, city, phone
        FROM Branch
        WHERE branch_id = $1;
    `;
    const params = [parseInt(id, 10)];

    try {
        const result = await db.query(sql, params);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: `Branch with ID ${id} not found.`
            });
        }

        return res.status(200).json({
            success: true,
            data: result.rows[0]
        });
    } catch (err) {
        return handleDbError(err, res, `fetch branch with ID ${id}`);
    }
};

/**
 * 5. Update Branch
 * Method: PUT
 * Route: /api/branches/:id
 *
 * Validates branch_id and updates provided fields.
 * Handles duplicate branch_code / ifsc_code (23505).
 * Returns 404 if branch is not found.
 */
const updateBranch = async (req, res) => {
    const { id } = req.params;

    if (!isValidPositiveInteger(id)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid branch ID. Branch ID must be a positive integer.'
        });
    }

    const { branch_name, branch_code, ifsc_code, city, phone } = req.body || {};

    const updates = [];
    const params = [];

    // Validate and prepare update for branch_name
    if (branch_name !== undefined) {
        if (typeof branch_name !== 'string' || !branch_name.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Branch name cannot be empty.'
            });
        }
        if (branch_name.trim().length > 100) {
            return res.status(400).json({
                success: false,
                message: 'Branch name cannot exceed 100 characters.'
            });
        }
        params.push(branch_name.trim());
        updates.push(`branch_name = $${params.length}`);
    }

    // Validate and prepare update for branch_code
    if (branch_code !== undefined) {
        if (typeof branch_code !== 'string' || !branch_code.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Branch code cannot be empty.'
            });
        }
        if (branch_code.trim().length > 20) {
            return res.status(400).json({
                success: false,
                message: 'Branch code cannot exceed 20 characters.'
            });
        }
        params.push(branch_code.trim());
        updates.push(`branch_code = $${params.length}`);
    }

    // Validate and prepare update for ifsc_code
    if (ifsc_code !== undefined) {
        if (typeof ifsc_code !== 'string' || !ifsc_code.trim()) {
            return res.status(400).json({
                success: false,
                message: 'IFSC code cannot be empty.'
            });
        }
        if (ifsc_code.trim().length > 20) {
            return res.status(400).json({
                success: false,
                message: 'IFSC code cannot exceed 20 characters.'
            });
        }
        params.push(ifsc_code.trim().toUpperCase());
        updates.push(`ifsc_code = $${params.length}`);
    }

    // Validate and prepare update for city
    if (city !== undefined) {
        if (typeof city !== 'string' || !city.trim()) {
            return res.status(400).json({
                success: false,
                message: 'City cannot be empty.'
            });
        }
        if (city.trim().length > 50) {
            return res.status(400).json({
                success: false,
                message: 'City cannot exceed 50 characters.'
            });
        }
        params.push(city.trim());
        updates.push(`city = $${params.length}`);
    }

    // Validate and prepare update for phone
    if (phone !== undefined) {
        if (phone === null || String(phone).trim() === '') {
            params.push(null);
            updates.push(`phone = $${params.length}`);
        } else {
            const phoneStr = String(phone).trim();
            if (phoneStr.length > 15) {
                return res.status(400).json({
                    success: false,
                    message: 'Phone number cannot exceed 15 characters.'
                });
            }
            params.push(phoneStr);
            updates.push(`phone = $${params.length}`);
        }
    }

    // Ensure at least one field was supplied for update
    if (updates.length === 0) {
        return res.status(400).json({
            success: false,
            message: 'Please provide at least one valid branch field to update.'
        });
    }

    params.push(parseInt(id, 10));
    const sql = `
        UPDATE Branch
        SET ${updates.join(', ')}
        WHERE branch_id = $${params.length}
        RETURNING branch_id, branch_name, branch_code, ifsc_code, city, phone;
    `;

    try {
        const result = await db.query(sql, params);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: `Branch with ID ${id} not found.`
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Branch updated successfully.',
            data: result.rows[0]
        });
    } catch (err) {
        return handleDbError(err, res, `update branch with ID ${id}`);
    }
};

// =====================================================================
// Module Exports
// =====================================================================
module.exports = {
    createBranch,
    getAllBranches,
    searchBranches,
    getBranchById,
    updateBranch
};
