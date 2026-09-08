import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { env } from '../config/env';
import { AppError } from './errorHandler';

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
  'text/plain',
  'message/rfc822',
];

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const uploadPath = env.UPLOAD_DIR;
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const fileFilter = (_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError(`File type ${file.mimetype} not supported`, 400));
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(env.MAX_FILE_SIZE_MB, 10) * 1024 * 1024,
  },
});
