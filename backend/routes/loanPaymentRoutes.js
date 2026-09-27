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

// =====================================================================
// Loan Payment REST API Route Definitions
// =====================================================================

// 1. Record a loan payment
// POST /api/loan-payments
router.post('/', recordLoanPayment);

// 2. Retrieve all loan payments
// GET /api/loan-payments
router.get('/', getAllLoanPayments);

// 3. Retrieve all payments for a specific loan
// GET /api/loan-payments/loan/:loanId
// NOTE FOR VIVA: /loan/:loanId MUST be defined BEFORE /:id to prevent
// route collisions with generic /:id.
router.get('/loan/:loanId', getPaymentsByLoan);

// 4. Retrieve a specific loan payment by ID
// GET /api/loan-payments/:id
router.get('/:id', getLoanPaymentById);

// =====================================================================
// Export Router
// =====================================================================
module.exports = router;
