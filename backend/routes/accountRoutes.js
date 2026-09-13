// =====================================================================
// College DBMS Project: Bank Management System
// Module: Customer & Account Module
// Team Member: Sadhana
// Routes: Account Routes (backend/routes/accountRoutes.js)
// Description: REST API route definitions for Account entity operations
//              and search.
// =====================================================================

const express = require('express');
const router = express.Router();

// Import Account controller functions
const {
    createAccount,
    getAllAccounts,
    getAccountById,
    updateAccount,
    searchAccounts
} = require('../controllers/accountController');

// =====================================================================
// Account REST API Route Definitions
// =====================================================================

// 1. Create a new account
// POST /api/accounts
router.post('/', createAccount);

// 2. Retrieve all accounts (with joined customer and branch details)
// GET /api/accounts
router.get('/', getAllAccounts);

// 3. Search accounts by account number (?account_number=... or ?q=...)
// GET /api/accounts/search
// NOTE FOR VIVA: /search MUST be defined BEFORE /:id to prevent Express
// from treating the literal string "search" as an :id parameter.
router.get('/search', searchAccounts);

// 4. Retrieve a specific account by ID
// GET /api/accounts/:id
router.get('/:id', getAccountById);

// 5. Update an account by ID
// PUT /api/accounts/:id
router.put('/:id', updateAccount);

// =====================================================================
// Export Router
// =====================================================================
module.exports = router;
