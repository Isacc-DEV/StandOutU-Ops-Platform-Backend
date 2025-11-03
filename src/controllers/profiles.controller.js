import { prisma } from '../config/db.js';
import { PROFILE_ACCESS, ROLES } from '../config/auth.js';
import { isValidId } from '../utils/id.js';

const profileAccessFor = req => {
  if (req.user?.role === ROLES.ADMIN) {
    return PROFILE_ACCESS.EDIT;
  }
  return req.user?.permissions?.profiles || PROFILE_ACCESS.VIEW;
};

const PROFILE_STATUS_VALUES = ['ACTIVE', 'PRESTART', 'DISABLED'];
const LINKEDIN_STATUS_VALUES = ['RESTRICTED', 'LIVE_STABLE', 'LIVE_GOOD', 'LIVE_EARLY', 'APPEALING'];

const normalizeStatusInput = (value, allowed, fallback) => {
  if (!value) return fallback;
  const normalized = value
    .toString()
    .trim()
    .toUpperCase()
    .replace(/[\s()-]+/g, '_');
  if (allowed.includes(normalized)) {
    return normalized;
  }
  return fallback;
};

const formatStatusOutput = value => value?.toString().trim().toLowerCase().replace(/[\s()-]+/g, '_');

const buildSearchFilter = q => {
  if (!q) return undefined;
  return {
    OR: [
      { alias: { contains: q, mode: 'insensitive' } },
      { firstName: { contains: q, mode: 'insensitive' } },
      { lastName: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } }
    ]
  };
};

const mapProfile = profile => {
  if (!profile) return null;
  const owners =
    profile.owners?.map(owner => {
      if (!owner?.user) return null;
    return {
      id: owner.user.id,
      name: owner.user.name,
      email: owner.user.email
    };
  }).filter(Boolean) || [];
  return {
    id: profile.id,
    alias: profile.alias,
    firstName: profile.firstName,
    lastName: profile.lastName,
    email: profile.email || '',
    status: formatStatusOutput(profile.status) || 'active',
    linkedinUrl: profile.linkedinUrl || '',
    linkedinStatus: formatStatusOutput(profile.linkedinStatus) || 'restricted',
    owners,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
    fullName: `${profile.firstName || ''} ${profile.lastName || ''}`.trim()
  };
};

const mapResume = resume => {
  if (!resume) return null;
  return {
    id: resume.id,
    profileId: resume.profileId,
    title: resume.title || '',
    stack: resume.stack || '',
    note: resume.note || '',
    storage: resume.storage || '',
    docxStorage: resume.docxStorage || '',
    storageOriginalName: resume.storageOriginalName || '',
    storageMimeType: resume.storageMimeType || '',
    version: resume.version || 'v1',
    createdBy: resume.createdByUser
      ? {
          id: resume.createdByUser.id,
          name: resume.createdByUser.name,
          email: resume.createdByUser.email
        }
      : null,
    content: resume.content || {},
    createdAt: resume.createdAt,
    updatedAt: resume.updatedAt
  };
};

export const list = async (req, res) => {
  const access = profileAccessFor(req);
  if (access === PROFILE_ACCESS.NONE) {
    return res.status(403).json({ error: 'No profile access' });
  }
  const { q } = req.query;
  const where = buildSearchFilter(q);
  const items = await prisma.profile.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      alias: true,
      firstName: true,
      lastName: true,
      email: true,
      status: true,
      linkedinUrl: true,
      linkedinStatus: true,
      updatedAt: true,
      createdAt: true
    }
  });
  res.json(
    items.map(item =>
      mapProfile({
        ...item,
        owners: []
      })
    )
  );
};

