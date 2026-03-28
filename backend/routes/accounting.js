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
} = require('../controllers/accountingController');

router.use(auth);

// ── Accounting Categories ──────────────────────────────────────────
router.get('/categories', checkRole('admin'), getCategories);
router.post('/categories', checkRole('admin'), createCategory);
router.put('/categories/:id', checkRole('admin'), updateCategory);
router.delete('/categories/:id', checkRole('admin'), deleteCategory);

// ── Reports (before /transactions to avoid routing conflicts) ──────
router.get('/pnl', checkRole('admin'), getPnL);
router.get('/margins/workers', checkRole('admin'), getMarginsWorkers);
router.get('/margins/clients', checkRole('admin'), getMarginsClients);
router.get('/cash-flow', checkRole('admin'), getCashFlow);
router.get('/tax-summary', checkRole('admin'), getTaxSummary);
router.get('/1099-report', checkRole('admin'), get1099Report);

// ── CSV Import ─────────────────────────────────────────────────────
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
