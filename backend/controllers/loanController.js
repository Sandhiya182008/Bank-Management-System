const pool = require('../config/db');

const VALID_LOAN_TYPES = ['Personal', 'Home', 'Education', 'Vehicle'];
const VALID_STATUSES = ['Applied', 'Approved', 'Rejected', 'Closed'];

const isValidPositiveNumber = (value) =>
  value !== undefined &&
  value !== null &&
  Number.isFinite(Number(value)) &&
  Number(value) > 0;

const isValidPositiveInteger = (value) =>
  Number.isInteger(Number(value)) && Number(value) > 0;

const handleDbError = (error, res) => {
  if (error.code === '23505') {
    return res.status(409).json({
      message: 'Loan number already exists'
    });
  }

  if (error.code === '23503') {
    return res.status(400).json({
      message: 'Invalid customer or branch ID'
    });
  }

  console.error('Loan database error:', error);

  return res.status(500).json({
    message: 'Internal server error'
  });
};

/**
 * 1. Create a new Loan / Loan Application
 * POST /api/loans
 *
 * Customer:
 *  - Must only apply for themselves (forces customer_id = req.user.customer_id)
 *  - Must always start with status = 'Applied' (ignores any client-supplied status)
 * Employee:
 *  - Can create a loan for any valid customer_id
 *  - Status defaults to 'Applied' if not provided
 */
const createLoan = async (req, res) => {
  try {
    const {
      loan_number,
      customer_id,
      branch_id,
      loan_type,
      loan_amount,
      interest_rate,
      duration_months,
      status,
      applied_date
    } = req.body;

    // Determine target customer_id and initial status based on role
    let targetCustomerId;
    let targetStatus;

    if (req.user && req.user.role === 'Customer') {
      // Force customer_id from verified JWT; ignore any customer_id in req.body
      targetCustomerId = Number(req.user.customer_id);
      // Customer-created loans must strictly start with status = 'Applied'
      targetStatus = 'Applied';
    } else {
      // For Employee: validate customer_id provided in body
      if (!isValidPositiveInteger(customer_id)) {
        return res.status(400).json({
          message: 'Invalid or missing customer ID'
        });
      }
      targetCustomerId = Number(customer_id);
      targetStatus = status || 'Applied';
    }

    if (
      !loan_number ||
      !isValidPositiveInteger(targetCustomerId) ||
      !isValidPositiveInteger(branch_id) ||
      !VALID_LOAN_TYPES.includes(loan_type) ||
      !isValidPositiveNumber(loan_amount) ||
      !isValidPositiveNumber(interest_rate) ||
      !isValidPositiveInteger(duration_months)
    ) {
      return res.status(400).json({
        message: 'Invalid or missing loan details'
      });
    }

    const result = await pool.query(
      `INSERT INTO loan
       (loan_number, customer_id, branch_id, loan_type, loan_amount,
        interest_rate, duration_months, status, applied_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9, CURRENT_DATE))
       RETURNING *`,
      [
        loan_number.trim(),
        targetCustomerId,
        Number(branch_id),
        loan_type,
        Number(loan_amount),
        Number(interest_rate),
        Number(duration_months),
        targetStatus,
        applied_date || null
      ]
    );

    return res.status(201).json({
      message: 'Loan created successfully',
      loan: result.rows[0]
    });
  } catch (error) {
    return handleDbError(error, res);
  }
};

/**
 * 2. Get All Loans
 * GET /api/loans
 *
 * Employee: retrieves all loans across the bank.
 * Customer: scoped strictly to loans belonging to req.user.customer_id.
 */
