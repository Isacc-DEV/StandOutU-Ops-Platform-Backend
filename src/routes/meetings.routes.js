import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { permit } from '../middleware/roles.js';
import { ROLES } from '../config/auth.js';
import { list, schedule } from '../controllers/meetings.controller.js';

const r = Router();

r.get('/', auth, list);
r.post('/', auth, permit(ROLES.ADMIN, ROLES.CALLER, ROLES.SUPPORT), schedule);

export default r;
