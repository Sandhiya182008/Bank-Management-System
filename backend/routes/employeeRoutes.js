const express = require('express');

const {
    createEmployee,
    getAllEmployees,
    getEmployeeById,
    updateEmployee
} = require('../controllers/employeeController');

const router = express.Router();

router.post('/', createEmployee);
router.get('/', getAllEmployees);
router.get('/:id', getEmployeeById);
router.put('/:id', updateEmployee);

module.exports = router;