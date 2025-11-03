import { prisma } from '../config/db.js';
import { isValidId } from '../utils/id.js';

const mapMeeting = meeting => ({
  _id: meeting.id,
  id: meeting.id,
  title: meeting.title || '',
  applicationId: meeting.application
    ? {
        _id: meeting.application.id,
        id: meeting.application.id,
        company: meeting.application.company,
        roleTitle: meeting.application.roleTitle
      }
    : meeting.applicationId,
  profileId: meeting.profile
    ? {
        _id: meeting.profile.id,
        id: meeting.profile.id,
        alias: meeting.profile.alias,
        personName: `${meeting.profile.firstName || ''} ${meeting.profile.lastName || ''}`.trim()
      }
    : meeting.profileId,
  scheduledAt: meeting.scheduledAt,
  timezone: meeting.timezone,
  attendees: Array.isArray(meeting.attendees) ? meeting.attendees : [],
  reminders: Array.isArray(meeting.reminders) ? meeting.reminders : [],
  createdAt: meeting.createdAt,
  updatedAt: meeting.updatedAt
});

const includeRelations = {
  application: { select: { id: true, company: true, roleTitle: true } },
  profile: { select: { id: true, alias: true, firstName: true, lastName: true } }
};

export const schedule = async (req, res) => {
  const payload = req.body || {};
  if (!payload.applicationId || !isValidId(payload.applicationId)) {
    return res.status(400).json({ error: 'Valid applicationId is required' });
  }
  const scheduledAt = payload.scheduledAt ? new Date(payload.scheduledAt) : null;
  if (!scheduledAt || Number.isNaN(scheduledAt.getTime())) {
    return res.status(400).json({ error: 'Valid scheduledAt is required' });
  }

  try {
    const meeting = await prisma.meeting.create({
      data: {
        applicationId: payload.applicationId,
        profileId: payload.profileId && isValidId(payload.profileId) ? payload.profileId : null,
        title: payload.title || '',
        scheduledAt,
        timezone: payload.timezone || 'UTC',
        attendees: Array.isArray(payload.attendees) ? payload.attendees : [],
        reminders: Array.isArray(payload.reminders) ? payload.reminders : []
      },
      include: includeRelations
    });
    res.status(201).json(mapMeeting(meeting));
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

  const items = await prisma.meeting.findMany({
    where,
    include: includeRelations,
    orderBy: { scheduledAt: 'asc' }
  });
  res.json(items.map(mapMeeting));
};
