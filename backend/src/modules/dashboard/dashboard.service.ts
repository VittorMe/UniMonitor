import { prisma } from '../../infra/database/prisma.js';
import { currentAcademicPeriod } from '../../shared/academic-period.js';
import { academicAccess } from '../academic/academic-access.js';

const monthStart = () => new Date(new Date().getFullYear(), new Date().getMonth(), 1);

export const dashboardService = {
  async admin() {
    const [
      professors,
      students,
      subjects,
      monitors,
      sessionsCreated,
      sessionsCompleted,
      attended,
      confirmed,
      averageRating,
      cancelled,
      bySubject,
    ] = await Promise.all([
      prisma.professor.count(),
      prisma.student.count(),
      prisma.subject.count(),
      prisma.monitor.count({ where: { isActive: true } }),
      prisma.monitoringSession.count(),
      prisma.monitoringSession.count({ where: { status: 'COMPLETED' } }),
      prisma.sessionParticipant.count({ where: { status: 'ATTENDED' } }),
      prisma.sessionParticipant.count({ where: { status: { in: ['ATTENDED', 'ABSENT', 'CONFIRMED'] } } }),
      prisma.review.aggregate({
        _avg: { rating: true, clarity: true, punctuality: true, mastery: true },
      }),
      prisma.monitoringSession.count({ where: { status: 'CANCELLED' } }),
      prisma.monitoringSession.groupBy({
        by: ['subjectMonitorId'],
        _count: { id: true },
        where: { status: 'COMPLETED' },
      }),
    ]);

    const subjectIds = await prisma.subjectMonitor.findMany({
      where: { id: { in: bySubject.map((item) => item.subjectMonitorId) } },
      include: { subject: true },
    });

    const counts = new Map<string, { name: string; count: number }>();
    for (const row of bySubject) {
      const link = subjectIds.find((item) => item.id === row.subjectMonitorId);
      if (!link) continue;
      const current = counts.get(link.subjectId) ?? { name: link.subject.name, count: 0 };
      current.count += row._count.id;
      counts.set(link.subjectId, current);
    }

    return {
      professors,
      students,
      subjects,
      monitors,
      sessionsCreated,
      sessionsCompleted,
      attendanceRate: confirmed === 0 ? 0 : Math.round((attended / confirmed) * 100),
      averageRating: averageRating._avg.rating,
      averageClarity: averageRating._avg.clarity,
      averagePunctuality: averageRating._avg.punctuality,
      averageMastery: averageRating._avg.mastery,
      cancelled,
      sessionsThisMonth: await prisma.monitoringSession.count({
        where: { startAt: { gte: monthStart() }, status: { not: 'CANCELLED' } },
      }),
      bySubject: [...counts.values()].sort((a, b) => b.count - a.count).slice(0, 8),
    };
  },

  async professor(userId: string, subjectId: string) {
    const period = currentAcademicPeriod();
    const professor = await academicAccess.requireProfessor(userId);
    await academicAccess.requireProfessorOwnsSubject(professor.id, subjectId, period);

    const where = {
      subjectMonitor: { subjectId, professorId: professor.id, year: period.year, semester: period.semester },
    };

    const [monitors, sessionsThisMonth, attended, reviews, topics] = await Promise.all([
      prisma.subjectMonitor.count({
        where: { subjectId, professorId: professor.id, year: period.year, semester: period.semester, isActive: true },
      }),
      prisma.monitoringSession.count({
        where: { ...where, startAt: { gte: monthStart() }, status: { not: 'CANCELLED' } },
      }),
      prisma.sessionParticipant.count({
        where: { status: 'ATTENDED', session: where },
      }),
      prisma.review.aggregate({
        _avg: { rating: true, clarity: true, punctuality: true, mastery: true },
        where: { session: where },
      }),
      prisma.monitoringSession.groupBy({
        by: ['topic'],
        _count: { id: true },
        where: { ...where, topic: { not: null } },
      }),
    ]);

    const totalTopics = topics.reduce((sum, item) => sum + item._count.id, 0) || 1;

    return {
      monitors,
      sessionsThisMonth,
      studentsAttended: attended,
      averageRating: reviews._avg.rating,
      averageClarity: reviews._avg.clarity,
      averagePunctuality: reviews._avg.punctuality,
      averageMastery: reviews._avg.mastery,
      topics: topics
        .map((item) => ({
          topic: item.topic ?? 'Outros',
          percent: Math.round((item._count.id / totalTopics) * 100),
        }))
        .sort((a, b) => b.percent - a.percent)
        .slice(0, 6),
    };
  },

  async monitor(userId: string) {
    const monitor = await academicAccess.requireMonitor(userId);
    const [completed, attended, reviews, occupancy] = await Promise.all([
      prisma.monitoringSession.count({
        where: { subjectMonitor: { monitorId: monitor.id }, status: 'COMPLETED' },
      }),
      prisma.sessionParticipant.count({
        where: { status: 'ATTENDED', session: { subjectMonitor: { monitorId: monitor.id } } },
      }),
      prisma.review.aggregate({
        _avg: { rating: true, clarity: true, punctuality: true, mastery: true },
        _count: true,
        where: { monitorId: monitor.id },
      }),
      prisma.sessionParticipant.groupBy({
        by: ['status'],
        _count: { status: true },
        where: { session: { subjectMonitor: { monitorId: monitor.id }, status: 'COMPLETED' } },
      }),
    ]);

    const attendedCount = occupancy.find((item) => item.status === 'ATTENDED')?._count.status ?? 0;
    const absentCount = occupancy.find((item) => item.status === 'ABSENT')?._count.status ?? 0;
    const denom = attendedCount + absentCount;

    return {
      sessionsCompleted: completed,
      studentsAttended: attended,
      averageRating: reviews._avg.rating,
      averageClarity: reviews._avg.clarity,
      averagePunctuality: reviews._avg.punctuality,
      averageMastery: reviews._avg.mastery,
      reviewsCount: reviews._count,
      attendanceRate: denom === 0 ? 0 : Math.round((attendedCount / denom) * 100),
    };
  },
};
