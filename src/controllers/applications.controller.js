import { prisma } from '../config/db.js';
import {
  APPLICATION_CHECK_RESULT,
  APPLICATION_CHECK_RESULT_LIST,
  APPLICATION_CHECK_STATUS,
  APPLICATION_CHECK_STATUS_LIST,
  ROLES
} from '../config/auth.js';
import {
  defaultApplicationPermissions,
  normalizeApplicationPermissions
} from '../utils/permissions.js';
import { isValidId, toIdString } from '../utils/id.js';

const GENERAL_EDIT_FIELDS = [
  'company',
  'roleTitle',
  'jobUrl',
  'bidderNote',
  'profileId',
  'bidderId',
  'resumeId'
];

const pickFields = (source, keys) => {
  const out = {};
  keys.forEach(key => {
    if (Object.prototype.hasOwnProperty.call(source, key) && source[key] !== undefined) {
      out[key] = source[key];
    }
  });
  return out;
};

const applicationPermissionsFor = req =>
  normalizeApplicationPermissions(req.user?.permissions?.applications) ||
  defaultApplicationPermissions();

const normalizeId = value => {
  const stringValue = toIdString(value).trim();
  return stringValue;
};

const addIdToSet = (set, value) => {
  const id = normalizeId(value);
  if (id) set.add(id);
};

const listManageApplicationIds = perms =>
  perms.manageApplications || perms.manageProfiles || [];

const listCheckApplicationIds = perms =>
  perms.checkApplications || perms.checkProfiles || [];

const buildManageProfileSet = (req, perms) => {
  if (req.user.role === ROLES.ADMIN || perms.manageAll || perms.checkAll) return null;
  const set = new Set();
  listManageApplicationIds(perms).forEach(id => addIdToSet(set, id));
  listCheckApplicationIds(perms).forEach(id => addIdToSet(set, id));
  (req.user?.profilesAssigned || []).forEach(id => addIdToSet(set, id));
  return set;
};

const buildAccessibleProfileSet = (req, perms) => {
  if (req.user.role === ROLES.ADMIN || perms.manageAll || perms.checkAll) return null;
  const set = new Set();
  listManageApplicationIds(perms).forEach(id => addIdToSet(set, id));
  listCheckApplicationIds(perms).forEach(id => addIdToSet(set, id));
  (req.user?.profilesAssigned || []).forEach(id => addIdToSet(set, id));
  return set;
};

const buildCheckProfileSet = (req, perms, manageSet) => {
  if (req.user.role === ROLES.ADMIN || perms.manageAll || perms.checkAll) return null;
  const set = new Set();
  listCheckApplicationIds(perms).forEach(id => addIdToSet(set, id));
  if (!set.size) {
    if (manageSet === null) {
      return null;
    }
    if (manageSet instanceof Set) {
      manageSet.forEach(id => addIdToSet(set, id));
    }
  }
  if (!set.size) {
    (req.user?.profilesAssigned || []).forEach(id => addIdToSet(set, id));
  }
  return set;
};

const setHas = (set, value) => {
  const id = normalizeId(value);
  if (!id) return false;
  if (set === null) return true;
  if (set instanceof Set) return set.has(id);
  return false;
};

const getProfileIdString = application => {
  if (!application) return '';
  if (typeof application.profileId === 'string') return application.profileId;
  if (application.profile?.id) return application.profile.id;
  if (typeof application.profile === 'string') return application.profile;
  return '';
};

const getBidderIdString = application => {
  if (!application) return '';
  if (typeof application.bidderId === 'string') return application.bidderId;
  if (application.bidder?.id) return application.bidder.id;
  if (typeof application.bidder === 'string') return application.bidder;
  return '';
};

const canViewApplication = (req, application, perms, accessibleSet) => {
  if (!application) return false;
  if (req.user.role === ROLES.ADMIN || perms.manageAll) return true;
  const bidderId = getBidderIdString(application);
  if (bidderId && bidderId === req.user.id) return true;
  const profileId = getProfileIdString(application);
  if (!profileId) return false;
  const accessible = accessibleSet ?? buildAccessibleProfileSet(req, perms);
  return setHas(accessible, profileId);
};

const canCheckApplication = (req, application, perms, targetProfileId, checkSet) => {
  if (req.user.role === ROLES.ADMIN || perms.manageAll || perms.checkAll) return true;
  const profileId = targetProfileId || getProfileIdString(application);
  if (!profileId) return false;
  const checkable = checkSet ?? buildCheckProfileSet(req, perms, buildManageProfileSet(req, perms));
  return setHas(checkable, profileId);
};

