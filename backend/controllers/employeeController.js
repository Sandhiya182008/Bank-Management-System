const pool = require('../config/db');

const VALID_ROLES = ['Manager', 'Cashier', 'Loan Officer', 'Clerk'];

const isValidPositiveInteger = (value) => {
    return Number.isInteger(Number(value)) && Number(value) > 0;
};

const handleDbError = (error, res) => {
    if (error.code === '23505') {
        return res.status(409).json({
            success: false,
            message: 'Email already exists'
        });
    }

    if (error.code === '23503') {
        return res.status(400).json({
            success: false,
            message: 'Invalid branch_id: branch does not exist'
        });
    }

    console.error('Employee database error:', error);

    return res.status(500).json({
        success: false,
        message: 'Database operation failed'
    });
};

// Create Employee
const createEmployee = async (req, res) => {
    try {
        const {
            branch_id,
            first_name,
            last_name,
            email,
            phone,
            role,
            salary,
            joining_date
        } = req.body;

        if (
            !isValidPositiveInteger(branch_id) ||
            !first_name?.trim() ||
            !last_name?.trim() ||
            !email?.trim() ||
            !role?.trim() ||
            salary === undefined ||
            Number(salary) <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: 'branch_id, first_name, last_name, email, role and valid salary are required'
            });
        }

        if (!VALID_ROLES.includes(role.trim())) {
            return res.status(400).json({
                success: false,
                message: `Invalid role. Allowed roles: ${VALID_ROLES.join(', ')}`
            });
        }

        const result = await pool.query(
            `INSERT INTO Employee
       (branch_id, first_name, last_name, email, phone, role, salary, joining_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, CURRENT_DATE))
       RETURNING *`,
            [
                Number(branch_id),
                first_name.trim(),
                last_name.trim(),
                email.trim(),
                phone?.trim() || null,
                role.trim(),
                Number(salary),
                joining_date || null
            ]
        );

        return res.status(201).json({
            success: true,
            message: 'Employee created successfully',
            data: result.rows[0]
        });
    } catch (error) {
        return handleDbError(error, res);
    }
};

// Get all Employees
const getAllEmployees = async (req, res) => {
    try {
        const result = await pool.query(`
      SELECT
        e.employee_id,
        e.branch_id,
        b.branch_name,
        e.first_name,
        e.last_name,
        e.email,
        e.phone,
        e.role,
        e.salary,
        e.joining_date
      FROM Employee e
      JOIN Branch b ON e.branch_id = b.branch_id
      ORDER BY e.employee_id
    `);

        return res.status(200).json({
            success: true,
            count: result.rows.length,
            data: result.rows
        });
    } catch (error) {
        return handleDbError(error, res);
    }
};

// Get Employee by ID
const getEmployeeById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!isValidPositiveInteger(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid employee ID'
            });
        }

        const result = await pool.query(
            `SELECT
         e.employee_id,
         e.branch_id,
         b.branch_name,
         e.first_name,
         e.last_name,
         e.email,
         e.phone,
         e.role,
         e.salary,
         e.joining_date
       FROM Employee e
       JOIN Branch b ON e.branch_id = b.branch_id
       WHERE e.employee_id = $1`,
            [Number(id)]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Employee not found'
            });
        }

        return res.status(200).json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        return handleDbError(error, res);
    }
};

// Update Employee
const updateEmployee = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            branch_id,
            first_name,
            last_name,
            email,
            phone,
            role,
            salary,
            joining_date
        } = req.body;

        if (!isValidPositiveInteger(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid employee ID'
            });
        }

        if (
            !isValidPositiveInteger(branch_id) ||
            !first_name?.trim() ||
            !last_name?.trim() ||
            !email?.trim() ||
            !role?.trim() ||
            salary === undefined ||
            Number(salary) <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: 'branch_id, first_name, last_name, email, role and valid salary are required'
            });
        }

        if (!VALID_ROLES.includes(role.trim())) {
            return res.status(400).json({
                success: false,
                message: `Invalid role. Allowed roles: ${VALID_ROLES.join(', ')}`
            });
        }

        const result = await pool.query(
            `UPDATE Employee
       SET branch_id = $1,
           first_name = $2,
           last_name = $3,
           email = $4,
           phone = $5,
           role = $6,
           salary = $7,
           joining_date = COALESCE($8, joining_date)
       WHERE employee_id = $9
       RETURNING *`,
            [
                Number(branch_id),
                first_name.trim(),
                last_name.trim(),
                email.trim(),
                phone?.trim() || null,
                role.trim(),
                Number(salary),
                joining_date || null,
                Number(id)
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Employee not found'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Employee updated successfully',
            data: result.rows[0]
        });
    } catch (error) {
        return handleDbError(error, res);
    }
};

module.exports = {
    createEmployee,
    getAllEmployees,
    getEmployeeById,
    updateEmployee
};