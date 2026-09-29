const express = require('express');

const {
    createBranch,
    getAllBranches,
    getBranchById,
    updateBranch
} = require('../controllers/branchController');

const router = express.Router();

router.post('/', createBranch);
router.get('/', getAllBranches);
router.get('/:id', getBranchById);
router.put('/:id', updateBranch);

module.exports = router;