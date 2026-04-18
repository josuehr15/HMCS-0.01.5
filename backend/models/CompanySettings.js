const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const CompanySettings = sequelize.define('CompanySettings', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    company_name: { type: DataTypes.STRING, allowNull: false, defaultValue: 'HM Construction Staffing LLLP' },
    address: { type: DataTypes.STRING, allowNull: true, defaultValue: '500 Lucas Dr' },
    city: { type: DataTypes.STRING, allowNull: true, defaultValue: 'Savannah' },
    state: { type: DataTypes.STRING, allowNull: true, defaultValue: 'GA' },
    zip: { type: DataTypes.STRING, allowNull: true, defaultValue: '31406-9435' },
    email: { type: DataTypes.STRING, allowNull: true, defaultValue: 'hmconstruction.staffing@gmail.com' },
    phone: { type: DataTypes.STRING, allowNull: true, defaultValue: '+1 (912) 695-1424' },
    logo_url: { type: DataTypes.STRING, allowNull: true },
    // Dedicated logo fields for header (horizontal) and invoices (square)
    logo_horizontal_url: { type: DataTypes.TEXT, allowNull: true },
    logo_square_url: { type: DataTypes.TEXT, allowNull: true },
    invoice_next_number: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    invoice_prefix: { type: DataTypes.STRING, allowNull: false, defaultValue: '26' },
    payroll_next_number: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    payment_terms_days: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 14 },
    payment_instructions: {
        type: DataTypes.TEXT, allowNull: true,
        defaultValue: 'Please make checks payable to: HM Construction Staffing LLLP'
    },
    // LOGICA-004: overtime threshold read from DB, never hardcoded in controllers
    standard_hours_per_week: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 40,
    },
    // LOGICA-005: default OT multiplier for payroll (client rates override this per trade)
    default_ot_multiplier: {
        type: DataTypes.DECIMAL(4, 2),
        allowNull: false,
        defaultValue: 1.50,
    },
    // Default payment method for payroll disbursement
    default_payment_method: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'zelle',
    },
    // Which day the work week starts (monday | sunday)
    week_start_day: {
        type: DataTypes.STRING(10),
        allowNull: false,
        defaultValue: 'monday',
    },
    // Notification preferences stored as JSON
    notification_preferences: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {
            missing_clock_out: true,
            pending_time_entries: true,
            overtime_detected: false,
            invoice_pending_approval: true,
            invoice_overdue: true,
            payroll_ready: true,
            payroll_paid: false,
        },
    },
    // Optional footer note that appears on invoices
    invoice_footer_note: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
}, {
    tableName: 'company_settings',
    underscored: true,
    timestamps: true,
});

module.exports = CompanySettings;
