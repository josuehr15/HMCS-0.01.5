const User = require('./User');
const Worker = require('./Worker');
const Client = require('./Client');
const Trade = require('./Trade');
const Project = require('./Project');
const Assignment = require('./Assignment');
const ClientRate = require('./ClientRate');
const TimeEntry = require('./TimeEntry');
const Invoice = require('./Invoice');
const InvoiceLine = require('./InvoiceLine');
const Payroll = require('./Payroll');
const PayrollLine = require('./PayrollLine');
const PerDiemEntry = require('./PerDiemEntry');

// ─── User Associations ─────────────────────────────────
User.hasOne(Worker, { foreignKey: 'user_id', as: 'worker' });
User.hasOne(Client, { foreignKey: 'user_id', as: 'client' });

// ─── Worker Associations ────────────────────────────────
Worker.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
Worker.belongsTo(Trade, { foreignKey: 'trade_id', as: 'trade' });
Worker.hasMany(Assignment, { foreignKey: 'worker_id', as: 'assignments' });
Worker.hasMany(TimeEntry, { foreignKey: 'worker_id', as: 'timeEntries' });
Worker.hasMany(InvoiceLine, { foreignKey: 'worker_id', as: 'invoiceLines' });
Worker.hasMany(PayrollLine, { foreignKey: 'worker_id', as: 'payrollLines' });
Worker.hasMany(PerDiemEntry, { foreignKey: 'worker_id', as: 'perDiemEntries' });

// ─── Client Associations ────────────────────────────────
Client.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
Client.hasMany(Project, { foreignKey: 'client_id', as: 'projects' });
Client.hasMany(ClientRate, { foreignKey: 'client_id', as: 'clientRates' });
Client.hasMany(Invoice, { foreignKey: 'client_id', as: 'invoices' });

// ─── Trade Associations ─────────────────────────────────
Trade.hasMany(Worker, { foreignKey: 'trade_id', as: 'workers' });
Trade.hasMany(ClientRate, { foreignKey: 'trade_id', as: 'clientRates' });
Trade.hasMany(InvoiceLine, { foreignKey: 'trade_id', as: 'invoiceLines' });

// ─── Project Associations ───────────────────────────────
Project.belongsTo(Client, { foreignKey: 'client_id', as: 'client' });
Project.hasMany(Assignment, { foreignKey: 'project_id', as: 'assignments' });
Project.hasMany(TimeEntry, { foreignKey: 'project_id', as: 'timeEntries' });
Project.hasMany(Invoice, { foreignKey: 'project_id', as: 'invoices' });

// ─── Assignment Associations ────────────────────────────
Assignment.belongsTo(Worker, { foreignKey: 'worker_id', as: 'worker' });
Assignment.belongsTo(Project, { foreignKey: 'project_id', as: 'project' });
Assignment.hasMany(TimeEntry, { foreignKey: 'assignment_id', as: 'timeEntries' });
Assignment.hasMany(PerDiemEntry, { foreignKey: 'assignment_id', as: 'perDiemEntries' });

// ─── ClientRate Associations ────────────────────────────
ClientRate.belongsTo(Client, { foreignKey: 'client_id', as: 'client' });
ClientRate.belongsTo(Trade, { foreignKey: 'trade_id', as: 'trade' });

// ─── TimeEntry Associations ────────────────────────────
TimeEntry.belongsTo(Worker, { foreignKey: 'worker_id', as: 'worker' });
TimeEntry.belongsTo(Project, { foreignKey: 'project_id', as: 'project' });
TimeEntry.belongsTo(Assignment, { foreignKey: 'assignment_id', as: 'assignment' });
TimeEntry.belongsTo(User, { foreignKey: 'approved_by_user_id', as: 'approvedBy' });

// ─── Invoice Associations ──────────────────────────────
Invoice.belongsTo(Client, { foreignKey: 'client_id', as: 'client' });
Invoice.belongsTo(Project, { foreignKey: 'project_id', as: 'project' });
Invoice.belongsTo(User, { foreignKey: 'approved_by_user_id', as: 'approvedBy' });
Invoice.hasMany(InvoiceLine, { foreignKey: 'invoice_id', as: 'lines' });

// ─── InvoiceLine Associations ──────────────────────────
InvoiceLine.belongsTo(Invoice, { foreignKey: 'invoice_id', as: 'invoice' });
InvoiceLine.belongsTo(Worker, { foreignKey: 'worker_id', as: 'worker' });
InvoiceLine.belongsTo(Trade, { foreignKey: 'trade_id', as: 'trade' });

// ─── Payroll Associations ──────────────────────────────
Payroll.belongsTo(User, { foreignKey: 'approved_by_user_id', as: 'approvedBy' });
Payroll.hasMany(PayrollLine, { foreignKey: 'payroll_id', as: 'lines' });

// ─── PayrollLine Associations ──────────────────────────
PayrollLine.belongsTo(Payroll, { foreignKey: 'payroll_id', as: 'payroll' });
PayrollLine.belongsTo(Worker, { foreignKey: 'worker_id', as: 'worker' });

// ─── PerDiemEntry Associations ─────────────────────────
PerDiemEntry.belongsTo(Worker, { foreignKey: 'worker_id', as: 'worker' });
PerDiemEntry.belongsTo(Assignment, { foreignKey: 'assignment_id', as: 'assignment' });

module.exports = {
    User, Worker, Client, Trade, Project, Assignment, ClientRate,
    TimeEntry, Invoice, InvoiceLine, Payroll, PayrollLine, PerDiemEntry,
};
