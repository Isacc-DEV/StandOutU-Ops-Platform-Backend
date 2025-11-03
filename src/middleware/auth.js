import jwt from 'jsonwebtoken';
import { prisma } from '../config/db.js';
import { PROFILE_ACCESS } from '../config/auth.js';
import { JWT_SECRET } from '../config/jwt.js';
import {
  defaultApplicationPermissions,
  normalizeApplicationPermissions
} from '../utils/permissions.js';

const defaultPermissions = () => ({
  applications: defaultApplicationPermissions(),
  profiles: PROFILE_ACCESS.VIEW
});

export const auth = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      include: {
        profilesAssigned: {
          select: { profileId: true }
        }
      }
    });
    if (!user) return res.status(401).json({ error: 'User no longer exists' });

    const rawPermissions =
      (user.permissions && typeof user.permissions === 'object' ? user.permissions : null) ||
      defaultPermissions();
    const permissions = {
      profiles: rawPermissions.profiles || PROFILE_ACCESS.VIEW,
      applications:
        normalizeApplicationPermissions(rawPermissions.applications) || defaultApplicationPermissions()
    };

    req.user = {
      id: user.id,
      role: user.role,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
      companyRole: user.companyRole,
      permissions,
      profilesAssigned: (user.profilesAssigned || []).map(assignment => assignment.profileId)
    };
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};
