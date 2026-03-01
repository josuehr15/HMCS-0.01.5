const { Worker } = require('../models');

/**
 * Generate a unique worker code in format: XX-0000
 * XX = 2 random uppercase letters
 * 0000 = 4 random digits
 * Verifies uniqueness against the database before returning.
 * @returns {Promise<string>} A unique worker code.
 */
const generateWorkerCode = async () => {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let isUnique = false;
    let code = '';

    while (!isUnique) {
        // Generate 2 random uppercase letters
        const letterPart =
            letters.charAt(Math.floor(Math.random() * letters.length)) +
            letters.charAt(Math.floor(Math.random() * letters.length));

        // Generate 4 random digits
        const numberPart = String(Math.floor(Math.random() * 10000)).padStart(4, '0');

        code = `${letterPart}-${numberPart}`;

        // Check if this code already exists in the database
        const existing = await Worker.findOne({ where: { worker_code: code } });
        if (!existing) {
            isUnique = true;
        }
    }

    return code;
};

module.exports = generateWorkerCode;
