const { Op, literal, fn, col } = require('sequelize');
const { sequelize } = require('../config/database');
const {
    AccountingCategory, Transaction, BankImport,
    Worker, Client, Project, Invoice, InvoiceLine, Payroll, PayrollLine, PerDiemEntry, Trade, User,
} = require('../models');
const { successResponse, errorResponse } = require('../utils/responseHandler');

// ═════════════════════════════════════════════════════════════
// SEED — create default categories if none exist
// ═════════════════════════════════════════════════════════════
const SEED_CATEGORIES = [
    // INCOME
    { name: 'client_payments', name_es: 'Pagos de Clientes', type: 'income', tax_deductible: false, tax_category: 'business_income' },
    { name: 'mobile_deposits', name_es: 'Depósitos Móviles', type: 'income', tax_deductible: false, tax_category: 'business_income' },
    { name: 'other_income', name_es: 'Otros Ingresos', type: 'income', tax_deductible: false, tax_category: 'other_income' },
    // EXPENSE
    { name: 'payroll_zelle', name_es: 'Nómina Zelle', type: 'expense', tax_deductible: true, tax_category: '1099_payments' },
    { name: 'payroll_cash', name_es: 'Nómina Efectivo', type: 'expense', tax_deductible: true, tax_category: '1099_payments' },
    { name: 'payroll_check', name_es: 'Nómina Cheque', type: 'expense', tax_deductible: true, tax_category: '1099_payments' },
    { name: 'gas', name_es: 'Gasolina', type: 'expense', tax_deductible: true, tax_category: 'vehicle_expense' },
    { name: 'tools', name_es: 'Herramientas', type: 'expense', tax_deductible: true, tax_category: 'supplies' },
    { name: 'equipment', name_es: 'Equipo', type: 'expense', tax_deductible: true, tax_category: 'equipment' },
    { name: 'ppe', name_es: 'Equipo de Protección', type: 'expense', tax_deductible: true, tax_category: 'supplies' },
    { name: 'vehicle_repair', name_es: 'Reparación Vehículo', type: 'expense', tax_deductible: true, tax_category: 'vehicle_expense' },
    { name: 'insurance', name_es: 'Seguros', type: 'expense', tax_deductible: true, tax_category: 'insurance' },
    { name: 'accountant', name_es: 'Contadora', type: 'expense', tax_deductible: true, tax_category: 'professional_services' },
    { name: 'subscriptions', name_es: 'Suscripciones', type: 'expense', tax_deductible: true, tax_category: 'subscriptions' },
    { name: 'office', name_es: 'Oficina', type: 'expense', tax_deductible: true, tax_category: 'office_expense' },
    { name: 'rent', name_es: 'Renta', type: 'expense', tax_deductible: true, tax_category: 'rent' },
    { name: 'phone', name_es: 'Teléfono', type: 'expense', tax_deductible: true, tax_category: 'utilities' },
    { name: 'permits_licenses', name_es: 'Permisos y Licencias', type: 'expense', tax_deductible: true, tax_category: 'licenses' },
    { name: 'bank_fees', name_es: 'Cargos Bancarios', type: 'expense', tax_deductible: true, tax_category: 'bank_fees' },
    { name: 'other_expense', name_es: 'Otros Gastos', type: 'expense', tax_deductible: true, tax_category: 'other_expense' },
];

const ensureSeedCategories = async () => {
    const count = await AccountingCategory.count();
    if (count === 0) {
        await AccountingCategory.bulkCreate(SEED_CATEGORIES);
    }
};

// ─── Helper to guess category from description ────────────────
const CATEGORY_RULES = [
    { keywords: ['zelle'], name: 'payroll_zelle' },
    { keywords: ['shell', 'chevron', 'exxon', 'bp', 'speedway', 'gas station', 'fuel', 'sunoco'], name: 'gas' },
    { keywords: ['home depot', 'lowes', 'ace hardware', 'tool'], name: 'tools' },
    { keywords: ['deposit', 'mobile deposit'], name: 'client_payments' },
    { keywords: ['insurance', 'progressive', 'geico', 'allstate'], name: 'insurance' },
    { keywords: ['att', 't-mobile', 'verizon', 'phone'], name: 'phone' },
    { keywords: ['amazon', 'staples', 'office'], name: 'office' },
    { keywords: ['bank fee', 'monthly fee', 'service charge'], name: 'bank_fees' },
];

