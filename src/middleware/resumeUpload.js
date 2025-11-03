import fs from 'fs';
import path from 'path';
import multer from 'multer';

const RESUME_DIR = path.resolve(process.cwd(), 'storage', 'resumes');

const ensureDir = dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    try {
      ensureDir(RESUME_DIR);
      cb(null, RESUME_DIR);
    } catch (error) {
      cb(error);
    }
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.pdf';
    const name = `resume-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
    cb(null, name);
  }
});

const fileFilter = (_req, file, cb) => {
  if (file.mimetype !== 'application/pdf') {
    cb(new Error('Only PDF files are allowed.'));
  } else {
    cb(null, true);
  }
};

export const resumeUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 12 * 1024 * 1024 } // 12MB
});

