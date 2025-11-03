import fs from 'fs';
import path from 'path';
import { prisma } from '../config/db.js';
import { PROFILE_ACCESS, ROLES } from '../config/auth.js';
import { generateResumePdf } from '../services/resumePdf.js';
import { generateResumeDocx } from '../services/resumeDocx.js';
import { isValidId } from '../utils/id.js';

const profileAccessFor = req => {
  if (req.user?.role === ROLES.ADMIN) {
    return PROFILE_ACCESS.EDIT;
  }
  return req.user?.permissions?.profiles || PROFILE_ACCESS.VIEW;
};

const toRelativePath = filePath => path.relative(process.cwd(), filePath).replace(/\\/g, '/');

const cleanupUploadedFile = async file => {
  if (!file) return;
  try {
    await fs.promises.unlink(file.path);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('Failed to clean up uploaded file', error);
    }
  }
};

const removeFileIfExists = async relativePath => {
  if (!relativePath) return;
  const absolutePath = path.resolve(process.cwd(), relativePath);
  try {
    await fs.promises.unlink(absolutePath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('Failed to remove resume file', error);
    }
  }
};

const parseContent = value => {
  if (!value) return undefined;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return typeof parsed === 'object' && parsed !== null ? parsed : undefined;
    } catch {
      return undefined;
    }
  }
  if (typeof value === 'object') {
    return value;
  }
  return undefined;
};

const resumeHasStructuredContent = resume => {
  const content = resume?.content;
  if (!content || typeof content !== 'object') return false;
  const { summary, skills, experience, education, extras, headline } = content;
  if (summary || extras || headline) return true;
  if (Array.isArray(skills) && skills.length) return true;
  if (Array.isArray(experience) && experience.length) return true;
  if (Array.isArray(education) && education.length) return true;
  return false;
};

const sanitizeResumePayload = body => {
  const payload = {};
  if (typeof body.title === 'string') payload.title = body.title.trim();
  if (typeof body.stack === 'string') payload.stack = body.stack.trim();
  if (typeof body.version === 'string') payload.version = body.version.trim();
  if (typeof body.note === 'string') payload.note = body.note.trim();
  const content = parseContent(body.content);
  if (content) payload.content = content;
  return payload;
};

const applyUploadedFile = file => {
  if (!file) return null;
  return {
    storage: toRelativePath(file.path),
    storageOriginalName: file.originalname,
    storageMimeType: file.mimetype,
    docxStorage: ''
  };
};

const includeResumeRelations = {
  createdByUser: {
    select: { id: true, name: true, email: true }
  },
  profile: {
    select: { id: true, alias: true, firstName: true, lastName: true, contact: true }
  }
};