const guessCategory = (desc = '', amount, type, categories) => {
    const d = desc.toLowerCase();
    for (const rule of CATEGORY_RULES) {
        if (rule.keywords.some(k => d.includes(k))) {
            return categories.find(c => c.name === rule.name) || null;
        }
    }
    if (type === 'income') return categories.find(c => c.name === 'client_payments') || null;
    return null;
};

// ─── Extract worker_codes from description ────────────────────
// Pattern: 2 uppercase letters + hyphen + 4 digits (e.g. BA-0687, MI-6264)
const extractWorkerCodes = (desc = '') => {
    const matches = desc.match(/\b[A-Z]{2}-\d{4}\b/g);
    return matches ? [...new Set(matches)] : [];
};

const extractBankRef = (desc = '') => {
    const m = desc.match(/REF\s*#?\s*([A-Z0-9]+)/i);
    return m ? m[1] : null;
};

// ═════════════════════════════════════════════════════════════
// CATEGORIES CRUD
// ═════════════════════════════════════════════════════════════
const getCategories = async (req, res) => {
    try {
        await ensureSeedCategories();
        const cats = await AccountingCategory.findAll({ where: { is_active: true }, order: [['type', 'ASC'], ['name_es', 'ASC']] });
        return successResponse(res, cats, 'Categories retrieved.');
    } catch (e) { console.error(e); return errorResponse(res, 'Failed.', 500); }
};

const createCategory = async (req, res) => {
    try {
        const { name, name_es, type, tax_deductible, tax_category } = req.body;
        if (!name || !name_es || !type) return errorResponse(res, 'name, name_es, type required.', 400);
        const cat = await AccountingCategory.create({ name, name_es, type, tax_deductible: !!tax_deductible, tax_category });
        return successResponse(res, cat, 'Category created.', 201);
    } catch (e) { return errorResponse(res, 'Failed.', 500); }
};

const updateCategory = async (req, res) => {
    try {
        const cat = await AccountingCategory.findOne({ where: { id: req.params.id, is_active: true } });
        if (!cat) return errorResponse(res, 'Not found.', 404);
        const { name, name_es, type, tax_deductible, tax_category } = req.body;
        await cat.update({ name: name || cat.name, name_es: name_es || cat.name_es, type: type || cat.type, tax_deductible: tax_deductible !== undefined ? !!tax_deductible : cat.tax_deductible, tax_category: tax_category !== undefined ? tax_category : cat.tax_category });
        return successResponse(res, cat, 'Updated.');
    } catch (e) { return errorResponse(res, 'Failed.', 500); }
};

const deleteCategory = async (req, res) => {
    try {
        const cat = await AccountingCategory.findOne({ where: { id: req.params.id, is_active: true } });
        if (!cat) return errorResponse(res, 'Not found.', 404);
        await cat.update({ is_active: false });
        return successResponse(res, { id: cat.id }, 'Deleted.');
    } catch (e) { return errorResponse(res, 'Failed.', 500); }
};

// ═════════════════════════════════════════════════════════════
// TRANSACTIONS
// ═════════════════════════════════════════════════════════════
const TX_INCLUDES = [
    { model: AccountingCategory, as: 'category' },
    { model: Worker, as: 'worker', attributes: ['id', 'first_name', 'last_name', 'worker_code'] },
    { model: Client, as: 'client', attributes: ['id', 'company_name'] },
    { model: Transaction, as: 'splitChildren', attributes: ['id', 'description', 'amount', 'worker_id'] },
];

const getTransactions = async (req, res) => {
    try {
        const { type, category_id, start_date, end_date, worker_id, client_id, uncategorized } = req.query;
        const where = { is_active: true };
        if (type && type !== 'all') where.type = type;
        if (category_id) where.category_id = parseInt(category_id);
        if (worker_id) where.worker_id = parseInt(worker_id);
        if (client_id) where.client_id = parseInt(client_id);
        if (uncategorized === 'true') where.category_id = null;
        if (start_date && end_date) where.date = { [Op.between]: [start_date, end_date] };

        const txs = await Transaction.findAll({
            where, include: TX_INCLUDES, order: [['date', 'DESC'], ['id', 'DESC']],
        });
        return successResponse(res, txs, 'Transactions retrieved.');
    } catch (e) { console.error(e); return errorResponse(res, 'Failed.', 500); }
};

const getTransactionById = async (req, res) => {
    try {
        const tx = await Transaction.findOne({ where: { id: req.params.id, is_active: true }, include: TX_INCLUDES });
        if (!tx) return errorResponse(res, 'Not found.', 404);
        return successResponse(res, tx);
    } catch (e) { return errorResponse(res, 'Failed.', 500); }
};

const createTransaction = async (req, res) => {
    try {
        const { date, description, amount, type, category_id, worker_id, client_id, invoice_id, payroll_id, notes } = req.body;
        if (!date || !description || !amount || !type) return errorResponse(res, 'date, description, amount, type required.', 400);
        const tx = await Transaction.create({
            date, description, amount: Math.abs(parseFloat(amount)), type,
            category_id: category_id || null,
            worker_id: worker_id || null, client_id: client_id || null,
            invoice_id: invoice_id || null, payroll_id: payroll_id || null,
            notes, source: 'manual',
        });
        const full = await Transaction.findByPk(tx.id, { include: TX_INCLUDES });
        return successResponse(res, full, 'Transaction created.', 201);
    } catch (e) { console.error(e); return errorResponse(res, 'Failed.', 500); }
};

const updateTransaction = async (req, res) => {
    try {
        const tx = await Transaction.findOne({ where: { id: req.params.id, is_active: true } });
        if (!tx) return errorResponse(res, 'Not found.', 404);
        const allowed = ['category_id', 'worker_id', 'client_id', 'invoice_id', 'payroll_id', 'notes', 'is_reconciled', 'description'];
        allowed.forEach(k => { if (req.body[k] !== undefined) tx[k] = req.body[k]; });
        await tx.save();
        const full = await Transaction.findByPk(tx.id, { include: TX_INCLUDES });
        return successResponse(res, full, 'Updated.');
    } catch (e) { return errorResponse(res, 'Failed.', 500); }
};

const deleteTransaction = async (req, res) => {
    try {
        const tx = await Transaction.findOne({ where: { id: req.params.id, is_active: true } });
        if (!tx) return errorResponse(res, 'Not found.', 404);
        await tx.update({ is_active: false });
        return successResponse(res, { id: tx.id }, 'Deleted.');
    } catch (e) { return errorResponse(res, 'Failed.', 500); }
};

// ─── Split transaction ────────────────────────────────────────
const splitTransaction = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const parent = await Transaction.findOne({ where: { id: req.params.id, is_active: true } });
        if (!parent) { await t.rollback(); return errorResponse(res, 'Transaction not found.', 404); }

        const { parts } = req.body; // [{amount, description, category_id, worker_id, notes}, ...]
        if (!Array.isArray(parts) || parts.length < 2) { await t.rollback(); return errorResponse(res, 'At least 2 parts required.', 400); }

        const totalParts = parts.reduce((s, p) => s + parseFloat(p.amount || 0), 0);
        if (Math.abs(totalParts - parseFloat(parent.amount)) > 0.01) {
            await t.rollback();
            return errorResponse(res, `Parts total (${totalParts}) must equal parent amount (${parent.amount}).`, 400);
        }

        await parent.update({ is_split: true }, { transaction: t });

        const children = [];
        for (const part of parts) {
            const child = await Transaction.create({
                date: parent.date,
                description: part.description || parent.description,
                amount: parseFloat(part.amount),
                type: parent.type,
                category_id: part.category_id || null,
                worker_id: part.worker_id || null,
                client_id: parent.client_id,
                parent_transaction_id: parent.id,
                bank_reference: parent.bank_reference,
                source: parent.source,
                notes: part.notes || null,
            }, { transaction: t });
            children.push(child);
        }

        await t.commit();
        const full = await Transaction.findByPk(parent.id, {
            include: [{ model: Transaction, as: 'splitChildren', include: [{ model: AccountingCategory, as: 'category' }, { model: Worker, as: 'worker', attributes: ['id', 'first_name', 'last_name', 'worker_code'] }] }],
        });
        return successResponse(res, full, 'Split successful.');
    } catch (e) {
        await t.rollback();
        console.error('splitTransaction error:', e);
        return errorResponse(res, 'Failed to split.', 500);
    }
};

