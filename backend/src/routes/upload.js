const express = require('express');
const multer = require('multer');
const { requireAuth } = require('../middleware/auth');
const storage = require('../services/storage');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB
const router = express.Router();

router.post('/', requireAuth(['admin', 'vendor']), upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'file is required' });
  try {
    const saved = storage.saveFile(req.file.buffer, req.file.originalname, req);
    res.status(201).json({ file: { ...saved, size: req.file.size, mimetype: req.file.mimetype } });
  } catch (err) {
    console.error('Upload failed', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

module.exports = router;
