import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { getStats } from '../controllers/dashboard.controller.js';

const r = Router();
r.get('/stats', auth, getStats);

export default r;
