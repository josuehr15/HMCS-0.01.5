const path = require('path');
const fs = require('fs');
const { Document, User, Worker, Client } = require('../models');
const { successResponse, errorResponse } = require('../utils/responseHandler');

// Uploads directory
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads', 'documents');

// Common includes: uploader + owner name resolution
const buildIncludes = () => [
    {
        model: User,
        as: 'uploader',
        attributes: ['id', 'email'],
        required: false,
    },
    {
        model: User,
        as: 'deleter',
        attributes: ['id', 'email'],
        required: false,
    },
];

// After fetching docs, attach owner_name by joining Worker/Client tables
async function attachOwnerNames(docs) {
    // Collect IDs per type
    const workerIds = [...new Set(docs.filter(d => d.owner_type === 'worker' && d.owner_id).map(d => d.owner_id))];
    const clientIds = [...new Set(docs.filter(d => d.owner_type === 'client' && d.owner_id).map(d => d.owner_id))];

    const [workers, clients] = await Promise.all([
        workerIds.length ? Worker.findAll({ where: { id: workerIds }, attributes: ['id', 'first_name', 'last_name', 'worker_code'] }) : [],
        clientIds.length ? Client.findAll({ where: { id: clientIds }, attributes: ['id', 'company_name', 'contact_name'] }) : [],
    ]);

    const workerMap = {};
    workers.forEach(w => { workerMap[w.id] = `${w.first_name} ${w.last_name}`; });
    const clientMap = {};
    clients.forEach(c => { clientMap[c.id] = c.company_name || c.contact_name || `Cliente #${c.id}`; });

    return docs.map(doc => {
        const plain = doc.toJSON ? doc.toJSON() : { ...doc };
        if (plain.owner_type === 'worker' && plain.owner_id) {
            plain.owner_name = workerMap[plain.owner_id] || `Trabajador #${plain.owner_id}`;
        } else if (plain.owner_type === 'client' && plain.owner_id) {
            plain.owner_name = clientMap[plain.owner_id] || `Cliente #${plain.owner_id}`;
        } else if (plain.owner_type === 'company') {
            plain.owner_name = 'Empresa';
        }
        return plain;
    });
}

/**
 * GET /api/documents?owner_type=X&owner_id=Y
 */
const getDocuments = async (req, res) => {
    try {
        const { owner_type, owner_id } = req.query;
        const where = { is_active: true };
        if (owner_type) where.owner_type = owner_type;
        if (owner_id) where.owner_id = parseInt(owner_id);

        const docs = await Document.findAll({
            where,
            include: buildIncludes(),
            order: [['created_at', 'DESC']],
        });
        const enriched = await attachOwnerNames(docs);
        return successResponse(res, enriched, 'Documents retrieved.');
    } catch (error) {
        console.error('getDocuments error:', error);
        return errorResponse(res, 'Failed to retrieve documents.', 500);
    }
};

/**
 * GET /api/documents/audit
 */
const getDocumentsAudit = async (req, res) => {
    try {
        const { owner_type, owner_id } = req.query;
        const where = {};
        if (owner_type) where.owner_type = owner_type;
        if (owner_id) where.owner_id = parseInt(owner_id);

        const docs = await Document.findAll({
            where,
            include: buildIncludes(),
            order: [['created_at', 'DESC']],
        });
        const enriched = await attachOwnerNames(docs);
        return successResponse(res, enriched, 'Audit log retrieved.');
    } catch (error) {
        console.error('getDocumentsAudit error:', error);
        return errorResponse(res, 'Failed to retrieve audit log.', 500);
    }
};

/**
 * POST /api/documents/upload  (multipart/form-data)
 * Fields: file (binary), owner_type, owner_id, document_type, document_name, notes
 */
const uploadDocument = async (req, res) => {
    try {
        if (!req.file) return errorResponse(res, 'No file uploaded.', 400);

        const { owner_type, owner_id, document_type, document_name, notes } = req.body;
        if (!owner_type) return errorResponse(res, 'owner_type required.', 400);

        const fileUrl = `/uploads/documents/${req.file.filename}`;

        const doc = await Document.create({
            owner_type,
            owner_id: owner_id ? parseInt(owner_id) : null,
            document_type: document_type || 'other',
            document_name: document_name || req.file.originalname,
            file_name: req.file.filename,
            file_url: fileUrl,
            file_size: req.file.size,
            mime_type: req.file.mimetype,
            uploaded_by: req.user?.id || null,
            notes: notes || null,
            is_active: true,
        });

        return successResponse(res, doc, 'Document uploaded successfully.', 201);
    } catch (error) {
        return errorResponse(res, 'Failed to upload document.', 500);
    }
};

/**
 * GET /api/documents/:id/download
 */
const downloadDocument = async (req, res) => {
    try {
        const doc = await Document.findOne({ where: { id: req.params.id, is_active: true } });
        if (!doc) return errorResponse(res, 'Document not found.', 404);

        const filePath = path.join(UPLOADS_DIR, doc.file_name);
        if (!fs.existsSync(filePath)) return errorResponse(res, 'File not found on disk.', 404);

        res.download(filePath, doc.document_name);
    } catch (error) {
        return errorResponse(res, 'Failed to download document.', 500);
    }
};

/**
 * DELETE /api/documents/:id  (soft delete — stores who deleted and when)
 */
const deleteDocument = async (req, res) => {
    try {
        const doc = await Document.findOne({ where: { id: req.params.id, is_active: true } });
        if (!doc) return errorResponse(res, 'Document not found.', 404);

        await doc.update({
            is_active: false,
            deleted_by: req.user?.id || null,
            deleted_at: new Date(),
        });
        return successResponse(res, { id: doc.id }, 'Document deleted.');
    } catch (error) {
        return errorResponse(res, 'Failed to delete document.', 500);
    }
};

module.exports = { getDocuments, getDocumentsAudit, uploadDocument, downloadDocument, deleteDocument };
