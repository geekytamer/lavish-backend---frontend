const express = require('express');
const multer = require('multer');
const { requireAuth } = require('../middleware/auth');
const storage = require('../services/storage');

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.includes(file.mimetype)) return cb(null, true);
    cb(new Error('Only JPG, PNG, or WebP images are allowed'));
  },
});

const router = express.Router();

// Verify the file's real content (magic bytes), not just its claimed MIME type,
// which a client can trivially spoof.
function sniffImageType(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) return 'image/png';
  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 && // RIFF
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50 // WEBP
  ) return 'image/webp';
  return null;
}

router.post('/', requireAuth(['admin', 'vendor']), (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      const message = err.code === 'LIMIT_FILE_SIZE'
        ? 'Image is too large (max 5MB)'
        : err.message || 'Upload failed';
      return res.status(400).json({ error: message });
    }
    if (!req.file) return res.status(400).json({ error: 'file is required' });
    const realType = sniffImageType(req.file.buffer);
    if (!realType) {
      return res.status(400).json({ error: 'File is not a valid JPG, PNG, or WebP image' });
    }
    try {
      const saved = storage.saveFile(req.file.buffer, req.file.originalname, req);
      res.status(201).json({ file: { ...saved, size: req.file.size, mimetype: req.file.mimetype } });
    } catch (e) {
      console.error('Upload failed', e);
      res.status(500).json({ error: 'Upload failed' });
    }
  });
});

module.exports = router;
