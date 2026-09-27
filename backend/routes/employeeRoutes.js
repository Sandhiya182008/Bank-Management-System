// =====================================================================
// College DBMS Project: Bank Management System
// Module: Loan, Employee & Branch Module
// Team Member: Pavi
// Routes: Employee Routes (backend/routes/employeeRoutes.js)
// Description: REST API route definitions for Employee entity operations,
//              search, and branch filtering.
// =====================================================================

const express = require('express');
const router = express.Router();

// Import Employee controller functions
const {
    createEmployee,
    getAllEmployees,
    searchEmployees,
    getEmployeesByBranch,
    getEmployeeById,
    updateEmployee
} = require('../controllers/employeeController');

// =====================================================================
// Employee REST API Route Definitions
// =====================================================================

// 1. Create a new employee
// POST /api/employees
router.post('/', createEmployee);

// 2. Retrieve all employees (with joined branch details)
// GET /api/employees
router.get('/', getAllEmployees);

// 3. Search employees by name, email, role, or branch
// GET /api/employees/search
// NOTE FOR VIVA: /search MUST be defined BEFORE /:id to prevent Express
// from treating the literal string "search" as an :id parameter.
router.get('/search', searchEmployees);

// 4. Retrieve employees belonging to a specific branch
// GET /api/employees/branch/:branchId
// NOTE FOR VIVA: /branch/:branchId MUST be defined BEFORE /:id to prevent
// route collisions with generic /:id.
router.get('/branch/:branchId', getEmployeesByBranch);

// 5. Retrieve a specific employee by ID
// GET /api/employees/:id
router.get('/:id', getEmployeeById);

// 6. Update an employee by ID
// PUT /api/employees/:id
router.put('/:id', updateEmployee);

// =====================================================================
// Export Router
// =====================================================================
module.exports = router;
