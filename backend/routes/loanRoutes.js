const express = require('express');

const {
  createLoan,
  getAllLoans,
  getLoanById,
  updateLoan
} = require('../controllers/loanController');

const router = express.Router();

router.post('/', createLoan);
router.get('/', getAllLoans);
router.get('/:id', getLoanById);
router.put('/:id', updateLoan);

module.exports = router;
