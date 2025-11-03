import { prisma } from '../config/db.js';
import { isValidId } from '../utils/id.js';

const mapInterview = interview => ({
  _id: interview.id,
  id: interview.id,
  applicationId: interview.application
    ? {
        _id: interview.application.id,
        id: interview.application.id,
        company: interview.application.company,
        roleTitle: interview.application.roleTitle
      }
    : interview.applicationId,
  stepName: interview.stepName,
  scheduledAt: interview.scheduledAt,
  timezone: interview.timezone,
  meetingLink: interview.meetingLink || '',
  participants: Array.isArray(interview.participants) ? interview.participants : [],
  callerId: interview.caller
    ? { _id: interview.caller.id, id: interview.caller.id, name: interview.caller.name }
    : interview.callerId,
  supporterId: interview.supporter
    ? { _id: interview.supporter.id, id: interview.supporter.id, name: interview.supporter.name }
    : interview.supporterId,
  outcome: interview.outcome,
  notes: interview.notes || '',
  createdAt: interview.createdAt,
  updatedAt: interview.updatedAt
});

const includeRelations = {
  application: { select: { id: true, company: true, roleTitle: true } },
  caller: { select: { id: true, name: true } },
  supporter: { select: { id: true, name: true } }
};

export const schedule = async (req, res) => {
  const payload = req.body || {};
  if (!payload.applicationId || !isValidId(payload.applicationId)) {
    return res.status(400).json({ error: 'Valid applicationId is required' });
  }
  if (!payload.stepName) {
    return res.status(400).json({ error: 'stepName is required' });
  }

  const scheduledAt = payload.scheduledAt ? new Date(payload.scheduledAt) : new Date();
  if (Number.isNaN(scheduledAt.getTime())) {
    return res.status(400).json({ error: 'Invalid scheduledAt' });
  }

  try {
    const interview = await prisma.interview.create({
      data: {
        applicationId: payload.applicationId,
        stepName: payload.stepName,
        scheduledAt,
        timezone: payload.timezone || 'UTC',
        meetingLink: payload.meetingLink || '',
        participants: Array.isArray(payload.participants) ? payload.participants : [],
        callerId: payload.callerId && isValidId(payload.callerId) ? payload.callerId : null,
        supporterId: payload.supporterId && isValidId(payload.supporterId) ? payload.supporterId : null,
        outcome: payload.outcome || 'pending',
        notes: payload.notes || ''
      },
      include: includeRelations
    });
    res.status(201).json(mapInterview(interview));
  } catch (error) {
    if (error?.code === 'P2003') {
      return res.status(400).json({ error: 'Related record not found' });
    }
    throw error;
  }
};

export const list = async (req, res) => {
  const { from, to } = req.query || {};
  const where = {};
  if (from || to) {
    where.scheduledAt = {};
    if (from) {
      const fromDate = new Date(from);
      if (!Number.isNaN(fromDate.getTime())) {
        where.scheduledAt.gte = fromDate;
      }
    }
    if (to) {
      const toDate = new Date(to);
      if (!Number.isNaN(toDate.getTime())) {
        where.scheduledAt.lte = toDate;
      }
    }
    if (!Object.keys(where.scheduledAt).length) {
      delete where.scheduledAt;
    }
  }

  const items = await prisma.interview.findMany({
    where,
    include: includeRelations,
    orderBy: { scheduledAt: 'asc' }
  });
  res.json(items.map(mapInterview));
};
