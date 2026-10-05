// =====================================================================
// College DBMS Project: Bank Management System
// Module: Authentication & Access Control
// Middleware: Authentication & Authorization Middleware (backend/middleware/authMiddleware.js)
// Description: Verifies JSON Web Tokens (JWT) from Authorization header and
//              provides reusable role-based access control for Customer/Employee.
// =====================================================================

const jwt = require('jsonwebtoken');
const db = require('../config/db');

/**
 * Middleware to authenticate requests via JWT Bearer token.
 *
 * Flow:
 *  1. Extracts 'Authorization' header from incoming request.
 *  2. Expects format: 'Bearer <token>'.
 *  3. Verifies token signature and expiration using process.env.JWT_SECRET.
 *  4. Attaches decoded token payload to req.user ({ user_id, email, role, customer_id, employee_id }).
 *  5. Returns 401 Unauthorized if token is missing, malformed, invalid, or expired.
 */
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];

    if (!authHeader) {
        return res.status(401).json({
            status: 'error',
            message: 'Access denied. Authorization header is missing.'
        });
    }

    // Header must follow 'Bearer <token>' pattern
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
        return res.status(401).json({
            status: 'error',
            message: 'Access denied. Token format must be: Bearer <token>'
        });
    }

    const token = parts[1].trim();
    if (!token) {
        return res.status(401).json({
            status: 'error',
            message: 'Access denied. Token string is empty.'
        });
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
        console.error('CRITICAL: JWT_SECRET environment variable is not defined.');
        return res.status(500).json({
            status: 'error',
            message: 'Internal server error: Authentication secret is not configured.'
        });
    }

    jwt.verify(token, jwtSecret, (err, decoded) => {
        if (err) {
            if (err.name === 'TokenExpiredError') {
                return res.status(401).json({
                    status: 'error',
                    message: 'Authentication failed. Token has expired. Please log in again.'
                });
            }
            return res.status(401).json({
                status: 'error',
                message: 'Authentication failed. Token is invalid or has been tampered with.'
            });
        }

        // Attach decoded payload to request object for downstream controllers
        req.user = decoded;
        next();
    });
};

/**
 * Reusable role-based authorization middleware factory.
 * Restricts access to routes based on user role ('Customer' or 'Employee').
 *
 * Example usage:
 *   router.get('/accounts', authenticateToken, authorizeRoles('Employee'), ...)
 *   router.post('/apply', authenticateToken, authorizeRoles('Customer'), ...)
 *   router.get('/summary', authenticateToken, authorizeRoles('Customer', 'Employee'), ...)
 *
 * @param  {...string} allowedRoles - Array of allowed role names (e.g. 'Customer', 'Employee')
 * @returns {Function} Express middleware function
 */
const authorizeRoles = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user || !req.user.role) {
            return res.status(401).json({
                status: 'error',
                message: 'Access denied. User authentication required.'
            });
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                status: 'error',
                message: `Forbidden. Access restricted to role(s): ${allowedRoles.join(', ')}. Your role: ${req.user.role}`
            });
        }

        next();
    };
};

/**
 * Shortcut middleware to restrict route to Customer role only.
 */
const requireCustomer = authorizeRoles('Customer');

/**
 * Shortcut middleware to restrict route to Employee role only.
 */
const requireEmployee = authorizeRoles('Employee');

/**
 * Reusable middleware to restrict access to specific Employee sub-roles
 * stored in the Employee database table (e.g. 'Manager', 'Loan Officer').
 *
 * @param {...string} allowedSubRoles - Allowed employee sub-roles (e.g., 'Manager', 'Loan Officer')
 * @returns {Function} Express middleware function
 */
const requireEmployeeSubRoles = (...allowedSubRoles) => {
    return async (req, res, next) => {
        if (!req.user || req.user.role !== 'Employee' || !req.user.employee_id) {
            return res.status(403).json({
                status: 'error',
                message: 'Forbidden: Access restricted to employees.'
            });
        }

        try {
            const result = await db.query(
                'SELECT role FROM Employee WHERE employee_id = $1',
                [req.user.employee_id]
            );

            if (result.rows.length === 0) {
                return res.status(403).json({
                    status: 'error',
                    message: 'Forbidden: Employee record not found.'
                });
            }

            const currentRole = result.rows[0].role;
            if (!allowedSubRoles.includes(currentRole)) {
                return res.status(403).json({
                    status: 'error',
                    message: `Forbidden: Operation restricted to role(s): ${allowedSubRoles.join(', ')}. Current role: ${currentRole}`
                });
            }

            req.user.employee_subrole = currentRole;
            next();
        } catch (err) {
            console.error('Error verifying employee sub-role:', err.message);
            return res.status(500).json({
                status: 'error',
                message: 'Internal server error verifying employee authorization.'
            });
        }
    };
};

/**
 * Specific shortcut middleware restricting loan approval/rejection/updates
 * exclusively to Loan Officers and Managers.
 */
const requireLoanApprover = requireEmployeeSubRoles('Loan Officer', 'Manager');

module.exports = {
    authenticateToken,
    authorizeRoles,
    requireRole: authorizeRoles, // Alias for flexibility
    requireCustomer,
    requireEmployee,
    requireEmployeeSubRoles,
    requireLoanApprover
};
