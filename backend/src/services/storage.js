const fs = require('fs');
const path = require('path');
const { v4: uuid } = require('uuid');
const config = require('../config');

const uploadsDir = path.join(__dirname, '..', '..', 'uploads');

function ensureUploadsDir() {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
}

function resolveBaseUrl(req) {
  if (config.publicUrl) return config.publicUrl.replace(/\/$/, '');
  const protocol = req?.protocol || 'http';
  const host = req?.get ? req.get('host') : `localhost:${config.port || 4000}`;
  return `${protocol}://${host}`;
}

function saveFile(buffer, originalName, req) {
  ensureUploadsDir();
  const ext = path.extname(originalName || '') || '';
  const filename = `${Date.now()}-${uuid()}${ext}`;
  const filePath = path.join(uploadsDir, filename);
  fs.writeFileSync(filePath, buffer);
  const publicPath = `/uploads/${filename}`;
  const url = `${resolveBaseUrl(req)}${publicPath}`;
  return { filename, path: publicPath, url };
}

module.exports = {
  ensureUploadsDir,
  saveFile,
};
