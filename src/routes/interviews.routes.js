import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { permit } from '../middleware/roles.js';
import { ROLES } from '../config/auth.js';
import { schedule, list } from '../controllers/interviews.controller.js';

const r = Router();

r.get('/', auth, list);
r.post('/', auth, permit(ROLES.ADMIN, ROLES.CALLER, ROLES.SUPPORT), schedule);

export default r;
