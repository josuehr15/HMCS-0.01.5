const path = require('path');
const fs = require('fs');
const { Document } = require('../models');
const { successResponse, errorResponse } = require('../utils/responseHandler');

// Uploads directory
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads', 'documents');

/**
 * GET /api/documents?owner_type=X&owner_id=Y
 */
const getDocuments = async (req, res) => {
    try {
        const { owner_type, owner_id } = req.query;
        const where = { is_active: true };
        if (owner_type) where.owner_type = owner_type;
        if (owner_id) where.owner_id = parseInt(owner_id);

        const docs = await Document.findAll({ where, order: [['created_at', 'DESC']] });
        return successResponse(res, docs, 'Documents retrieved.');
    } catch (error) {
        return errorResponse(res, 'Failed to retrieve documents.', 500);
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
 * DELETE /api/documents/:id  (soft delete)
 */
const deleteDocument = async (req, res) => {
    try {
        const doc = await Document.findOne({ where: { id: req.params.id, is_active: true } });
        if (!doc) return errorResponse(res, 'Document not found.', 404);

        await doc.update({ is_active: false });
        return successResponse(res, { id: doc.id }, 'Document deleted.');
    } catch (error) {
        return errorResponse(res, 'Failed to delete document.', 500);
    }
};

module.exports = { getDocuments, uploadDocument, downloadDocument, deleteDocument };
