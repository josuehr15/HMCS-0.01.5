const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
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
const documentRoutes = require('./routes/documents');
const perDiemRoutes = require('./routes/perDiem');
const accountingRoutes = require('./routes/accounting');
const settingsRoutes = require('./routes/settings');

const app = express();
const PORT = process.env.PORT || 5000;

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads', 'documents');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// ─── Middleware ──────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// BUG-005: CORS with explicit whitelist instead of wildcard
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:5174'];
app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (e.g., mobile apps, curl)
        if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
        callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true, // SEC-001: required for httpOnly cookie exchange
}));

app.use(cookieParser()); // SEC-001: parse httpOnly auth cookie
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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
app.use('/api/documents', documentRoutes);
app.use('/api/accounting', accountingRoutes);
app.use('/api/settings', settingsRoutes);

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
        console.log('⏳ Connecting to database...');

        // Test database connection
        const connected = await testConnection();
        if (!connected) {
            console.error('❌ Failed to connect to the database. Server not started.');
            console.error('   → Make sure PostgreSQL is running and the credentials in .env are correct.');
            process.exit(1);
        }

        // Sync models with database (creates tables if they don't exist)
        console.log('⏳ Synchronizing database models...');
        try {
            await sequelize.sync({ alter: true });
            console.log('✅ Database models synchronized successfully.');
        } catch (syncError) {
            console.error('❌ Failed to sync database models:');
            console.error('   Message:', syncError.message);
            console.error('   SQL:', syncError.sql || '(no SQL)');
            console.error('   Full error:', syncError);
            process.exit(1);
        }

        // Start listening
        app.listen(PORT, () => {
            console.log(`✅ HMCS Server running on port ${PORT}`);
            console.log(`   Health check: http://localhost:${PORT}/api/health`);
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error.message);
        console.error(error);
        process.exit(1);
    }
};

startServer();

module.exports = app;
