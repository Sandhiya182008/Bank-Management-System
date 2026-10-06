// =====================================================================
// College DBMS Project: Bank Management System
// Module: Loan, Employee & Branch Module
// Team Member: Pavi
// Routes: Loan Payment Routes (backend/routes/loanPaymentRoutes.js)
// Description: REST API route definitions for Loan Payment operations.
// =====================================================================

const express = require('express');
const router = express.Router();

// Import Loan Payment controller functions
const {
    recordLoanPayment,
    getAllLoanPayments,
    getPaymentsByLoan,
    getLoanPaymentById
} = require('../controllers/loanPaymentController');

// Import authentication middleware
const { authenticateToken } = require('../middleware/authMiddleware');

// =====================================================================
// Loan Payment REST API Route Definitions
// =====================================================================

// 1. Record a loan payment (Customer: own loan; Employee: any valid loan)
// POST /api/loan-payments
router.post('/', authenticateToken, recordLoanPayment);

// 2. Retrieve all loan payments (Employee: all; Customer: own payments only)
// GET /api/loan-payments
router.get('/', authenticateToken, getAllLoanPayments);

// 3. Retrieve all payments for a specific loan (Employee: any loan; Customer: own loan only)
// GET /api/loan-payments/loan/:loanId
// NOTE FOR VIVA: /loan/:loanId MUST be defined BEFORE /:id to prevent
// route collisions with generic /:id.
router.get('/loan/:loanId', authenticateToken, getPaymentsByLoan);

// 4. Retrieve a specific loan payment by ID (Employee: any; Customer: own payment only)
// GET /api/loan-payments/:id
router.get('/:id', authenticateToken, getLoanPaymentById);

// =====================================================================
// Export Router
// =====================================================================
module.exports = router;
