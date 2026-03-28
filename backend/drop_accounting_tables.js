require('dotenv').config();
const { sequelize } = require('./config/database');

const dropTables = async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ Connected to database.');

        await sequelize.query('DROP TABLE IF EXISTS "transactions" CASCADE;');
        console.log('✅ Dropped: transactions');

        await sequelize.query('DROP TABLE IF EXISTS "accounting_categories" CASCADE;');
        console.log('✅ Dropped: accounting_categories');

        await sequelize.query('DROP TABLE IF EXISTS "bank_imports" CASCADE;');
        console.log('✅ Dropped: bank_imports');

        console.log('\n🎉 Done! Now restart the backend with: npm run dev');
        process.exit(0);
    } catch (err) {
        console.error('❌ Error:', err.message);
        process.exit(1);
    }
};

dropTables();
