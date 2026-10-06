const express = require('express');

const {
    createEmployee,
    getAllEmployees,
    getEmployeeById,
    updateEmployee
} = require('../controllers/employeeController');

const { authenticateToken, requireEmployee } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/', authenticateToken, requireEmployee, createEmployee);
router.get('/', authenticateToken, requireEmployee, getAllEmployees);
router.get('/:id', authenticateToken, requireEmployee, getEmployeeById);
router.put('/:id', authenticateToken, requireEmployee, updateEmployee);

module.exports = router;