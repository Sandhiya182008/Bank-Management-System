// =====================================================================
// College DBMS Project: Bank Management System
// Main Application Server
// Architecture: Express Backend + PostgreSQL Raw SQL
// =====================================================================

const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const db = require('./config/db');

const app = express();
const PORT = process.env.PORT || 5000;

// Standard Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 1. Health Check Endpoint & Database Verification
app.get('/api/health', async (req, res) => {
    try {
        const result = await db.query('SELECT NOW() AS current_db_time, 1 AS status');
        res.status(200).json({
            status: 'success',
            message: 'Bank Management System API is healthy',
            database: 'Connected to PostgreSQL',
            serverTime: new Date().toISOString(),
            dbTime: result.rows[0].current_db_time
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Database connection failed',
            error: error.message
        });
    }
});

// 2. Project Metadata Endpoint
app.get('/api/info', (req, res) => {
    res.json({
        project: 'Bank Management System',
        level: '2nd-Year CSE DBMS Project',
        database: 'PostgreSQL 15 / 16 (node-postgres explicit SQL)',
        team: [
            { name: 'Sandhiya', role: 'Database Design & Integration Lead' },
            { name: 'Sadhana', role: 'Customer & Account Module' },
            { name: 'Shivarakshana', role: 'Transaction Module' },
            { name: 'Pavi', role: 'Loan, Employee & Branch Module' },
            { name: 'Resh', role: 'Frontend, Dashboard & Testing' }
        ]
    });
});

// 3. Mount Modular Routes
// Note: Individual team members will implement their routes on separate Git feature branches.
app.use('/api/customers', require('./routes/customerRoutes'));
app.use('/api/accounts', require('./routes/accountRoutes'));
// app.use('/api/transactions', require('./routes/transactionRoutes'));
// app.use('/api/loans', require('./routes/loanRoutes'));
// app.use('/api/employees', require('./routes/employeeRoutes'));
// app.use('/api/dashboard', require('./routes/dashboardRoutes'));

// Global 404 Handler for undefined API routes
app.use('/api/*', (req, res) => {
    res.status(404).json({
        status: 'error',
        message: `Endpoint ${req.originalUrl} not found or module pending implementation`
    });
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('Unhandled Error:', err.stack);
    res.status(500).json({
        status: 'error',
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'production' ? null : err.message
    });
});

// Start Express Server
app.listen(PORT, () => {
    console.log(`===================================================`);
    console.log(` Bank Management System - Backend Server Running`);
    console.log(` Port: ${PORT}`);
    console.log(` Health Check: http://localhost:${PORT}/api/health`);
    console.log(` Project Info: http://localhost:${PORT}/api/info`);
    console.log(`===================================================`);
});
