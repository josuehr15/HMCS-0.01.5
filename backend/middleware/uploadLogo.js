const multer = require('multer');
const path = require('path');
const fs = require('fs');

const LOGOS_DIR = path.join(__dirname, '..', 'uploads', 'logos');

if (!fs.existsSync(LOGOS_DIR)) {
    fs.mkdirSync(LOGOS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, LOGOS_DIR),
    filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase() || '.png';
        const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
        cb(null, `logo_${unique}${ext}`);
    },
});

const fileFilter = (_req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Solo se permiten imágenes: PNG, JPEG, WebP'), false);
    }
};

const uploadLogo = multer({
    storage,
    fileFilter,
    limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
});

module.exports = uploadLogo;