// ═════════════════════════════════════════════════════════════
// CSV IMPORT
// ═════════════════════════════════════════════════════════════
/**
 * Wells Fargo CSV format (no headers):
 * "01/30/2026","-1611.20","*","","ZELLE TO BRYAN ON 01/30 REF # WFCT0ZRB99YV"
 */
const parseWellsFargoCSV = (csvText) => {
    const lines = csvText.split('\n').filter(l => l.trim());
    const rows = [];
    for (const line of lines) {
        // Regex: 5 CSV fields, quoted or unquoted
        const matches = line.match(/(".*?"|[^,]+)(?=,|$)/g);
        if (!matches || matches.length < 5) continue;
        const clean = matches.map(m => m.replace(/^"|"$/g, '').trim());
        const [dateStr, amtStr, , , desc] = clean;
        const amount = parseFloat(amtStr);
        if (isNaN(amount)) continue;
        // Parse date MM/DD/YYYY → YYYY-MM-DD
        const [m, d, y] = dateStr.split('/');
        if (!m || !d || !y) continue;
        rows.push({
            date: `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`,
            amount: Math.abs(amount),
            type: amount < 0 ? 'expense' : 'income',
            description: desc,
            bank_reference: extractBankRef(desc),
            worker_codes: extractWorkerCodes(desc),
        });
    }
    return rows;
};

