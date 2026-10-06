const express = require('express');

const {
    createBranch,
    getAllBranches,
    getBranchById,
    updateBranch
} = require('../controllers/branchController');

const { authenticateToken, requireEmployee } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/', authenticateToken, requireEmployee, createBranch);
router.get('/', authenticateToken, requireEmployee, getAllBranches);
router.get('/:id', authenticateToken, requireEmployee, getBranchById);
router.put('/:id', authenticateToken, requireEmployee, updateBranch);

module.exports = router;