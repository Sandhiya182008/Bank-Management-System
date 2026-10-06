// =====================================================================
// College DBMS Project: Bank Management System
// Module: Authentication & Access Control
// Controller: Authentication Controller (backend/controllers/authController.js)
// Description: Handles user registration, bcrypt password hashing, login
//              authentication, and JWT issuance using parameterized raw SQL.
// =====================================================================

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

// Number of salt rounds for bcrypt hashing (standard industry benchmark)
const BCRYPT_SALT_ROUNDS = 10;

// =====================================================================
// Helper Validation Functions
// =====================================================================

/**
 * Validates email format using standard regex.
 * @param {string} email
 * @returns {boolean}
 */
const isValidEmail = (email) => {
    if (!email || typeof email !== 'string') return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim()) && email.trim().length <= 100;
};

/**
 * Validates whether an ID is a valid positive integer.
 * @param {any} id
 * @returns {boolean}
 */
const isValidPositiveInteger = (id) => {
    if (id === undefined || id === null) return false;
    const str = String(id).trim();
    return /^[1-9]\d*$/.test(str);
};

// =====================================================================
// Authentication Controller Methods
// =====================================================================

/**
 * 1. Register a new user (Customer or Employee).
 * POST /api/auth/register
 *
 * Request Body:
 * {
 *   "email": "user@example.com",
 *   "password": "securePassword123",
 *   "role": "Customer" | "Employee",
 *   "customer_id": 1,        // Required if role === 'Customer', omitted/null if Employee
 *   "employee_id": null      // Required if role === 'Employee', omitted/null if Customer
 * }
 */
const register = async (req, res) => {
    try {
        const { email, password, role, customer_id, employee_id } = req.body;

        // 1. Validate required fields presence
        if (!email || !password || !role) {
            return res.status(400).json({
                status: 'error',
                message: 'Validation failed: email, password, and role are required fields.'
            });
        }

        // 2. Validate email format
        if (!isValidEmail(email)) {
            return res.status(400).json({
                status: 'error',
                message: 'Validation failed: A valid email address (up to 100 characters) is required.'
            });
        }

        // 3. Validate password strength/length
        if (typeof password !== 'string' || password.length < 6) {
            return res.status(400).json({
                status: 'error',
                message: 'Validation failed: Password must be at least 6 characters long.'
            });
        }

        // 4. Validate role constraint (Public registration is restricted to 'Customer' role only)
        if (role === 'Employee') {
            return res.status(403).json({
                status: 'error',
                message: 'Forbidden: Employee accounts cannot be created through public registration.'
            });
        }

        if (role !== 'Customer') {
            return res.status(400).json({
                status: 'error',
                message: "Validation failed: Role must be 'Customer'."
            });
        }

        // 5. Validate entity linkage constraint:
        //    Customer -> customer_id is positive INT, employee_id must be null/empty
        let targetCustomerId = null;
        let targetEmployeeId = null;

        if (role === 'Customer') {
            if (!isValidPositiveInteger(customer_id)) {
                return res.status(400).json({
                    status: 'error',
                    message: "Validation failed: For 'Customer' role, a valid positive customer_id is required."
                });
            }
            if (employee_id !== undefined && employee_id !== null && String(employee_id).trim() !== '') {
                return res.status(400).json({
                    status: 'error',
                    message: "Validation failed: For 'Customer' role, employee_id must be null or omitted."
                });
            }
            targetCustomerId = parseInt(customer_id, 10);
        }

        const normalizedEmail = email.trim().toLowerCase();

        // 6. Check if email is already registered in "User" table
        const existingEmailResult = await db.query(
            'SELECT user_id FROM "User" WHERE LOWER(email) = $1',
            [normalizedEmail]
        );
        if (existingEmailResult.rows.length > 0) {
            return res.status(409).json({
                status: 'error',
                message: 'Conflict: An account with this email address already exists.'
            });
        }

        // 7. Verify corresponding entity exists in database and has no existing account
        if (role === 'Customer') {
            const customerCheck = await db.query(
                'SELECT customer_id FROM Customer WHERE customer_id = $1',
                [targetCustomerId]
            );
            if (customerCheck.rows.length === 0) {
                return res.status(404).json({
                    status: 'error',
                    message: `Not Found: Customer with ID ${targetCustomerId} does not exist.`
                });
            }

            const existingCustomerUser = await db.query(
                'SELECT user_id FROM "User" WHERE customer_id = $1',
                [targetCustomerId]
            );
            if (existingCustomerUser.rows.length > 0) {
                return res.status(409).json({
                    status: 'error',
                    message: `Conflict: A user account is already registered for Customer ID ${targetCustomerId}.`
                });
            }
        }

        // 8. Hash password using bcrypt before storing
        const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

        // 9. Insert into "User" table using parameterized query
        // NOTE: Table name is quoted as "User" because user is a PostgreSQL reserved word.
        // We explicitly omit password_hash from the RETURNING clause.
        const insertQuery = `
            INSERT INTO "User" (email, password_hash, role, customer_id, employee_id)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING user_id, email, role, customer_id, employee_id, created_at;
        `;
        const insertParams = [
            normalizedEmail,
            passwordHash,
            role,
            targetCustomerId,
            targetEmployeeId
        ];

        const insertResult = await db.query(insertQuery, insertParams);
        const newUser = insertResult.rows[0];

        return res.status(201).json({
            status: 'success',
            message: 'User registered successfully.',
            data: {
                user: newUser
            }
        });
    } catch (error) {
        console.error('Registration Error:', error.message);

        // Handle PostgreSQL unique constraint violations (23505)
        if (error.code === '23505') {
            return res.status(409).json({
                status: 'error',
                message: 'Conflict: Email is already registered.'
            });
        }

        // Handle PostgreSQL foreign key violations (23503)
        if (error.code === '23503') {
            return res.status(404).json({
                status: 'error',
                message: 'Foreign key error: Linked Customer or Employee record does not exist.'
            });
        }

        // Handle PostgreSQL check constraint violations (23514)
        if (error.code === '23514') {
            return res.status(400).json({
                status: 'error',
                message: 'Database check constraint violation on User entity.'
            });
        }

        return res.status(500).json({
            status: 'error',
            message: 'Internal server error during user registration.',
            error: process.env.NODE_ENV === 'production' ? null : error.message
        });
    }
};

