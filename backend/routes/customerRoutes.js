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

// =====================================================================
// Customer REST API Route Definitions
// =====================================================================

// 1. Create a new customer
// POST /api/customers
router.post('/', createCustomer);

// 2. Retrieve all customers
// GET /api/customers
router.get('/', getAllCustomers);

// 3. Search customers
// GET /api/customers/search
// NOTE FOR VIVA: /search MUST be defined BEFORE /:id.
// If /:id was defined first, a request to /search would incorrectly treat
// "search" as a customer ID parameter.
router.get('/search', searchCustomers);

// 4. Retrieve a specific customer by ID
// GET /api/customers/:id
router.get('/:id', getCustomerById);

// 5. Update a customer by ID
// PUT /api/customers/:id
router.put('/:id', updateCustomer);

// 6. Delete a customer by ID
// DELETE /api/customers/:id
router.delete('/:id', deleteCustomer);

// =====================================================================
// Export Router
// =====================================================================
module.exports = router;
