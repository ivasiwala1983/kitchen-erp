/**
 * File upload middleware using multer.
 * Supports both SeaweedFS and local filesystem fallback.
 */

import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { config } from '../config/env';
import { BadRequestError } from '../shared/errors';

// Ensure uploads directory exists (local fallback)
if (config.seaweedFallbackLocal) {
  const uploadsPath = path.resolve(config.uploadsDir);
  if (!fs.existsSync(uploadsPath)) {
    fs.mkdirSync(uploadsPath, { recursive: true });
  }
}

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

/** Multer storage — always use memory storage; we'll forward to SeaweedFS or disk */
const storage = multer.memoryStorage();

const fileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new BadRequestError(`Unsupported file type: ${file.mimetype}. Allowed: JPG, PNG, WebP, PDF`)
    );
  }
};

export const uploadInvoice = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE },
}).single('invoice');