const mapProfileLite = profile => {
  if (!profile) return null;
  const personName = `${profile.firstName || ''} ${profile.lastName || ''}`.trim();
  return {
    _id: profile.id,
    id: profile.id,
    alias: profile.alias,
    firstName: profile.firstName,
    lastName: profile.lastName,
    personName
  };
};

const mapUserLite = user => {
  if (!user) return null;
  return {
    _id: user.id,
    id: user.id,
    name: user.name,
    email: user.email || ''
  };
};

const mapResumeLite = resume => {
  if (!resume) return null;
  return {
    _id: resume.id,
    id: resume.id,
    title: resume.title || 'Untitled resume'
  };
};

const mapApplicationRecord = app => ({
  _id: app.id,
  id: app.id,
  company: app.company,
  roleTitle: app.roleTitle,
  jobUrl: app.jobUrl || '',
  steps: Array.isArray(app.steps) ? app.steps : [],
  resumeId: app.resume ? mapResumeLite(app.resume) : app.resumeId,
  profileId: app.profile ? mapProfileLite(app.profile) : app.profileId,
  bidderId: app.bidder ? mapUserLite(app.bidder) : app.bidderId,
  checkStatus: app.checkStatus,
  checkedBy: mapUserLite(app.checkedBy),
  checkedAt: app.checkedAt,
  bidderNote: app.bidderNote || '',
  checkNote: app.checkNote || '',
  checkResult: app.checkResult || APPLICATION_CHECK_RESULT.PENDING,
  createdAt: app.createdAt,
  updatedAt: app.updatedAt,
  appliedAt: app.createdAt
});

const mapResumesByProfile = resumes =>
  resumes.reduce((acc, resume) => {
    const profileId = typeof resume.profileId === 'string' ? resume.profileId : resume.profileId?.id;
    if (!profileId) return acc;
    if (!acc[profileId]) acc[profileId] = [];
    acc[profileId].push({
      _id: resume.id,
      id: resume.id,
      title: resume.title || 'Untitled resume'
    });
    return acc;
  }, {});

const ensureNullIfEmpty = value => {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string' && !value.trim()) return null;
  return value;
};

const baseApplicationInclude = {
  resume: {
    select: { id: true, title: true }
  },
  profile: {
    select: { id: true, alias: true, firstName: true, lastName: true }
  },
  bidder: {
    select: { id: true, name: true, email: true }
  },
  checkedBy: {
    select: { id: true, name: true, email: true }
  }
};

export const list = async (req, res) => {
  const perms = applicationPermissionsFor(req);
  const accessibleProfilesSet = buildAccessibleProfileSet(req, perms);
  const isAdmin = req.user.role === ROLES.ADMIN;
  const hasGlobalAccess = isAdmin || perms.manageAll || accessibleProfilesSet === null;

  const { page = 1, limit = 20, q } = req.query;
  const numericLimit = Math.max(1, Number(limit) || 20);
  const numericPage = Math.max(1, Number(page) || 1);

  const filters = [];
  if (q) {
    filters.push({
      OR: [
        { company: { contains: q, mode: 'insensitive' } },
        { roleTitle: { contains: q, mode: 'insensitive' } },
        { bidderNote: { contains: q, mode: 'insensitive' } },
        { checkNote: { contains: q, mode: 'insensitive' } }
      ]
    });
  }

  if (!hasGlobalAccess) {
    const accessibleProfiles = accessibleProfilesSet
      ? Array.from(accessibleProfilesSet)
      : [];
    const conditions = [{ bidderId: req.user.id }];
    if (accessibleProfiles.length) {
      conditions.push({ profileId: { in: accessibleProfiles } });
    }
    filters.push({ OR: conditions });
  }

  const where = filters.length ? { AND: filters } : undefined;

  const [apps, count] = await Promise.all([
    prisma.application.findMany({
      where,
      include: baseApplicationInclude,
      orderBy: { createdAt: 'desc' },
      skip: (numericPage - 1) * numericLimit,
      take: numericLimit
    }),
    prisma.application.count({ where })
  ]);

  const profileIdSet = new Set();
  if (accessibleProfilesSet instanceof Set) {
    accessibleProfilesSet.forEach(id => profileIdSet.add(id));
  }
  apps.forEach(app => {
    const profileId = getProfileIdString(app);
    if (profileId) profileIdSet.add(profileId);
  });

  let profiles = [];
  if (hasGlobalAccess) {
    profiles = await prisma.profile.findMany({
      select: { id: true, alias: true, firstName: true, lastName: true }
    });
  } else if (profileIdSet.size) {
    profiles = await prisma.profile.findMany({
      where: { id: { in: Array.from(profileIdSet) } },
      select: { id: true, alias: true, firstName: true, lastName: true }
    });
  }

  let resumes = [];
  if (hasGlobalAccess) {
    resumes = await prisma.resume.findMany({
      select: { id: true, profileId: true, title: true }
    });
  } else if (profileIdSet.size) {
    resumes = await prisma.resume.findMany({
      where: { profileId: { in: Array.from(profileIdSet) } },
      select: { id: true, profileId: true, title: true }
    });
  }

  const biddersRaw =
    isAdmin || perms.manageAll
      ? await prisma.user.findMany({
          where: { role: ROLES.BIDDER },
          select: { id: true, name: true }
        })
      : [{ id: req.user.id, name: req.user.name }];

  const bidderOptions = biddersRaw.map(b => ({
    _id: b.id,
    id: b.id,
    name: b.name || ''
  }));

  const profileOptions = profiles.map(profile => {
    const personName = `${profile.firstName || ''} ${profile.lastName || ''}`.trim();
    return {
      _id: profile.id,
      id: profile.id,
      alias: profile.alias,
      personName
    };
  });

  res.json({
    items: apps.map(mapApplicationRecord),
    page: numericPage,
    pages: Math.ceil(count / numericLimit),
    total: count,
    meta: {
      checkStatuses: APPLICATION_CHECK_STATUS_LIST,
      checkResults: APPLICATION_CHECK_RESULT_LIST,
      profiles: profileOptions,
      bidders: bidderOptions,
      resumesByProfile: mapResumesByProfile(resumes),
      access: perms,
      capabilities: {
        canAssignOtherBidders: isAdmin || perms.manageAll || perms.checkAll
      }
    }
  });
};

