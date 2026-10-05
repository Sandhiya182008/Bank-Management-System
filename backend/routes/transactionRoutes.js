// =====================================================================
// College DBMS Project: Bank Management System
// Module: Transaction Module
// Team Member: Shivarakshana
// Routes: Transaction Routes (backend/routes/transactionRoutes.js)
// Description: REST API route definitions for Deposit, Withdrawal,
//              Fund Transfer, and Transaction History operations.
// =====================================================================

const express = require('express');
const router = express.Router();

// Import Transaction controller functions
const {
    depositMoney,
    withdrawMoney,
    transferMoney,
    getAllTransactions,
    getTransactionById,
    getTransactionsByAccountId
} = require('../controllers/transactionController');

// Import authentication middleware
const { authenticateToken } = require('../middleware/authMiddleware');

// =====================================================================
// Transaction REST API Route Definitions
// =====================================================================

// 1. Deposit money into an account
// POST /api/transactions/deposit
router.post('/deposit', authenticateToken, depositMoney);

// 2. Withdraw money from an account
// POST /api/transactions/withdraw
router.post('/withdraw', authenticateToken, withdrawMoney);

// 3. Transfer money between two accounts
// POST /api/transactions/transfer
router.post('/transfer', authenticateToken, transferMoney);

// 4. Retrieve all transactions
// GET /api/transactions
router.get('/', authenticateToken, getAllTransactions);

// 5. Retrieve transactions for a specific account
// GET /api/transactions/account/:accountId
// NOTE FOR VIVA: Specific path /account/:accountId MUST be placed before /:id
// to prevent Express from matching literal string "account" as an :id parameter.
router.get('/account/:accountId', authenticateToken, getTransactionsByAccountId);

// 6. Retrieve a specific transaction by ID
// GET /api/transactions/:id
router.get('/:id', authenticateToken, getTransactionById);

// =====================================================================
// Export Router
// =====================================================================
module.exports = router;
