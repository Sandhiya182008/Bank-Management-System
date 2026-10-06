// =====================================================================
// College DBMS Project: Bank Management System
// Module: Customer & Account Module
// Team Member: Sadhana
// Routes: Customer Routes (backend/routes/customerRoutes.js)
// Description: REST API route definitions for Customer entity CRUD
//              and search operations.
// =====================================================================

const express = require('express');
const router = express.Router();

// Import all 6 Customer controller functions
const {
    createCustomer,
    getAllCustomers,
    getCustomerById,
    updateCustomer,
    deleteCustomer,
    searchCustomers
} = require('../controllers/customerController');

// Import authentication and authorization middleware
const { authenticateToken, requireEmployee } = require('../middleware/authMiddleware');

// =====================================================================
// Customer REST API Route Definitions
// =====================================================================

// 1. Create a new customer (Employee-only)
// POST /api/customers
router.post('/', authenticateToken, requireEmployee, createCustomer);

// 2. Retrieve all customers (Employee-only)
// GET /api/customers
router.get('/', authenticateToken, requireEmployee, getAllCustomers);

// 3. Search customers (Employee-only)
// GET /api/customers/search
// NOTE FOR VIVA: /search MUST be defined BEFORE /:id.
// If /:id was defined first, a request to /search would incorrectly treat
// "search" as a customer ID parameter.
router.get('/search', authenticateToken, requireEmployee, searchCustomers);

// 4. Retrieve a specific customer by ID (Employee: any; Customer: own profile only)
// GET /api/customers/:id
router.get('/:id', authenticateToken, getCustomerById);

// 5. Update a customer by ID (Employee-only)
// PUT /api/customers/:id
router.put('/:id', authenticateToken, requireEmployee, updateCustomer);

// 6. Delete a customer by ID (Employee-only)
// DELETE /api/customers/:id
router.delete('/:id', authenticateToken, requireEmployee, deleteCustomer);

// =====================================================================
// Export Router
// =====================================================================
module.exports = router;