// POST /api/accounting/import-csv (preview only — no saves)
const previewCSV = async (req, res) => {
    try {
        const csvText = req.body.csv_text;
        if (!csvText) return errorResponse(res, 'csv_text required.', 400);

        const parsed = parseWellsFargoCSV(csvText);
        if (parsed.length === 0) return errorResponse(res, 'No valid rows found in CSV.', 400);

        await ensureSeedCategories();
        const categories = await AccountingCategory.findAll({ where: { is_active: true } });

        // Load workers to match codes
        const workers = await Worker.findAll({ where: { is_active: true }, attributes: ['id', 'worker_code', 'first_name', 'last_name'] });
        const workerByCode = {};
        workers.forEach(w => { workerByCode[w.worker_code] = w; });

        // Load existing transactions to detect duplicates
        const existing = await Transaction.findAll({
            where: { is_active: true, source: { [Op.in]: ['csv_import'] } },
            attributes: ['date', 'amount', 'description'],
        });
        const dupSet = new Set(existing.map(e => `${e.date}|${e.amount}|${e.description}`));

        const preview = parsed.map((row, i) => {
            const dupKey = `${row.date}|${row.amount}|${row.description}`;
            const isDup = dupSet.has(dupKey);
            const cat = guessCategory(row.description, row.amount, row.type, categories);
            const matchedWorkers = row.worker_codes.map(code => workerByCode[code]).filter(Boolean);
            const needsSplit = matchedWorkers.length > 1;

            return {
                index: i,
                ...row,
                is_duplicate: isDup,
                suggested_category_id: cat?.id || null,
                suggested_category_name: cat?.name_es || null,
                matched_workers: matchedWorkers.map(w => ({ id: w.id, worker_code: w.worker_code, name: `${w.first_name} ${w.last_name}` })),
                needs_split: needsSplit,
                status: isDup ? 'duplicate' : 'new',
            };
        });

        return successResponse(res, {
            total: preview.length,
            new: preview.filter(r => r.status === 'new').length,
            duplicates: preview.filter(r => r.status === 'duplicate').length,
            rows: preview,
        }, 'CSV preview ready.');
    } catch (e) {
        console.error('previewCSV error:', e);
        return errorResponse(res, 'Failed to parse CSV.', 500);
    }
};

// POST /api/accounting/import-csv/confirm
const confirmCSV = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { rows, file_name } = req.body;
        // rows: [{date, amount, type, description, bank_reference, category_id, worker_id, split_parts?}]
        if (!Array.isArray(rows) || rows.length === 0) { await t.rollback(); return errorResponse(res, 'No rows to import.', 400); }

        let imported = 0, skipped = 0;
        const created = [];

        for (const row of rows) {
            if (row.skip) { skipped++; continue; }

            const tx = await Transaction.create({
                date: row.date,
                description: row.description,
                amount: parseFloat(row.amount),
                type: row.type,
                category_id: row.category_id || null,
                worker_id: row.worker_id || null,
                is_split: Array.isArray(row.split_parts) && row.split_parts.length > 0,
                bank_reference: row.bank_reference || null,
                source: 'csv_import',
                notes: row.notes || null,
            }, { transaction: t });

            // Handle split parts
            if (Array.isArray(row.split_parts) && row.split_parts.length > 0) {
                for (const part of row.split_parts) {
                    await Transaction.create({
                        date: row.date,
                        description: part.description || row.description,
                        amount: parseFloat(part.amount),
                        type: row.type,
                        category_id: part.category_id || null,
                        worker_id: part.worker_id || null,
                        parent_transaction_id: tx.id,
                        bank_reference: row.bank_reference || null,
                        source: 'csv_import',
                    }, { transaction: t });
                }
            }

            created.push(tx);
            imported++;
        }

        // Log the import
        await BankImport.create({
            file_name: file_name || 'unknown.csv',
            bank_name: 'wells_fargo',
            total_transactions: rows.length,
            imported_transactions: imported,
            skipped_transactions: skipped,
            imported_by_user_id: req.user?.id || null,
        }, { transaction: t });

        await t.commit();
        return successResponse(res, { imported, skipped }, `${imported} transacciones importadas.`);
    } catch (e) {
        await t.rollback();
        console.error('confirmCSV error:', e);
        return errorResponse(res, 'Failed to import CSV.', 500);
    }
};

