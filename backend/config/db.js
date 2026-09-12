// =====================================================================
// College DBMS Project: Bank Management System
// Module: Database Design & Integration
// Lead: Sandhiya
// Description: PostgreSQL Connection Pool and Transaction Helper
// =====================================================================

const { Pool } = require('pg');
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

// Configure PostgreSQL connection pool using environment variables
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'bank_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    max: 20, // maximum connection pool size
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
});

// Event listener for pool connection logging
pool.on('connect', () => {
    // Connection established successfully
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle PostgreSQL client:', err.message);
});

/**
 * Executes a single parameterized SQL query.
 * @param {string} text - SQL statement with $1, $2 placeholders
 * @param {Array} params - Values to safely bind
 * @returns {Promise<pg.QueryResult>}
 */
const query = async (text, params = []) => {
    const start = Date.now();
    try {
        const res = await pool.query(text, params);
        const duration = Date.now() - start;
        return res;
    } catch (err) {
        console.error('Database Query Error:', {
            text,
            error: err.message
        });
        throw err;
    }
};

/**
 * Acquires a dedicated client from the pool for ACID transactions (BEGIN, COMMIT, ROLLBACK).
 * Crucial for fund transfers to ensure consistency.
 * @returns {Promise<pg.PoolClient>}
 */
const getClient = async () => {
    const client = await pool.connect();
    return client;
};

module.exports = {
    pool,
    query,
    getClient
};