const getAllLoans = async (req, res) => {
  try {
    let sql = `SELECT
         l.loan_id,
         l.loan_number,
         l.customer_id,
         CONCAT(c.first_name, ' ', c.last_name) AS customer_name,
         l.branch_id,
         b.branch_name,
         l.loan_type,
         l.loan_amount,
         l.interest_rate,
         l.duration_months,
         l.status,
         l.applied_date
       FROM loan l
       JOIN customer c ON l.customer_id = c.customer_id
       JOIN branch b ON l.branch_id = b.branch_id`;
    const params = [];

    // Role-based scoping: Customers receive only their own loans
    if (req.user && req.user.role === 'Customer') {
      sql += ` WHERE l.customer_id = $1`;
      params.push(req.user.customer_id);
    }

    sql += ` ORDER BY l.loan_id`;

    const result = await pool.query(sql, params);

    return res.status(200).json(result.rows);
  } catch (error) {
    console.error('Get all loans error:', error);

    return res.status(500).json({
      message: 'Internal server error'
    });
  }
};

/**
 * 3. Get Loan by ID
 * GET /api/loans/:id
 *
 * Employee: can view any loan.
 * Customer: can view only their own loan (403 if belonging to another customer).
 */
const getLoanById = async (req, res) => {
  try {
    const loanId = Number(req.params.id);

    if (!isValidPositiveInteger(loanId)) {
      return res.status(400).json({
        message: 'Invalid loan ID'
      });
    }

    const result = await pool.query(
      `SELECT
         l.loan_id,
         l.loan_number,
         l.customer_id,
         CONCAT(c.first_name, ' ', c.last_name) AS customer_name,
         l.branch_id,
         b.branch_name,
         l.loan_type,
         l.loan_amount,
         l.interest_rate,
         l.duration_months,
         l.status,
         l.applied_date
       FROM loan l
       JOIN customer c ON l.customer_id = c.customer_id
       JOIN branch b ON l.branch_id = b.branch_id
       WHERE l.loan_id = $1`,
      [loanId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: 'Loan not found'
      });
    }

    const loan = result.rows[0];

    // Ownership Check: Customer can view only their own loan
    if (req.user && req.user.role === 'Customer') {
      if (Number(loan.customer_id) !== Number(req.user.customer_id)) {
        return res.status(403).json({
          message: 'Forbidden: You are not authorized to view this loan'
        });
      }
    }

    return res.status(200).json(loan);
  } catch (error) {
    console.error('Get loan error:', error);

    return res.status(500).json({
      message: 'Internal server error'
    });
  }
};

/**
 * 4. Update Loan (Status, Terms, Approval/Rejection)
 * PUT /api/loans/:id
 *
 * Restricted to Loan Officers and Managers.
 * Customers receive 403 Forbidden.
 */
const updateLoan = async (req, res) => {
  try {
    // Defense-in-depth: Customers are strictly forbidden from updating/approving loans
    if (req.user && req.user.role === 'Customer') {
      return res.status(403).json({
        message: 'Forbidden: Customers are not authorized to update or approve loans'
      });
    }

    const loanId = Number(req.params.id);

    if (!isValidPositiveInteger(loanId)) {
      return res.status(400).json({
        message: 'Invalid loan ID'
      });
    }

    const {
      loan_type,
      loan_amount,
      interest_rate,
      duration_months,
      status
    } = req.body;

    if (
      !VALID_LOAN_TYPES.includes(loan_type) ||
      !isValidPositiveNumber(loan_amount) ||
      !isValidPositiveNumber(interest_rate) ||
      !isValidPositiveInteger(duration_months) ||
      !VALID_STATUSES.includes(status)
    ) {
      return res.status(400).json({
        message: 'Invalid loan update details'
      });
    }

    const result = await pool.query(
      `UPDATE loan
       SET loan_type = $1,
           loan_amount = $2,
           interest_rate = $3,
           duration_months = $4,
           status = $5
       WHERE loan_id = $6
       RETURNING *`,
      [
        loan_type,
        Number(loan_amount),
        Number(interest_rate),
        Number(duration_months),
        status,
        loanId
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: 'Loan not found'
      });
    }

    return res.status(200).json({
      message: 'Loan updated successfully',
      loan: result.rows[0]
    });
  } catch (error) {
    return handleDbError(error, res);
  }
};

module.exports = {
  createLoan,
  getAllLoans,
  getLoanById,
  updateLoan
};