export const create = async (req, res) => {
  const perms = applicationPermissionsFor(req);
  const accessibleProfiles = buildAccessibleProfileSet(req, perms);
  const manageProfiles = buildManageProfileSet(req, perms);
  const isAdmin = req.user.role === ROLES.ADMIN;

  const payload = pickFields(req.body, GENERAL_EDIT_FIELDS);
  if (!payload.profileId) {
    return res.status(400).json({ error: 'profileId is required' });
  }
  if (!isValidId(payload.profileId)) {
    return res.status(400).json({ error: 'Invalid profileId' });
  }

  if (!payload.company || !payload.roleTitle) {
    return res.status(400).json({ error: 'company and roleTitle are required' });
  }

  const manageAccess =
    isAdmin ||
    perms.manageAll ||
    perms.checkAll ||
    setHas(manageProfiles, payload.profileId);
  if (
    !manageAccess &&
    accessibleProfiles !== null &&
    !setHas(accessibleProfiles, payload.profileId)
  ) {
    return res.status(403).json({ error: 'Profile is not accessible for this account' });
  }

  if (!manageAccess) {
    return res.status(403).json({ error: 'Creating applications is not permitted' });
  }

  const canAssignOtherBidders = isAdmin || perms.manageAll || perms.checkAll;
  if (!canAssignOtherBidders) {
    payload.bidderId = req.user.id;
  } else if (payload.bidderId) {
    if (!isValidId(payload.bidderId)) {
      return res.status(400).json({ error: 'Invalid bidderId' });
    }
  } else {
    payload.bidderId = req.user.id;
  }

  if (payload.resumeId) {
    payload.resumeId = ensureNullIfEmpty(payload.resumeId);
    if (payload.resumeId && !isValidId(payload.resumeId)) {
      return res.status(400).json({ error: 'Invalid resumeId' });
    }
  }

  const steps = Array.isArray(req.body.steps) ? req.body.steps : [];

  try {
    const created = await prisma.application.create({
      data: {
        company: payload.company,
        roleTitle: payload.roleTitle,
        jobUrl: payload.jobUrl || '',
        bidderNote: payload.bidderNote || '',
        checkNote: '',
        checkResult: APPLICATION_CHECK_RESULT.PENDING,
        profileId: payload.profileId,
        bidderId: payload.bidderId,
        resumeId: payload.resumeId || null,
        steps,
        checkStatus: APPLICATION_CHECK_STATUS.PENDING
      },
      include: baseApplicationInclude
    });
    res.status(201).json(mapApplicationRecord(created));
  } catch (error) {
    if (error?.code === 'P2003') {
      return res.status(400).json({ error: 'Related record not found' });
    }
    throw error;
  }
};

