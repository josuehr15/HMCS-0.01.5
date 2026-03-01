const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const { sequelize, testConnection } = require('./config/database');

// Import models (triggers association setup)
const models = require('./models');

// Import routes
const authRoutes = require('./routes/auth');
const workerRoutes = require('./routes/workers');
const clientRoutes = require('./routes/clients');
const tradeRoutes = require('./routes/trades');
const timeEntryRoutes = require('./routes/timeEntries');
const projectRoutes = require('./routes/projects');
const assignmentRoutes = require('./routes/assignments');
const invoiceRoutes = require('./routes/invoices');
const payrollRoutes = require('./routes/payroll');
const perDiemRoutes = require('./routes/perDiem');

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Middleware ──────────────────────────────────────────
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Routes ─────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/workers', workerRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/trades', tradeRoutes);
app.use('/api/time-entries', timeEntryRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/per-diem', perDiemRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'HMCS API is running.',
        timestamp: new Date().toISOString(),
    });
});

// ─── 404 Handler ────────────────────────────────────────
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `Route ${req.originalUrl} not found.`,
    });
});

// ─── Error Handler ──────────────────────────────────────
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        success: false,
        message: 'Internal server error.',
    });
});

// ─── Start Server ───────────────────────────────────────
const startServer = async () => {
    try {
        // Test database connection
        const connected = await testConnection();
        if (!connected) {
            console.error('Failed to connect to the database. Server not started.');
            process.exit(1);
        }

        // Sync models with database (creates tables if they don't exist)
        await sequelize.sync({ alter: true });
        console.log('Database models synchronized successfully.');

        // Start listening
        app.listen(PORT, () => {
            console.log(`HMCS Server running on port ${PORT}`);
            console.log(`Health check: http://localhost:${PORT}/api/health`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer();

module.exports = app;
