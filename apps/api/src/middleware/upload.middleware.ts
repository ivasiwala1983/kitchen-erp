/**
 * File upload middleware using multer.
 * Processes incoming files into memory buffers before forwarding to StorageProvider.
 */

import multer from 'multer';
import { RequestHandler } from 'express';
import { BadRequestError } from '../shared/errors';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

/** Multer memory storage — keeps file buffer in RAM for cloud storage streaming */
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

export const uploadInvoice: RequestHandler = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE },
}).single('invoice');
