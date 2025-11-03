import bcrypt from 'bcryptjs';
import { prisma } from '../config/db.js';
import { PROFILE_ACCESS, ROLES } from '../config/auth.js';

const DEFAULT_EMAIL = process.env.DEFAULT_ADMIN_EMAIL || 'admin@ops.local';
const DEFAULT_PASSWORD = process.env.DEFAULT_ADMIN_PASSWORD || 'password123';

export const ensureDefaultAdmin = async () => {
  const existing = await prisma.user.findUnique({ where: { email: DEFAULT_EMAIL } });
  if (existing) return;

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  await prisma.user.create({
    data: {
      name: 'Admin',
      email: DEFAULT_EMAIL,
      passwordHash,
      role: ROLES.ADMIN,
      companyRole: 'Operations Manager',
      avatarUrl: '',
      permissions: {
        applications: {
          manageAll: true,
          checkAll: false,
          manageApplications: [],
          checkApplications: []
        },
        profiles: PROFILE_ACCESS.EDIT
      }
    }
  });

  console.log(`Default admin created @ ${DEFAULT_EMAIL}`);
};