export const update = async (req, res) => {
  const perms = applicationPermissionsFor(req);
  const accessibleProfiles = buildAccessibleProfileSet(req, perms);
  const manageProfiles = buildManageProfileSet(req, perms);
  const checkableProfiles = buildCheckProfileSet(req, perms, manageProfiles);
  const isAdmin = req.user.role === ROLES.ADMIN;
  const hasGlobalManage = isAdmin || perms.manageAll || perms.checkAll;

  const generalUpdates = pickFields(req.body, GENERAL_EDIT_FIELDS);
  const hasGeneralUpdates = Object.keys(generalUpdates).length > 0;
  const hasCheckStatusUpdate = Object.prototype.hasOwnProperty.call(req.body, 'checkStatus');
  const hasCheckNoteUpdate = Object.prototype.hasOwnProperty.call(req.body, 'checkNote');
  const hasCheckResultUpdate = Object.prototype.hasOwnProperty.call(req.body, 'checkResult');
  const hasCheckUpdates = hasCheckStatusUpdate || hasCheckNoteUpdate || hasCheckResultUpdate;
  if (!hasGeneralUpdates && !hasCheckUpdates) {
    return res.status(400).json({ error: 'No changes supplied' });
  }

  const app = await prisma.application.findUnique({
    where: { id: req.params.id },
    include: baseApplicationInclude
  });
  if (!app) {
    return res.status(404).json({ error: 'Application not found' });
  }

  if (!canViewApplication(req, app, perms, accessibleProfiles)) {
    return res.status(403).json({ error: 'Not permitted' });
  }

  const currentProfileId = getProfileIdString(app);
  if (hasGeneralUpdates && !hasGlobalManage && !setHas(manageProfiles, currentProfileId)) {
    return res.status(403).json({ error: 'Editing applications is not permitted' });
  }

  if (generalUpdates.profileId) {
    const nextProfileId = generalUpdates.profileId.toString();
    if (!isValidId(nextProfileId)) {
      return res.status(400).json({ error: 'Invalid profileId' });
    }
    if (
      !hasGlobalManage &&
      accessibleProfiles !== null &&
      !setHas(accessibleProfiles, nextProfileId)
    ) {
      return res.status(403).json({ error: 'Profile is not accessible for this account' });
    }
    if (!hasGlobalManage && !setHas(manageProfiles, nextProfileId)) {
      return res
        .status(403)
        .json({ error: 'Editing applications is not permitted for that profile' });
    }
  }

  if (Object.prototype.hasOwnProperty.call(generalUpdates, 'bidderId')) {
    const canAssignOtherBidders = hasGlobalManage;
    if (!canAssignOtherBidders) {
      generalUpdates.bidderId = req.user.id;
    } else if (generalUpdates.bidderId) {
      if (!isValidId(generalUpdates.bidderId)) {
        return res.status(400).json({ error: 'Invalid bidderId' });
      }
    } else {
      generalUpdates.bidderId = req.user.id;
    }
  }

  if (Object.prototype.hasOwnProperty.call(generalUpdates, 'resumeId')) {
    generalUpdates.resumeId = ensureNullIfEmpty(generalUpdates.resumeId);
    if (generalUpdates.resumeId && !isValidId(generalUpdates.resumeId)) {
      return res.status(400).json({ error: 'Invalid resumeId' });
    }
  }

  let checkUpdates = null;
  if (hasCheckUpdates) {
    if (!hasCheckStatusUpdate) {
      return res.status(400).json({ error: 'checkStatus is required when updating checks' });
    }
    const nextStatus = (req.body.checkStatus || '').toString();
    if (!APPLICATION_CHECK_STATUS_LIST.includes(nextStatus)) {
      return res.status(400).json({ error: 'Invalid check status' });
    }

    const targetProfileId =
      generalUpdates.profileId?.toString() || currentProfileId;
    if (!canCheckApplication(req, app, perms, targetProfileId, checkableProfiles)) {
      return res.status(403).json({ error: 'Checking this application is not permitted' });
    }

    const currentStatus = app.checkStatus;
    const currentCheckerId =
      typeof app.checkedById === 'string' ? app.checkedById : app.checkedBy?.id;

    checkUpdates = {};

    if (currentStatus === APPLICATION_CHECK_STATUS.REVIEWED) {
      if (nextStatus !== APPLICATION_CHECK_STATUS.REVIEWED) {
        return res.status(400).json({ error: 'Reviewed applications cannot be re-checked' });
      }
      return res.status(400).json({ error: 'Application is already reviewed' });
    }

    if (nextStatus === APPLICATION_CHECK_STATUS.IN_REVIEW) {
      if (
        currentStatus === APPLICATION_CHECK_STATUS.IN_REVIEW &&
        currentCheckerId &&
        currentCheckerId !== req.user.id &&
        !hasGlobalManage
      ) {
        return res.status(403).json({ error: 'Another checker is already reviewing this application' });
      }
      checkUpdates.checkStatus = APPLICATION_CHECK_STATUS.IN_REVIEW;
      checkUpdates.checkedById = req.user.id;
      checkUpdates.checkedAt = null;
      checkUpdates.checkResult = APPLICATION_CHECK_RESULT.PENDING;
      if (hasCheckNoteUpdate) {
        const draftNote = (req.body.checkNote ?? '').toString().trim();
        checkUpdates.checkNote = draftNote;
      } else {
        checkUpdates.checkNote = '';
      }
    } else if (nextStatus === APPLICATION_CHECK_STATUS.REVIEWED) {
      if (currentStatus !== APPLICATION_CHECK_STATUS.IN_REVIEW) {
        return res.status(400).json({ error: 'Application must be in review before completion' });
      }
      if (
        currentCheckerId &&
        currentCheckerId !== req.user.id &&
        !hasGlobalManage
      ) {
        return res.status(403).json({ error: 'Another checker is assigned to this review' });
      }
      if (!hasCheckResultUpdate) {
        return res.status(400).json({ error: 'checkResult is required when completing a review' });
      }
      const nextResult = (req.body.checkResult || '').toString();
      if (
        !APPLICATION_CHECK_RESULT_LIST.includes(nextResult) ||
        nextResult === APPLICATION_CHECK_RESULT.PENDING
      ) {
        return res.status(400).json({ error: 'Invalid check result' });
      }
      const nextNote = (req.body.checkNote ?? '').toString().trim();
      if (nextResult !== APPLICATION_CHECK_RESULT.OK && !nextNote) {
        return res.status(400).json({ error: 'Check note is required when completing a review' });
      }
      checkUpdates.checkStatus = APPLICATION_CHECK_STATUS.REVIEWED;
      checkUpdates.checkedById = currentCheckerId || req.user.id;
      checkUpdates.checkedAt = new Date();
      checkUpdates.checkResult = nextResult;
      checkUpdates.checkNote = nextNote;
    } else if (nextStatus === APPLICATION_CHECK_STATUS.PENDING) {
      if (
        currentStatus === APPLICATION_CHECK_STATUS.IN_REVIEW &&
        currentCheckerId &&
        currentCheckerId !== req.user.id &&
        !hasGlobalManage
      ) {
        return res.status(403).json({ error: 'Another checker is assigned to this review' });
      }
      checkUpdates.checkStatus = APPLICATION_CHECK_STATUS.PENDING;
      checkUpdates.checkedById = null;
      checkUpdates.checkedAt = null;
      checkUpdates.checkResult = APPLICATION_CHECK_RESULT.PENDING;
      const resetNote = hasCheckNoteUpdate ? (req.body.checkNote ?? '').toString().trim() : '';
      checkUpdates.checkNote = resetNote;
    }

    if (!Object.keys(checkUpdates).length) {
      return res.status(400).json({ error: 'No valid check updates supplied' });
    }
  }

  const dataToUpdate = {};
  GENERAL_EDIT_FIELDS.forEach(key => {
    if (Object.prototype.hasOwnProperty.call(generalUpdates, key)) {
      if (key === 'resumeId') {
        dataToUpdate.resumeId =
          generalUpdates.resumeId === undefined ? undefined : generalUpdates.resumeId || null;
      } else if (key === 'bidderId') {
        dataToUpdate.bidderId = generalUpdates.bidderId || null;
      } else {
        dataToUpdate[key] = generalUpdates[key];
      }
    }
  });

  if (checkUpdates) {
    Object.assign(dataToUpdate, checkUpdates);
  }

  const updated = await prisma.application.update({
    where: { id: req.params.id },
    data: dataToUpdate,
    include: baseApplicationInclude
  });

  res.json(mapApplicationRecord(updated));
};

export const getOne = async (req, res) => {
  const perms = applicationPermissionsFor(req);
  const accessibleProfiles = buildAccessibleProfileSet(req, perms);
  const app = await prisma.application.findUnique({
    where: { id: req.params.id },
    include: baseApplicationInclude
  });
  if (!app) return res.status(404).json({ error: 'Application not found' });

  if (!canViewApplication(req, app, perms, accessibleProfiles)) {
    return res.status(403).json({ error: 'Not permitted' });
  }

  res.json(mapApplicationRecord(app));
};
