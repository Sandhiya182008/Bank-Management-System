// =====================================================================
// College DBMS Project: Bank Management System
// Module: Customer & Account Module
// Team Member: Sadhana
// Routes: Account Routes (backend/routes/accountRoutes.js)
// Description: REST API route definitions for Account entity operations
//              and search with Phase 3 role-based route authorization security.
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

// Import authentication and authorization middleware
const { authenticateToken, requireEmployee } = require('../middleware/authMiddleware');

// =====================================================================
// Account REST API Route Definitions
// =====================================================================

// 1. Create a new account (Employee-only)
// POST /api/accounts
router.post('/', authenticateToken, requireEmployee, createAccount);

// 2. Retrieve all accounts (Employee: all accounts; Customer: own accounts only)
// GET /api/accounts
router.get('/', authenticateToken, getAllAccounts);

// 3. Search accounts by account number (Employee-only)
// GET /api/accounts/search
// NOTE FOR VIVA: /search MUST be defined BEFORE /:id to prevent Express
// from treating the literal string "search" as an :id parameter.
router.get('/search', authenticateToken, requireEmployee, searchAccounts);

// 4. Retrieve a specific account by ID (Employee: any; Customer: own account only)
// GET /api/accounts/:id
router.get('/:id', authenticateToken, getAccountById);

// 5. Update an account by ID (Employee-only)
// PUT /api/accounts/:id
router.put('/:id', authenticateToken, requireEmployee, updateAccount);

// =====================================================================
// Export Router
// =====================================================================
module.exports = router;