const mapResume = resume => {
  if (!resume) return null;
  return {
    _id: resume.id,
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
          _id: resume.createdByUser.id,
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

const fetchResumeWithRelations = async id =>
  prisma.resume.findUnique({
    where: { id },
    include: includeResumeRelations
  });

const buildProfileForDocs = profile => {
  if (!profile) return null;
  const fullName = `${profile.firstName || ''} ${profile.lastName || ''}`.trim();
  return {
    ...profile,
    _id: profile.id,
    id: profile.id,
    fullName
  };
};

const buildResumeForDocs = resume => ({
  ...resume,
  _id: resume.id,
  id: resume.id
});

const regenerateDocuments = async resumeId => {
  const resume = await prisma.resume.findUnique({
    where: { id: resumeId },
    include: {
      profile: {
        select: { id: true, alias: true, firstName: true, lastName: true, contact: true }
      }
    }
  });
  if (!resume || !resume.profile) {
    return resume;
  }

  const resumeForDocs = buildResumeForDocs(resume);
  const profileForDocs = buildProfileForDocs(resume.profile);

  const { relativePath: pdfPath } = await generateResumePdf(resumeForDocs, profileForDocs);
  const { relativePath: docxPath } = await generateResumeDocx(resumeForDocs, profileForDocs);

  return prisma.resume.update({
    where: { id: resumeId },
    data: {
      storage: pdfPath,
      docxStorage: docxPath
    },
    include: includeResumeRelations
  });
};

export const list = async (req, res) => {
  const access = profileAccessFor(req);
  if (access === PROFILE_ACCESS.NONE) {
    return res.status(403).json({ error: 'No profile access' });
  }
  const { profileId } = req.query || {};
  const where = {};
  if (profileId) {
    where.profileId = profileId;
  }
  const items = await prisma.resume.findMany({
    where,
    include: includeResumeRelations,
    orderBy: { updatedAt: 'desc' }
  });
  res.json(items.map(mapResume));
};

export const create = async (req, res) => {
  const access = profileAccessFor(req);
  if (access !== PROFILE_ACCESS.EDIT) {
    await cleanupUploadedFile(req.file);
    return res.status(403).json({ error: 'Profile editing not permitted' });
  }

  const payload = sanitizeResumePayload(req.body);
  const profileId = (req.body.profileId || '').trim();
  if (!profileId || !isValidId(profileId)) {
    await cleanupUploadedFile(req.file);
    return res.status(400).json({ error: 'Valid profileId is required.' });
  }

  try {
    const resume = await prisma.resume.create({
      data: {
        profileId,
        title: payload.title || '',
        stack: payload.stack || '',
        version: payload.version || 'v1',
        note: payload.note || '',
        content: payload.content || {},
        createdById: req.user.id
      },
      include: includeResumeRelations
    });

    let updatedResume = resume;

    if (req.file) {
      const fileInfo = applyUploadedFile(req.file);
      updatedResume = await prisma.resume.update({
        where: { id: resume.id },
        data: fileInfo,
        include: includeResumeRelations
      });
    } else if (resumeHasStructuredContent(resume)) {
      updatedResume = await regenerateDocuments(resume.id);
    }

    res.status(201).json(mapResume(updatedResume));
  } catch (error) {
    await cleanupUploadedFile(req.file);
    if (error?.code === 'P2003') {
      return res.status(400).json({ error: 'Related profile not found' });
    }
    throw error;
  }
};

export const update = async (req, res) => {
  const access = profileAccessFor(req);
  if (access !== PROFILE_ACCESS.EDIT) {
    await cleanupUploadedFile(req.file);
    return res.status(403).json({ error: 'Profile editing not permitted' });
  }

  const existing = await fetchResumeWithRelations(req.params.id);
  if (!existing) {
    await cleanupUploadedFile(req.file);
    return res.status(404).json({ error: 'Resume not found' });
  }

  const payload = sanitizeResumePayload(req.body);
  const dataToUpdate = { ...payload };

  let updatedResume = existing;

  if (req.file) {
    await removeFileIfExists(existing.storage);
    await removeFileIfExists(existing.docxStorage);
    const fileInfo = applyUploadedFile(req.file);
    Object.assign(dataToUpdate, fileInfo);
  }

  if (Object.keys(dataToUpdate).length) {
    updatedResume = await prisma.resume.update({
      where: { id: req.params.id },
      data: dataToUpdate,
      include: includeResumeRelations
    });
  }

  if (
    !req.file &&
    (payload.content || (!updatedResume.storage && resumeHasStructuredContent(updatedResume)))
  ) {
    updatedResume = await regenerateDocuments(req.params.id);
  }

  res.json(mapResume(updatedResume));
};

export const remove = async (req, res) => {
  const access = profileAccessFor(req);
  if (access !== PROFILE_ACCESS.EDIT) {
    return res.status(403).json({ error: 'Profile editing not permitted' });
  }

  const existing = await fetchResumeWithRelations(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Resume not found' });
  }

  await removeFileIfExists(existing.storage);
  await removeFileIfExists(existing.docxStorage);
  await prisma.resume.delete({ where: { id: req.params.id } });

  res.json({ ok: true });
};

export const download = async (req, res) => {
  const access = profileAccessFor(req);
  if (access === PROFILE_ACCESS.NONE) {
    return res.status(403).json({ error: 'No profile access' });
  }

  let resume = await prisma.resume.findUnique({
    where: { id: req.params.id },
    include: includeResumeRelations
  });
  if (!resume) {
    return res.status(404).json({ error: 'Resume not found' });
  }

  if (!resume.storage && resumeHasStructuredContent(resume)) {
    resume = await regenerateDocuments(resume.id);
  }

  let absolutePath = resume.storage ? path.resolve(process.cwd(), resume.storage) : '';
  if (!absolutePath || !resume.storage || !fs.existsSync(absolutePath)) {
    if (resumeHasStructuredContent(resume)) {
      resume = await regenerateDocuments(resume.id);
      absolutePath = resume.storage ? path.resolve(process.cwd(), resume.storage) : '';
    }
  }

  if (!absolutePath || !resume.storage || !fs.existsSync(absolutePath)) {
    return res.status(404).json({ error: 'Resume PDF not available' });
  }

  const profile = resume.profile ? buildProfileForDocs(resume.profile) : null;
  const filename =
    resume.storageOriginalName || `${profile?.fullName || resume.title || 'resume'}.pdf`;

  res.download(absolutePath, filename, err => {
    if (err) {
      res.status(err.statusCode || 500).end();
    }
  });
};

export const downloadDocx = async (req, res) => {
  const access = profileAccessFor(req);
  if (access === PROFILE_ACCESS.NONE) {
    return res.status(403).json({ error: 'No profile access' });
  }

  let resume = await prisma.resume.findUnique({
    where: { id: req.params.id },
    include: includeResumeRelations
  });
  if (!resume) return res.status(404).json({ error: 'Resume not found' });

  if (!resume.docxStorage && resumeHasStructuredContent(resume)) {
    resume = await regenerateDocuments(resume.id);
  }

  const absolutePath = resume.docxStorage
    ? path.resolve(process.cwd(), resume.docxStorage)
    : '';
  if (!absolutePath || !resume.docxStorage || !fs.existsSync(absolutePath)) {
    return res.status(404).json({ error: 'Resume Word document not available' });
  }

  const profile = resume.profile ? buildProfileForDocs(resume.profile) : null;
  const filename = `${profile?.fullName || resume.title || 'resume'}.docx`;

  res.download(absolutePath, filename, err => {
    if (err) {
      res.status(err.statusCode || 500).end();
    }
  });
};