// ═════════════════════════════════════════════════════════════
// P&L REPORT
// ═════════════════════════════════════════════════════════════
const getPnL = async (req, res) => {
    try {
        const { period, start_date, end_date } = req.query; // period = '2026-03' or date range
        let dateWhere = {};
        if (start_date && end_date) {
            dateWhere = { [Op.between]: [start_date, end_date] };
        } else if (period) {
            const [y, m] = period.split('-');
            if (m) {
                const first = `${y}-${m.padStart(2, '0')}-01`;
                const last = new Date(parseInt(y), parseInt(m), 0).toISOString().split('T')[0];
                dateWhere = { [Op.between]: [first, last] };
            } else {
                dateWhere = { [Op.between]: [`${y}-01-01`, `${y}-12-31`] };
            }
        }

        const where = { is_active: true, parent_transaction_id: null };
        if (Object.keys(dateWhere).length) where.date = dateWhere;

        const txs = await Transaction.findAll({ where, include: [{ model: AccountingCategory, as: 'category' }] });

        // Group income by category
        const incomeMap = {};
        const expenseMap = {};
        let totalIncome = 0, totalExpense = 0;

        txs.forEach(tx => {
            const amt = parseFloat(tx.amount);
            const key = tx.category?.name_es || 'Sin categorizar';
            if (tx.type === 'income') {
                incomeMap[key] = (incomeMap[key] || 0) + amt;
                totalIncome += amt;
            } else {
                expenseMap[key] = (expenseMap[key] || 0) + amt;
                totalExpense += amt;
            }
        });

        // Per diem total for the period (passthrough, excluded from P&L)
        const perDiemWhere = {};
        if (Object.keys(dateWhere).length) perDiemWhere.week_start_date = dateWhere;
        const perDiemTotal = await PerDiemEntry.sum('amount', { where: { ...perDiemWhere, is_active: true } }) || 0;

        return successResponse(res, {
            period: period || `${start_date} to ${end_date}`,
            income: { items: incomeMap, total: parseFloat(totalIncome.toFixed(2)) },
            expense: { items: expenseMap, total: parseFloat(totalExpense.toFixed(2)) },
            net: parseFloat((totalIncome - totalExpense).toFixed(2)),
            per_diem_passthrough: parseFloat(parseFloat(perDiemTotal || 0).toFixed(2)),
        }, 'P&L retrieved.');
    } catch (e) { console.error(e); return errorResponse(res, 'Failed to get P&L.', 500); }
};