export const create = async (req, res) => {
  const access = profileAccessFor(req);
  if (access !== PROFILE_ACCESS.EDIT) {
    return res.status(403).json({ error: 'Profile editing not permitted' });
  }
  const { owners = [], ...rest } = req.body || {};
  const ownerIds = Array.isArray(owners) ? owners.filter(id => isValidId(id)) : [];
  const email = (rest.email || '').toString().trim();
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }
  const profile = await prisma.profile.create({
    data: {
      alias: rest.alias,
      firstName: rest.firstName,
      lastName: rest.lastName,
      email,
      status: normalizeStatusInput(rest.status, PROFILE_STATUS_VALUES, PROFILE_STATUS_VALUES[0]),
      linkedinUrl: (rest.linkedinUrl || '').toString().trim() || null,
      linkedinStatus: normalizeStatusInput(
        rest.linkedinStatus,
        LINKEDIN_STATUS_VALUES,
        LINKEDIN_STATUS_VALUES[0]
      )
    }
  });
  if (ownerIds.length) {
    await prisma.profileOwner.createMany({
      data: ownerIds.map(userId => ({ profileId: profile.id, userId })),
      skipDuplicates: true
    });
  }
  const withOwners = await prisma.profile.findUnique({
    where: { id: profile.id },
    include: {
      owners: {
        include: {
          user: {
            select: { id: true, name: true, email: true }
          }
        }
      }
    }
  });
  res.status(201).json(mapProfile(withOwners));
};

export const update = async (req, res) => {
  const access = profileAccessFor(req);
  if (access !== PROFILE_ACCESS.EDIT) {
    return res.status(403).json({ error: 'Profile editing not permitted' });
  }

  const dataToUpdate = {};

  if (Object.prototype.hasOwnProperty.call(req.body, 'alias')) {
    dataToUpdate.alias = req.body.alias;
  }

  if (Object.prototype.hasOwnProperty.call(req.body, 'firstName')) {
    dataToUpdate.firstName = req.body.firstName;
  }

  if (Object.prototype.hasOwnProperty.call(req.body, 'lastName')) {
    dataToUpdate.lastName = req.body.lastName;
  }

  if (Object.prototype.hasOwnProperty.call(req.body, 'email')) {
    const email = (req.body.email || '').toString().trim();
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    dataToUpdate.email = email;
  }

  if (Object.prototype.hasOwnProperty.call(req.body, 'status')) {
    const nextStatus = normalizeStatusInput(req.body.status, PROFILE_STATUS_VALUES, null);
    if (!nextStatus) {
      return res.status(400).json({ error: 'Invalid profile status' });
    }
    dataToUpdate.status = nextStatus;
  }

  if (Object.prototype.hasOwnProperty.call(req.body, 'linkedinStatus')) {
    const nextLinkedinStatus = normalizeStatusInput(
      req.body.linkedinStatus,
      LINKEDIN_STATUS_VALUES,
      null
    );
    if (!nextLinkedinStatus) {
      return res.status(400).json({ error: 'Invalid LinkedIn status' });
    }
    dataToUpdate.linkedinStatus = nextLinkedinStatus;
  }

  if (Object.prototype.hasOwnProperty.call(req.body, 'linkedinUrl')) {
    const url = (req.body.linkedinUrl || '').toString().trim();
    dataToUpdate.linkedinUrl = url || null;
  }

  try {
    const profile = await prisma.profile.update({
      where: { id: req.params.id },
      data: dataToUpdate,
      include: {
        owners: {
          include: {
            user: {
              select: { id: true, name: true, email: true }
            }
          }
        }
      }
    });
    res.json(mapProfile(profile));
  } catch (error) {
    if (error?.code === 'P2025') {
      return res.status(404).json({ error: 'Profile not found' });
    }
    throw error;
  }
};

export const getOne = async (req, res) => {
  const access = profileAccessFor(req);
  if (access === PROFILE_ACCESS.NONE) {
    return res.status(403).json({ error: 'No profile access' });
  }
  const profile = await prisma.profile.findUnique({
    where: { id: req.params.id },
    include: {
      owners: {
        include: {
          user: {
            select: { id: true, name: true, email: true }
          }
        }
      }
    }
  });
  if (!profile) return res.status(404).json({ error: 'Profile not found' });

  const resumes = await prisma.resume.findMany({
    where: { profileId: req.params.id },
    include: {
      createdByUser: {
        select: { id: true, name: true, email: true }
      }
    },
    orderBy: { updatedAt: 'desc' }
  });

  res.json({
    profile: mapProfile(profile),
    resumes: resumes.map(mapResume)
  });
};
