import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { permit } from '../middleware/roles.js';
import { ROLES } from '../config/auth.js';
import { list, create, update, getOne } from '../controllers/users.controller.js';

const r = Router();

r.use(auth, permit(ROLES.ADMIN));
r.get('/', list);
r.get('/:id', getOne);
r.post('/', create);
r.patch('/:id', update);

export default r;
