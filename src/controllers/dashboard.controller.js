import { prisma } from '../config/db.js';

export const getStats = async (req, res) => {
  const totalApps = await prisma.application.count();

  const groupedByBidder = await prisma.application.groupBy({
    by: ['bidderId'],
    _count: { _all: true }
  });

  const bidderIds = groupedByBidder.map(item => item.bidderId).filter(Boolean);
  const bidderLookup = bidderIds.length
    ? await prisma.user.findMany({
        where: { id: { in: bidderIds } },
        select: { id: true, name: true }
      })
    : [];
  const bidderMap = new Map(bidderLookup.map(user => [user.id, user]));

  const appsByBidder = groupedByBidder
    .map(item => {
      const user = item.bidderId ? bidderMap.get(item.bidderId) : null;
      return {
        _id: item.bidderId,
        count: item._count._all,
        name: user?.name || (item.bidderId ? 'Unknown' : 'Unassigned')
      };
    })
    .sort((a, b) => b.count - a.count);

  const interviewsUpcoming = await prisma.interview.count({
    where: { scheduledAt: { gte: new Date() } }
  });

  const pipelineGroup = await prisma.application.groupBy({
    by: ['status'],
    _count: { _all: true }
  });
  const pipelineCounts = pipelineGroup.map(item => ({
    _id: item.status,
    count: item._count._all
  }));

  const applicationsForSteps = await prisma.application.findMany({
    select: { steps: true }
  });

  const stepCounts = new Map();
  applicationsForSteps.forEach(app => {
    if (!Array.isArray(app.steps)) return;
    app.steps.forEach(step => {
      const status = step?.status || 'unknown';
      stepCounts.set(status, (stepCounts.get(status) || 0) + 1);
    });
  });
  const stepAgg = Array.from(stepCounts.entries()).map(([status, count]) => ({
    _id: status,
    count
  }));

  res.json({ totalApps, appsByBidder, interviewsUpcoming, pipelineCounts, stepAgg });
};
