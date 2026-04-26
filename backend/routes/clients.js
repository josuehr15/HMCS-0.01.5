const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const checkRole = require('../middleware/checkRole');
const {
    getAllClients, getClientById, getClientLinkedData,
    createClient, updateClient, deleteClient,
    toggleClientStatus, forceDeleteClient, resetClientPassword,
    addClientRate, updateClientRate, deleteClientRate,
    uploadClientLogo,
} = require('../controllers/clientController');
const uploadLogo = require('../middleware/uploadLogo');

router.use(auth);

// ── Sub-resource routes (must be BEFORE /:id) ──────────────────────
router.post('/:id/logo', checkRole('admin'), uploadLogo.single('logo'), uploadClientLogo);
router.get('/:id/linked-data', checkRole('admin'), getClientLinkedData);
router.patch('/:id/toggle-status', checkRole('admin'), toggleClientStatus);
router.put('/:id/reset-password', checkRole('admin'), resetClientPassword);
router.delete('/:id/force', checkRole('admin'), forceDeleteClient);

// Client rates nested routes
router.post('/:id/rates', checkRole('admin'), addClientRate);
router.put('/:id/rates/:rateId', checkRole('admin'), updateClientRate);
router.delete('/:id/rates/:rateId', checkRole('admin'), deleteClientRate);

// ── Collection routes ──────────────────────────────────────────────
router.get('/', checkRole('admin'), getAllClients);
router.post('/', checkRole('admin'), createClient);

// ── Single-resource routes (after sub-resources) ───────────────────
router.get('/:id', checkRole('admin'), getClientById);
router.put('/:id', checkRole('admin'), updateClient);
router.delete('/:id', checkRole('admin'), deleteClient);

module.exports = router;
