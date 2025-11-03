import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { resumeUpload } from '../middleware/resumeUpload.js';
import {
  list,
  create,
  update,
  remove,
  download,
  downloadDocx
} from '../controllers/resumes.controller.js';

const r = Router();

r.get('/', auth, list);
r.get('/:id/pdf', auth, download);
r.get('/:id/docx', auth, downloadDocx);
r.post('/', auth, (req, res, next) => {
  resumeUpload.single('file')(req, res, err => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Failed to upload resume file' });
    }
    next();
  });
}, create);
r.patch('/:id', auth, (req, res, next) => {
  resumeUpload.single('file')(req, res, err => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Failed to upload resume file' });
    }
    next();
  });
}, update);
r.delete('/:id', auth, remove);

export default r;