// ═════════════════════════════════════════════════════════════
// MARGINS
// ═════════════════════════════════════════════════════════════
const getMarginsWorkers = async (req, res) => {
    try {
        const { start_date, end_date, year } = req.query;
        const dateFilter = buildDateFilter(start_date, end_date, year);

        const invoiceLines = await InvoiceLine.findAll({
            include: [
                { model: Worker, as: 'worker', attributes: ['id', 'first_name', 'last_name', 'worker_code'] },
                { association: 'invoice', where: { status: { [Op.in]: ['sent', 'paid', 'approved'] }, is_active: true }, required: true },
            ],
        });

        const payrollLines = await PayrollLine.findAll({
            where: { is_active: true },
            include: [{ model: Worker, as: 'worker', attributes: ['id', 'first_name', 'last_name', 'worker_code'] }],
        });

        // Group billed by worker
        const billedMap = {};
        invoiceLines.forEach(l => {
            const wId = l.worker_id;
            billedMap[wId] = (billedMap[wId] || 0) + parseFloat(l.line_total || l.amount || 0);
        });

        // Group paid by worker
        const paidMap = {};
        payrollLines.forEach(l => {
            const wId = l.worker_id;
            paidMap[wId] = (paidMap[wId] || 0) + parseFloat(l.gross_pay || 0);
        });

        // Collect all workers
        const allWorkerIds = new Set([...Object.keys(billedMap), ...Object.keys(paidMap)].map(Number));
        const workers = await Worker.findAll({ where: { id: { [Op.in]: [...allWorkerIds] } }, attributes: ['id', 'first_name', 'last_name', 'worker_code'] });
        const workerById = {};
        workers.forEach(w => { workerById[w.id] = w; });

        const margins = [...allWorkerIds].map(wId => {
            const billed = billedMap[wId] || 0;
            const paid = paidMap[wId] || 0;
            const margin = billed - paid;
            const pct = billed > 0 ? (margin / billed * 100) : 0;
            const w = workerById[wId] || { first_name: 'Unknown', last_name: '', worker_code: '' };
            return {
                worker_id: wId,
                worker_name: `${w.first_name} ${w.last_name}`,
                worker_code: w.worker_code,
                billed: parseFloat(billed.toFixed(2)),
                paid: parseFloat(paid.toFixed(2)),
                margin: parseFloat(margin.toFixed(2)),
                margin_pct: parseFloat(pct.toFixed(1)),
            };
        }).sort((a, b) => b.margin - a.margin);

        return successResponse(res, margins, 'Worker margins retrieved.');
    } catch (e) { console.error(e); return errorResponse(res, 'Failed.', 500); }
};

const getMarginsClients = async (req, res) => {
    try {
        const invoices = await Invoice.findAll({
            where: { is_active: true, status: { [Op.in]: ['sent', 'paid', 'approved'] } },
            include: [
                { model: require('../models').Client, as: 'client', attributes: ['id', 'company_name'] },
                {
                    model: InvoiceLine, as: 'lines',
                    include: [{ model: Worker, as: 'worker', attributes: ['id'] }],
                },
            ],
        });

        const payrollLines = await PayrollLine.findAll({ where: { is_active: true }, attributes: ['worker_id', 'gross_pay'] });
        const payByWorker = {};
        payrollLines.forEach(l => { payByWorker[l.worker_id] = (payByWorker[l.worker_id] || 0) + parseFloat(l.gross_pay || 0); });

        const clientMap = {};
        invoices.forEach(inv => {
            const cId = inv.client_id;
            const cName = inv.client?.company_name || 'Unknown';
            if (!clientMap[cId]) clientMap[cId] = { client_id: cId, client_name: cName, billed: 0, cost: 0 };
            clientMap[cId].billed += parseFloat(inv.subtotal || 0); // labor only, no per_diem
            inv.lines?.forEach(line => {
                clientMap[cId].cost += payByWorker[line.worker_id] || 0;
            });
        });

        const result = Object.values(clientMap).map(c => ({
            ...c,
            billed: parseFloat(c.billed.toFixed(2)),
            cost: parseFloat(c.cost.toFixed(2)),
            margin: parseFloat((c.billed - c.cost).toFixed(2)),
            margin_pct: c.billed > 0 ? parseFloat(((c.billed - c.cost) / c.billed * 100).toFixed(1)) : 0,
        }));

        return successResponse(res, result, 'Client margins retrieved.');
    } catch (e) { console.error(e); return errorResponse(res, 'Failed.', 500); }
};

// ─── Cash Flow ────────────────────────────────────────────────
const getCashFlow = async (req, res) => {
    try {
        const { period = 'month', year } = req.query;
        const y = year || new Date().getFullYear();
        const txs = await Transaction.findAll({
            where: { is_active: true, parent_transaction_id: null, date: { [Op.between]: [`${y}-01-01`, `${y}-12-31`] } },
            attributes: ['date', 'amount', 'type'],
            order: [['date', 'ASC']],
        });

        const buckets = {};
        txs.forEach(tx => {
            const d = new Date(tx.date + 'T00:00:00');
            const key = period === 'week'
                ? `W${Math.ceil(d.getDate() / 7)}-${d.getMonth() + 1}`
                : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            if (!buckets[key]) buckets[key] = { period: key, income: 0, expense: 0 };
            if (tx.type === 'income') buckets[key].income += parseFloat(tx.amount);
            else buckets[key].expense += parseFloat(tx.amount);
        });

        let balance = 0;
        const result = Object.values(buckets).map(b => {
            balance += b.income - b.expense;
            return {
                ...b,
                income: parseFloat(b.income.toFixed(2)),
                expense: parseFloat(b.expense.toFixed(2)),
                balance: parseFloat(balance.toFixed(2)),
            };
        });

        return successResponse(res, result, 'Cash flow retrieved.');
    } catch (e) { return errorResponse(res, 'Failed.', 500); }
};

