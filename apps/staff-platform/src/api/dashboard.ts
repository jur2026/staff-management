import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireMe } from '../server/core';

export default createEndpoint({
  description: 'Persoonlijk medewerkersdashboard',
  authenticated: true,
  inputSchema: z.object({}),
  outputSchema: z.any(),
  execute: async ({ context }) => {
    const me = await requireMe(context);
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    const ws = weekStart.toISOString().slice(0, 10);
    const [shifts, tasks, absences, time, anns] = await Promise.all([
      zite.shifts.findAll({ filters: { member: me.id, published: true, end: { gte: now.toISOString() } } as any, sort: [{ field: 'start', direction: 'asc' }], limit: 5 }),
      zite.tasks.findAll({ filters: { assignee: me.id, status: { not: 'Afgerond' } } as any, sort: [{ field: 'dueDate', direction: 'asc' }], limit: 8 }),
      zite.absenceRequests.findAll({ filters: { member: me.id, status: { in: ['Nieuw', 'In behandeling', 'Aanvullende informatie nodig'] } } as any, limit: 10 }),
      zite.timeEntries.findAll({ filters: { member: me.id, workDate: { gte: ws } } as any, limit: 200 }),
      zite.announcements.findAll({ sort: [{ field: 'createdOn', direction: 'desc' }], limit: 3 }),
    ]);
    const weekHours = time.records.reduce((s, t) => (t.start && t.end ? s + (new Date(t.end).getTime() - new Date(t.start).getTime()) / 3600000 - (t.breakMinutes || 0) / 60 : s), 0);
    const running = time.records.find((t) => t.status === 'Lopend');
    return {
      weekHours: Math.round(weekHours * 10) / 10,
      running: running ? { start: running.start || '', onBreak: !!running.breakStartedAt } : null,
      shifts: shifts.records.map((s) => ({ id: s.id, title: s.title || '', start: s.start || '', end: s.end || '' })),
      tasks: tasks.records.map((t) => ({ id: t.id, title: t.title || '', dueDate: t.dueDate || '', priority: t.priority || '', status: t.status || '' })),
      pendingAbsences: absences.records.length,
      announcements: anns.records.map((a) => ({ id: a.id, title: a.title || '', body: a.body || '', author: a.author || '', createdOn: a.createdOn || '' })),
    };
  },
});
