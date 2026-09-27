// =====================================================================
// College DBMS Project: Bank Management System
// Module: Loan, Employee & Branch Module
// Team Member: Pavi
// Routes: Branch Routes (backend/routes/branchRoutes.js)
// Description: REST API route definitions for Branch entity operations
//              and search.
// =====================================================================

const express = require('express');
const router = express.Router();

// Import Branch controller functions
const {
    createBranch,
    getAllBranches,
    searchBranches,
    getBranchById,
    updateBranch
} = require('../controllers/branchController');

// =====================================================================
// Branch REST API Route Definitions
// =====================================================================

// 1. Create a new branch
// POST /api/branches
router.post('/', createBranch);

// 2. Retrieve all branches
// GET /api/branches
router.get('/', getAllBranches);

// 3. Search branches by branch name, branch code, IFSC code, or city
// GET /api/branches/search
// NOTE FOR VIVA: /search MUST be defined BEFORE /:id to prevent Express
// from treating the literal string "search" as an :id parameter.
router.get('/search', searchBranches);

// 4. Retrieve a specific branch by ID
// GET /api/branches/:id
router.get('/:id', getBranchById);

// 5. Update a branch by ID
// PUT /api/branches/:id
router.put('/:id', updateBranch);

// =====================================================================
// Export Router
// =====================================================================
module.exports = router;