// ═════════════════════════════════════════════════════════════
// TAX REPORTS
// ═════════════════════════════════════════════════════════════
const getTaxSummary = async (req, res) => {
    try {
        const year = req.query.year || new Date().getFullYear();
        const where = { is_active: true, parent_transaction_id: null, date: { [Op.between]: [`${year}-01-01`, `${year}-12-31`] } };

        const txs = await Transaction.findAll({ where, include: [{ model: AccountingCategory, as: 'category' }] });

        const perDiemTotal = await PerDiemEntry.sum('amount', {
            where: { is_active: true, week_start_date: { [Op.between]: [`${year}-01-01`, `${year}-12-31`] } },
        }) || 0;

        let totalIncome = 0, totalDeductible = 0;
        const deductibleMap = {};

        txs.forEach(tx => {
            const amt = parseFloat(tx.amount);
            if (tx.type === 'income') { totalIncome += amt; return; }
            if (tx.category?.tax_deductible) {
                const key = tx.category.tax_category || 'other';
                deductibleMap[key] = (deductibleMap[key] || { label: key, amount: 0 });
                deductibleMap[key].amount += amt;
                totalDeductible += amt;
            }
        });

        return successResponse(res, {
            year,
            total_income: parseFloat(totalIncome.toFixed(2)),
            total_deductible: parseFloat(totalDeductible.toFixed(2)),
            net_taxable: parseFloat((totalIncome - totalDeductible).toFixed(2)),
            per_diem_passthrough: parseFloat(parseFloat(perDiemTotal).toFixed(2)),
            deductible_by_category: Object.values(deductibleMap).map(d => ({ ...d, amount: parseFloat(d.amount.toFixed(2)) })),
        }, 'Tax summary retrieved.');
    } catch (e) { console.error(e); return errorResponse(res, 'Failed.', 500); }
};

const get1099Report = async (req, res) => {
    try {
        const year = req.query.year || new Date().getFullYear();

        // Sum payroll gross_pay per worker for the year (covers Zelle, cash, check)
        const lines = await PayrollLine.findAll({
            where: { is_active: true },
            include: [
                { model: Payroll, as: 'payroll', where: { week_start_date: { [Op.between]: [`${year}-01-01`, `${year}-12-31`] } }, required: true },
                { model: Worker, as: 'worker', attributes: ['id', 'first_name', 'last_name', 'worker_code', 'phone'] },
            ],
        });

        const wMap = {};
        lines.forEach(l => {
            const wId = l.worker_id;
            if (!wMap[wId]) {
                wMap[wId] = {
                    worker_id: wId,
                    worker_code: l.worker?.worker_code,
                    name: `${l.worker?.first_name} ${l.worker?.last_name}`,
                    total_paid: 0,
                };
            }
            wMap[wId].total_paid += parseFloat(l.gross_pay || 0);
        });

        const result = Object.values(wMap).map(w => ({
            ...w,
            total_paid: parseFloat(w.total_paid.toFixed(2)),
            needs_1099: w.total_paid >= 600,
        })).sort((a, b) => b.total_paid - a.total_paid);

        return successResponse(res, result, '1099 report retrieved.');
    } catch (e) { console.error(e); return errorResponse(res, 'Failed.', 500); }
};

// ─── helper ─────────────────────────────────────────────────
const buildDateFilter = (start, end, year) => {
    if (start && end) return { [Op.between]: [start, end] };
    if (year) return { [Op.between]: [`${year}-01-01`, `${year}-12-31`] };
    return {};
};

module.exports = {
    // Categories
    getCategories, createCategory, updateCategory, deleteCategory,
    // Transactions
    getTransactions, getTransactionById, createTransaction, updateTransaction, deleteTransaction,
    splitTransaction,
    // CSV
    previewCSV, confirmCSV,
    // Reports
    getPnL, getMarginsWorkers, getMarginsClients, getCashFlow,
    getTaxSummary, get1099Report,
};
