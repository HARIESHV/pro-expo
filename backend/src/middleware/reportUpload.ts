import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { env } from '../config/env';
import { AppError } from './errorHandler';

const ALLOWED_MIME_TYPES = new Map<string, string[]>([
  ['application/pdf', ['.pdf']],
  ['application/msword', ['.doc']],
  ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', ['.docx']],
  ['application/vnd.ms-excel', ['.xls']],
  ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ['.xlsx']],
  ['text/csv', ['.csv']],
  ['text/plain', ['.txt']],
  ['application/vnd.ms-powerpoint', ['.ppt']],
  ['application/vnd.openxmlformats-officedocument.presentationml.presentation', ['.pptx']],
  ['image/png', ['.png']],
  ['image/jpeg', ['.jpg', '.jpeg']],
  ['image/webp', ['.webp']],
]);

const ALLOWED_EXTENSIONS = new Set(['.pdf','.doc','.docx','.xls','.xlsx','.ppt','.pptx','.txt','.csv','.png','.jpg','.jpeg','.webp']);

export function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const uploadPath = path.resolve(process.cwd(), env.ADMIN_REPORT_UPLOAD_DIR || './uploads/reports');
    if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = ALLOWED_EXTENSIONS.has(ext) ? ext : '.bin';
    const random = crypto.randomBytes(16).toString('hex');
    const stored = `${Date.now()}-${random}${safeExt}`;
    cb(null, stored);
  },
});

const fileFilter = (_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    cb(new AppError(`File extension ${ext} not allowed. Allowed: ${Array.from(ALLOWED_EXTENSIONS).join(', ')}`, 400));
    return;
  }
  // Allow mime check but be permissive for browsers that send generic mime for csv/txt
  if (file.mimetype && ALLOWED_MIME_TYPES.has(file.mimetype)) {
    const allowedExts = ALLOWED_MIME_TYPES.get(file.mimetype)!;
    if (!allowedExts.includes(ext) && !(file.mimetype === 'text/plain' && ['.txt','.csv'].includes(ext))) {
      // still allow if extension is valid
    }
  }
  // Also block path traversal in originalname
  if (file.originalname.includes('..') || file.originalname.includes('/') || file.originalname.includes('\\')) {
    cb(new AppError('Invalid file name', 400));
    return;
  }
  cb(null, true);
};

export const reportUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: parseInt(env.MAX_FILE_SIZE_MB, 10) * 1024 * 1024 },
});