/**
 * 2. Login user and issue JWT.
 * POST /api/auth/login
 *
 * Request Body:
 * {
 *   "email": "user@example.com",
 *   "password": "securePassword123"
 * }
 */
const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // 1. Validate required fields
        if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
            return res.status(400).json({
                status: 'error',
                message: 'Validation failed: Email and password are required.'
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        // 2. Look up user by email in "User" table
        const userQuery = `
            SELECT user_id, email, password_hash, role, customer_id, employee_id, created_at
            FROM "User"
            WHERE LOWER(email) = $1;
        `;
        const userResult = await db.query(userQuery, [normalizedEmail]);

        // Generic error message to prevent user enumeration
        const invalidCredentialsMessage = 'Invalid email or password.';

        if (userResult.rows.length === 0) {
            return res.status(401).json({
                status: 'error',
                message: invalidCredentialsMessage
            });
        }

        const user = userResult.rows[0];

        // 3. Compare supplied password against stored bcrypt hash
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({
                status: 'error',
                message: invalidCredentialsMessage
            });
        }

        // 4. Ensure JWT secret is configured
        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
            console.error('CRITICAL: JWT_SECRET environment variable is missing.');
            return res.status(500).json({
                status: 'error',
                message: 'Internal server error: Authentication secret is not configured.'
            });
        }

        // 5. Construct JWT payload (never include password_hash)
        const tokenPayload = {
            user_id: user.user_id,
            email: user.email,
            role: user.role,
            customer_id: user.customer_id,
            employee_id: user.employee_id
        };

        const token = jwt.sign(tokenPayload, jwtSecret, {
            expiresIn: process.env.JWT_EXPIRES_IN || '24h'
        });

        // 6. Return response with token and sanitized user profile
        return res.status(200).json({
            status: 'success',
            message: 'Login successful.',
            data: {
                token,
                user: {
                    user_id: user.user_id,
                    email: user.email,
                    role: user.role,
                    customer_id: user.customer_id,
                    employee_id: user.employee_id,
                    created_at: user.created_at
                }
            }
        });
    } catch (error) {
        console.error('Login Error:', error.message);
        return res.status(500).json({
            status: 'error',
            message: 'Internal server error during authentication.',
            error: process.env.NODE_ENV === 'production' ? null : error.message
        });
    }
};

/**
 * 3. Retrieve currently authenticated user profile.
 * GET /api/auth/me
 * Protected route: requires valid Bearer token.
 */
const getMe = async (req, res) => {
    try {
        if (!req.user || !req.user.user_id) {
            return res.status(401).json({
                status: 'error',
                message: 'Unauthorized: User authentication required.'
            });
        }

        const profileQuery = `
            SELECT user_id, email, role, customer_id, employee_id, created_at
            FROM "User"
            WHERE user_id = $1;
        `;
        const profileResult = await db.query(profileQuery, [req.user.user_id]);

        if (profileResult.rows.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'User profile not found.'
            });
        }

        return res.status(200).json({
            status: 'success',
            message: 'Profile retrieved successfully.',
            data: {
                user: profileResult.rows[0]
            }
        });
    } catch (error) {
        console.error('Get Profile Error:', error.message);
        return res.status(500).json({
            status: 'error',
            message: 'Internal server error retrieving user profile.',
            error: process.env.NODE_ENV === 'production' ? null : error.message
        });
    }
};

module.exports = {
    register,
    login,
    getMe
};
