import bcrypt from 'bcryptjs';
import { prisma } from '../config/db.js';
import { PROFILE_ACCESS } from '../config/auth.js';
import {
  defaultApplicationPermissions,
  mergeApplicationPermissions,
  normalizeApplicationPermissions
} from '../utils/permissions.js';
import { isValidId, toIdString } from '../utils/id.js';

const validProfileAccess = new Set(Object.values(PROFILE_ACCESS));

const defaultPermissions = () => ({
  applications: defaultApplicationPermissions(),
  profiles: PROFILE_ACCESS.VIEW
});

const toIdArray = values => {
  if (!Array.isArray(values)) return [];
  const unique = new Set();
  const result = [];
  values.forEach(value => {
    const stringId = toIdString(value).trim();
    if (!stringId || !isValidId(stringId)) return;
    if (!unique.has(stringId)) {
      unique.add(stringId);
      result.push(stringId);
    }
  });
  return result;
};

const extractPermissions = source =>
  (source && typeof source === 'object' ? source : null) || defaultPermissions();

const mergePermissions = (current, incoming = {}) => {
  const currentSafe = {
    profiles: current?.profiles || PROFILE_ACCESS.VIEW,
    applications: normalizeApplicationPermissions(current?.applications)
  };
  const mergedProfiles = validProfileAccess.has(incoming?.profiles)
    ? incoming.profiles
    : currentSafe.profiles;
  const mergedApplications = mergeApplicationPermissions(currentSafe.applications, incoming?.applications);
  return {
    profiles: mergedProfiles,
    applications: mergedApplications
  };
};

const buildPermissionPayload = (current, incoming) => {
  const merged = mergePermissions(current, incoming);
  return {
    profiles: merged.profiles,
    applications: {
      manageAll: merged.applications.manageAll,
      checkAll: merged.applications.checkAll,
      manageProfiles: toIdArray(merged.applications.manageProfiles),
      checkProfiles: toIdArray(merged.applications.checkProfiles)
    }
  };
};

const sanitizeUser = user => {
  if (!user) return user;
  const base = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    companyRole: user.companyRole || '',
    avatarUrl: user.avatarUrl || '',
    timezone: user.timezone || 'UTC',
    profilesAssigned:
      user.profilesAssigned?.map(assignment => {
        const profile = assignment.profile;
        if (!profile) return null;
        return {
          id: profile.id,
          alias: profile.alias,
          firstName: profile.firstName,
          lastName: profile.lastName
        };
      }).filter(Boolean) || [],
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
  base.permissions = {
    profiles: user.permissions?.profiles || PROFILE_ACCESS.VIEW,
    applications: normalizeApplicationPermissions(user.permissions?.applications)
  };
  return base;
};

const assignIfDefined = (target, source, keys) => {
  keys.forEach(key => {
    if (Object.prototype.hasOwnProperty.call(source, key) && source[key] !== undefined) {
      target[key] = source[key];
    }
  });
};

const userInclude = {
  profilesAssigned: {
    include: {
      profile: true
    }
  }
};

export const list = async (_req, res) => {
  const users = await prisma.user.findMany({
    include: userInclude,
    orderBy: { createdAt: 'asc' }
  });
  const result = users.map(sanitizeUser);
  res.json(result);
};

export const create = async (req, res) => {
  const { password, permissions, ...rest } = req.body;
  if (!password) {
    return res.status(400).json({ error: 'Password is required' });
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const permissionPayload = buildPermissionPayload(defaultPermissions(), permissions);
  const user = await prisma.user.create({
    data: {
      name: rest.name,
      email: rest.email,
      role: rest.role,
      companyRole: rest.companyRole || '',
      avatarUrl: rest.avatarUrl || '',
      timezone: rest.timezone || 'UTC',
      passwordHash,
      permissions: permissionPayload
    },
    include: userInclude
  });
  res.status(201).json(sanitizeUser(user));
};

export const update = async (req, res) => {
  const { password, permissions, ...rest } = req.body;
  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    include: userInclude
  });
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const updatePayload = {};
  assignIfDefined(updatePayload, rest, ['name', 'email', 'companyRole', 'avatarUrl', 'timezone']);

  if (permissions) {
    const current = extractPermissions(user.permissions);
    const merged = buildPermissionPayload(current, permissions);
    updatePayload.permissions = merged;
  }

  if (password) {
    updatePayload.passwordHash = await bcrypt.hash(password, 10);
  }

  const updated = await prisma.user.update({
    where: { id: req.params.id },
    data: updatePayload,
    include: userInclude
  });

  res.json(sanitizeUser(updated));
};

export const getOne = async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    include: userInclude
  });
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(sanitizeUser(user));
};
