const { sequelize } = require('../config/database');
const CompanySettings = require('../models/CompanySettings');

async function getNextVoucherNumber() {
    return await sequelize.transaction(async (t) => {
        const settings = await CompanySettings.findOne({ transaction: t, lock: t.LOCK.UPDATE });
        if (!settings) throw new Error('Company settings not found');

        const prefix = settings.invoice_prefix || '26';
        const next = settings.payroll_next_number || 1;
        const voucherNumber = `PAY-${prefix}-${String(next).padStart(2, '0')}`;

        await settings.update({ payroll_next_number: next + 1 }, { transaction: t });

        return voucherNumber;
    });
}

module.exports = { getNextVoucherNumber };
