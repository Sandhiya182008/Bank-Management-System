// =====================================================================
// College DBMS Project: Bank Management System
// Module: Authentication & Access Control
// Routes: Authentication Routes (backend/routes/authRoutes.js)
// Description: REST API route endpoints for User registration, login,
//              and profile verification.
// =====================================================================

const express = require('express');
const router = express.Router();

const { register, login, getMe } = require('../controllers/authController');
const { authenticateToken } = require('../middleware/authMiddleware');

// =====================================================================
// Public Routes
// =====================================================================

// 1. Register a new user (Customer or Employee)
// POST /api/auth/register
router.post('/register', register);

// 2. Login user and receive JWT
// POST /api/auth/login
router.post('/login', login);

// =====================================================================
// Protected Routes
// =====================================================================

// 3. Fetch profile of currently authenticated user
// GET /api/auth/me
router.get('/me', authenticateToken, getMe);

module.exports = router;
