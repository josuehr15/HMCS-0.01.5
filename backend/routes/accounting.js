const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const checkRole = require('../middleware/checkRole');
const {
    getCategories, createCategory, updateCategory, deleteCategory,
    getTransactions, getTransactionById, createTransaction, updateTransaction, deleteTransaction,
    splitTransaction,
    previewCSV, confirmCSV,
    getPnL, getMarginsWorkers, getMarginsClients, getCashFlow,
    getTaxSummary, get1099Report,
    getDashboardSummary, getCashflowYear,
    previewImport, confirmImport, undoImport, getImportHistory,
    getRules, createRule, updateRule, deleteRule, applyRule, previewRuleCount,
} = require('../controllers/accountingController');

router.use(auth);

// ── Accounting Categories ──────────────────────────────────────────
router.get('/categories', checkRole('admin'), getCategories);
router.post('/categories', checkRole('admin'), createCategory);
router.put('/categories/:id', checkRole('admin'), updateCategory);
router.delete('/categories/:id', checkRole('admin'), deleteCategory);

// ── Dashboard endpoints ────────────────────────────────────────────
router.get('/dashboard-summary', checkRole('admin'), getDashboardSummary);
router.get('/cashflow-year', checkRole('admin'), getCashflowYear);

// ── Reports (before /transactions to avoid routing conflicts) ──────
router.get('/pnl', checkRole('admin'), getPnL);
router.get('/margins/workers', checkRole('admin'), getMarginsWorkers);
router.get('/margins/clients', checkRole('admin'), getMarginsClients);
router.get('/cash-flow', checkRole('admin'), getCashFlow);
router.get('/tax-summary', checkRole('admin'), getTaxSummary);
router.get('/1099-report', checkRole('admin'), get1099Report);

// ── Transaction Rules ──────────────────────────────────────────────
router.get('/rules',                   checkRole('admin'), getRules);
router.post('/rules/preview-count',    checkRole('admin'), previewRuleCount);
router.post('/rules',                  checkRole('admin'), createRule);
router.put('/rules/:id',               checkRole('admin'), updateRule);
router.delete('/rules/:id',            checkRole('admin'), deleteRule);
router.post('/rules/:id/apply',        checkRole('admin'), applyRule);

// ── CSV Import v2 (3-step flow) ────────────────────────────────────
router.get('/import/history',   checkRole('admin'), getImportHistory);
router.post('/import/preview',  checkRole('admin'), previewImport);
router.post('/import/confirm',  checkRole('admin'), confirmImport);
router.delete('/import/:batchId', checkRole('admin'), undoImport);

// ── CSV Import (legacy) ────────────────────────────────────────────
router.post('/import-csv', checkRole('admin'), previewCSV);
router.post('/import-csv/confirm', checkRole('admin'), confirmCSV);

// ── Transactions ──────────────────────────────────────────────────
router.get('/transactions', checkRole('admin'), getTransactions);
router.post('/transactions', checkRole('admin'), createTransaction);
router.get('/transactions/:id', checkRole('admin'), getTransactionById);
router.put('/transactions/:id', checkRole('admin'), updateTransaction);
router.delete('/transactions/:id', checkRole('admin'), deleteTransaction);
router.post('/transactions/:id/split', checkRole('admin'), splitTransaction);

module.exports = router;
