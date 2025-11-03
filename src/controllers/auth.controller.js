import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { prisma } from '../config/db.js';
import { PROFILE_ACCESS } from '../config/auth.js';
import { JWT_SECRET } from '../config/jwt.js';
import { defaultApplicationPermissions, normalizeApplicationPermissions } from '../utils/permissions.js';

const buildPermissions = user => {
  const rawPermissions = user?.permissions && typeof user.permissions === 'object' ? user.permissions : {};
  return {
    applications: normalizeApplicationPermissions(rawPermissions.applications) || defaultApplicationPermissions(),
    profiles: rawPermissions.profiles || PROFILE_ACCESS.VIEW
  };
};

const buildUserPayload = user => {
  const permissions = buildPermissions(user);
  return {
    id: user.id,
    role: user.role,
    name: user.name,
    email: user.email,
    companyRole: user.companyRole || '',
    avatarUrl: user.avatarUrl || '',
    permissions
  };
};

export const login = async (req, res) => {
  const { email, password } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ error: 'Invalid creds' });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Invalid creds' });

  const payload = buildUserPayload(user);
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: payload });
};
