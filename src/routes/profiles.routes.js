import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { list, create, update, getOne } from '../controllers/profiles.controller.js';

const r = Router();

r.get('/', auth, list);
r.get('/:id', auth, getOne);
r.post('/', auth, create);
r.patch('/:id', auth, update);

export default r;
