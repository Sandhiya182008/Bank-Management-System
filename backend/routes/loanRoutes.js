// =====================================================================
// College DBMS Project: Bank Management System
// Module: Loan, Employee & Branch Module
// Routes: Loan Routes (backend/routes/loanRoutes.js)
// Description: REST API route definitions for Loan operations with
//              customer scoping and Loan Officer/Manager role protection.
// =====================================================================

const express = require('express');

const {
    createLoan,
    getAllLoans,
    getLoanById,
    updateLoan
} = require('../controllers/loanController');

const { authenticateToken, requireLoanApprover } = require('../middleware/authMiddleware');

const router = express.Router();

// =====================================================================
// Loan REST API Route Definitions
// =====================================================================

// 1. Apply for a new loan (Customer applies for self; Employee can create on behalf)
// POST /api/loans
router.post('/', authenticateToken, createLoan);

// 2. Retrieve all loans (Employee: all loans; Customer: own loans only)
// GET /api/loans
router.get('/', authenticateToken, getAllLoans);

// 3. Retrieve a specific loan by ID (Employee: any; Customer: own loan only)
// GET /api/loans/:id
router.get('/:id', authenticateToken, getLoanById);

// 4. Update loan status or details (Restricted to Loan Officer and Manager only)
// PUT /api/loans/:id
router.put('/:id', authenticateToken, requireLoanApprover, updateLoan);

module.exports = router;
