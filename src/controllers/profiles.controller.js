import { prisma } from '../config/db.js';
import { PROFILE_ACCESS, ROLES } from '../config/auth.js';
import { isValidId } from '../utils/id.js';

const profileAccessFor = req => {
  if (req.user?.role === ROLES.ADMIN) {
    return PROFILE_ACCESS.EDIT;
  }
  return req.user?.permissions?.profiles || PROFILE_ACCESS.VIEW;
};

const buildSearchFilter = q => {
  if (!q) return undefined;
  return {
    OR: [
      { alias: { contains: q, mode: 'insensitive' } },
      { firstName: { contains: q, mode: 'insensitive' } },
      { lastName: { contains: q, mode: 'insensitive' } },
      { tags: { has: q } },
      { tags: { has: q.toLowerCase() } },
      {
        contact: {
          path: ['email'],
          string_contains: q,
          mode: 'insensitive'
        }
      }
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
    contact: profile.contact || {},
    tags: profile.tags || [],
    summary: profile.summary || '',
    links: profile.links || [],
    active: typeof profile.active === 'boolean' ? profile.active : true,
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
      contact: true,
      tags: true,
      summary: true,
      links: true,
      updatedAt: true,
      createdAt: true,
      active: true
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
  const profile = await prisma.profile.create({
    data: {
      alias: rest.alias,
      firstName: rest.firstName,
      lastName: rest.lastName,
      summary: rest.summary || '',
      active: typeof rest.active === 'boolean' ? rest.active : true,
      contact: rest.contact || {},
      tags: Array.isArray(rest.tags) ? rest.tags : [],
      links: Array.isArray(rest.links) ? rest.links : []
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

  const allowedFields = [
    'alias',
    'firstName',
    'lastName',
    'summary',
    'tags',
    'links',
    'contact',
    'active'
  ];
  const update = {};
  for (const key of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(req.body, key)) {
      update[key] = req.body[key];
    }
  }

  if (update.tags && !Array.isArray(update.tags)) {
    update.tags = [];
  }
  if (update.links && !Array.isArray(update.links)) {
    update.links = [];
  }

  const dataToUpdate = {};
  for (const key of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(update, key)) {
      dataToUpdate[key] = update[key];
    }
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
