import 'dotenv/config';
import { connectDB, disconnectDB, prisma } from '../config/db.js';
import { PROFILE_ACCESS } from '../config/auth.js';
import { normalizeApplicationPermissions } from '../utils/permissions.js';

const toUniqueStrings = values => {
  if (!Array.isArray(values)) return [];
  const set = new Set();
  values.forEach(value => {
    if (value === null || value === undefined) return;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) set.add(trimmed);
      return;
    }
    if (value._id || value.id) {
      set.add((value._id || value.id).toString());
      return;
    }
    if (typeof value.toString === 'function') {
      const asString = value.toString();
      if (asString && asString !== '[object Object]') {
        set.add(asString);
      }
    }
  });
  return Array.from(set);
};

await connectDB();

const users = await prisma.user.findMany({
  select: { id: true, permissions: true }
});

for (const user of users) {
  const rawPermissions =
    (user.permissions && typeof user.permissions === 'object' ? user.permissions : null) || {};
  const normalizedApps = normalizeApplicationPermissions(rawPermissions.applications);
  const updatedPermissions = {
    profiles: rawPermissions.profiles || PROFILE_ACCESS.VIEW,
    applications: {
      manageAll: normalizedApps.manageAll,
      checkAll: normalizedApps.checkAll,
      manageApplications: toUniqueStrings(normalizedApps.manageApplications),
      checkApplications: toUniqueStrings(normalizedApps.checkApplications)
    }
  };

  await prisma.user.update({
    where: { id: user.id },
    data: { permissions: updatedPermissions }
  });
}

await disconnectDB();
console.log(`Migrated permissions for ${users.length} users`);
