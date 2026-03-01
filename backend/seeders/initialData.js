const bcrypt = require('bcryptjs');
require('dotenv').config();

const { sequelize } = require('../config/database');
const { User, Trade, Client, Project, ClientRate, Worker } = require('../models');

/**
 * Seed initial data into the database.
 * Creates: 1 Admin, 4 Trades, 1 Client, 1 Project, 1 ClientRate, 4 Workers.
 */
const seedInitialData = async () => {
    try {
        // Test connection
        await sequelize.authenticate();
        console.log('Database connected for seeding.');

        // Force recreate all tables (clean slate for HMCS 0.01.5)
        await sequelize.sync({ force: true });
        console.log('Models synchronized (tables recreated).');

        // ─── Seed Trades ────────────────────────────────────
        const trades = [
            { name: 'plumbing', name_es: 'plomería' },
            { name: 'electrical', name_es: 'electricidad' },
            { name: 'hvac', name_es: 'hvac' },
            { name: 'helper', name_es: 'ayudante' },
        ];

        const createdTrades = {};
        for (const trade of trades) {
            const [record] = await Trade.findOrCreate({
                where: { name: trade.name },
                defaults: trade,
            });
            createdTrades[trade.name] = record;
            console.log(`Trade "${trade.name}": CREATED`);
        }

        // ─── Seed Admin User ────────────────────────────────
        const adminUser = await User.create({
            email: 'admin@hmcs.com',
            password_hash: await bcrypt.hash('admin123', 10),
            role: 'admin',
            preferred_language: 'es',
        });
        console.log('Admin user "admin@hmcs.com": CREATED');

        // ─── Seed Client ────────────────────────────────────
        const clientUser = await User.create({
            email: 'contact@mockplumbing.com',
            password_hash: await bcrypt.hash('client123', 10),
            role: 'client',
            preferred_language: 'en',
        });

        const client = await Client.create({
            user_id: clientUser.id,
            company_name: 'Mock Plumbing & Mechanical, Inc.',
            contact_name: 'Mock Contact',
            contact_email: 'contact@mockplumbing.com',
            contact_phone: '555-0100',
        });
        console.log('Client "Mock Plumbing & Mechanical, Inc.": CREATED');

        // ─── Seed Project ───────────────────────────────────
        const project = await Project.create({
            client_id: client.id,
            name: 'MRES 1451-01',
            address: 'Bluffton, SC',
            latitude: 32.2195750,
            longitude: -80.9663690,
            gps_radius_meters: 500,
        });
        console.log('Project "MRES 1451-01": CREATED');

        // ─── Seed ClientRate ────────────────────────────────
        await ClientRate.create({
            client_id: client.id,
            trade_id: createdTrades['plumbing'].id,
            hourly_rate: 36.00,
        });
        console.log('ClientRate (Mock Plumbing + plumbing = $36/hr): CREATED');

        // ─── Seed Workers ───────────────────────────────────
        const workers = [
            { first_name: 'Josue E.', last_name: 'Hernandez', email: 'josue@hmcs.com' },
            { first_name: 'Brian N.', last_name: 'Hernandez', email: 'brian@hmcs.com' },
            { first_name: 'Jose G.', last_name: 'Hernandez', email: 'jose@hmcs.com' },
            { first_name: 'Nemecio', last_name: 'Mora Cruz', email: 'nemecio@hmcs.com' },
        ];

        const generateCode = () => {
            const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
            const l1 = letters.charAt(Math.floor(Math.random() * 26));
            const l2 = letters.charAt(Math.floor(Math.random() * 26));
            const nums = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
            return `${l1}${l2}-${nums}`;
        };

        for (const w of workers) {
            const workerUser = await User.create({
                email: w.email,
                password_hash: await bcrypt.hash('worker123', 10),
                role: 'contractor',
                preferred_language: 'es',
            });

            const worker = await Worker.create({
                user_id: workerUser.id,
                worker_code: generateCode(),
                first_name: w.first_name,
                last_name: w.last_name,
                phone: '555-0000',
                trade_id: createdTrades['plumbing'].id,
                hourly_rate: 30.00,
            });
            console.log(`Worker "${w.first_name} ${w.last_name}" (${worker.worker_code}): CREATED`);
        }

        console.log('\n✅ Seed completed successfully.');
        console.log('─────────────────────────────────');
        console.log('Admin login : admin@hmcs.com / admin123');
        console.log('Client login: contact@mockplumbing.com / client123');
        console.log('Worker login: josue@hmcs.com / worker123 (and 3 more)');
        process.exit(0);
    } catch (error) {
        console.error('❌ Seed failed:', error);
        process.exit(1);
    }
};

seedInitialData();
