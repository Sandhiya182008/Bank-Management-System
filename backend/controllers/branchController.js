const pool = require('../config/db');

const isValidPositiveInteger = (value) => {
    return Number.isInteger(Number(value)) && Number(value) > 0;
};

const handleDbError = (error, res) => {
    console.error('Branch database error:', error);

    if (error.code === '23505') {
        return res.status(409).json({
            success: false,
            message: 'Branch code or IFSC code already exists'
        });
    }

    return res.status(500).json({
        success: false,
        message: 'Internal server error'
    });
};

// Create a new branch
const createBranch = async (req, res) => {
    try {
        const {
            branch_name,
            branch_code,
            ifsc_code,
            city,
            phone
        } = req.body;

        if (!branch_name || !branch_code || !ifsc_code || !city || !phone) {
            return res.status(400).json({
                success: false,
                message: 'All branch fields are required'
            });
        }

        const result = await pool.query(
            `INSERT INTO Branch
       (branch_name, branch_code, ifsc_code, city, phone)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
            [branch_name.trim(), branch_code.trim(), ifsc_code.trim(), city.trim(), phone.trim()]
        );

        return res.status(201).json({
            success: true,
            message: 'Branch created successfully',
            data: result.rows[0]
        });
    } catch (error) {
        return handleDbError(error, res);
    }
};

// Get all branches
const getAllBranches = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT *
       FROM Branch
       ORDER BY branch_id`
        );

        return res.status(200).json({
            success: true,
            count: result.rows.length,
            data: result.rows
        });
    } catch (error) {
        return handleDbError(error, res);
    }
};

// Get branch by ID
const getBranchById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!isValidPositiveInteger(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid branch ID'
            });
        }

        const result = await pool.query(
            `SELECT *
       FROM Branch
       WHERE branch_id = $1`,
            [Number(id)]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Branch not found'
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

// Update branch
const updateBranch = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            branch_name,
            branch_code,
            ifsc_code,
            city,
            phone
        } = req.body;

        if (!isValidPositiveInteger(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid branch ID'
            });
        }

        if (!branch_name || !branch_code || !ifsc_code || !city || !phone) {
            return res.status(400).json({
                success: false,
                message: 'All branch fields are required'
            });
        }

        const result = await pool.query(
            `UPDATE Branch
       SET branch_name = $1,
           branch_code = $2,
           ifsc_code = $3,
           city = $4,
           phone = $5
       WHERE branch_id = $6
       RETURNING *`,
            [
                branch_name.trim(),
                branch_code.trim(),
                ifsc_code.trim(),
                city.trim(),
                phone.trim(),
                Number(id)
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Branch not found'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Branch updated successfully',
            data: result.rows[0]
        });
    } catch (error) {
        return handleDbError(error, res);
    }
};

module.exports = {
    createBranch,
    getAllBranches,
    getBranchById,
    updateBranch
};