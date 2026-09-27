// =====================================================================
// College DBMS Project: Bank Management System
// Module: Loan, Employee & Branch Module
// Team Member: Pavi
// Routes: Loan Routes (backend/routes/loanRoutes.js)
// Description: REST API route definitions for Loan entity operations,
//              search, status updates, and customer/branch filtering.
// =====================================================================

const express = require('express');
const router = express.Router();

// Import Loan controller functions
const {
    createLoan,
    getAllLoans,
    searchLoans,
    getLoansByCustomer,
    getLoansByBranch,
    getLoansByStatus,
    getLoanById,
    updateLoan,
    updateLoanStatus
} = require('../controllers/loanController');

// =====================================================================
// Loan REST API Route Definitions
// =====================================================================

// 1. Create a new loan
// POST /api/loans
router.post('/', createLoan);

// 2. Retrieve all loans (with joined customer and branch details)
// GET /api/loans
router.get('/', getAllLoans);

// 3. Search and filter loans (?q=..., ?loan_number=..., ?loan_type=..., etc.)
// GET /api/loans/search
// NOTE FOR VIVA: /search MUST be defined BEFORE /:id to prevent Express
// from treating the literal string "search" as an :id parameter.
router.get('/search', searchLoans);

// 4. Retrieve loans for a specific customer
// GET /api/loans/customer/:customerId
// NOTE FOR VIVA: /customer/:customerId MUST be defined BEFORE /:id.
router.get('/customer/:customerId', getLoansByCustomer);

// 5. Retrieve loans for a specific branch
// GET /api/loans/branch/:branchId
// NOTE FOR VIVA: /branch/:branchId MUST be defined BEFORE /:id.
router.get('/branch/:branchId', getLoansByBranch);

// 6. Retrieve loans by status ('Applied', 'Approved', 'Rejected', 'Closed')
// GET /api/loans/status/:status
// NOTE FOR VIVA: /status/:status MUST be defined BEFORE /:id.
router.get('/status/:status', getLoansByStatus);

// 7. Update status for a specific loan
// PATCH /api/loans/:id/status
router.patch('/:id/status', updateLoanStatus);

// 8. Retrieve a specific loan by ID
// GET /api/loans/:id
router.get('/:id', getLoanById);

// 9. Update a loan by ID
// PUT /api/loans/:id
router.put('/:id', updateLoan);

// =====================================================================
// Export Router
// =====================================================================
module.exports = router;
