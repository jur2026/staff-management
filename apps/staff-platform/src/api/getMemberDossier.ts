import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { assertInScope, fail, first, requireMe } from '../server/core';

export default createEndpoint({
  description: 'Personeelsdossier van een medewerker',
  authenticated: true,
  inputSchema: z.object({ id: z.string() }),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const me = await requireMe(context);
    if (!me.perms.has('members.view') && !me.perms.has('users.manage')) throw fail('FORBIDDEN', 'Geen toegang tot dossiers.');
    await assertInScope(me, input.id);
    const m = await zite.members.findOne({ id: input.id });
    if (!m) throw fail('NOT_FOUND', 'Medewerker niet gevonden.');
    const [abs, time, shifts, reviews, logs, tasks] = await Promise.all([
      zite.absenceRequests.findAll({ filters: { member: m.id }, sort: [{ field: 'startDate', direction: 'desc' }], limit: 50 }),
      zite.timeEntries.findAll({ filters: { member: m.id }, sort: [{ field: 'workDate', direction: 'desc' }], limit: 60 }),
      zite.shifts.findAll({ filters: { member: m.id, start: { gte: new Date().toISOString() } }, sort: [{ field: 'start', direction: 'asc' }], limit: 20 }),
      me.perms.has('reviews.manage') ? zite.reviews.findAll({ filters: { member: m.id }, sort: [{ field: 'date', direction: 'desc' }], limit: 100 }) : Promise.resolve({ records: [] as any[] }),
      me.perms.has('audit.view') ? zite.auditLogs.findAll({ filters: { actorId: m.id }, sort: [{ field: 'createdOn', direction: 'desc' }], limit: 40 }) : Promise.resolve({ records: [] as any[] }),
      zite.tasks.findAll({ filters: { assignee: m.id }, sort: [{ field: 'dueDate', direction: 'asc' }], limit: 50 }),
    ]);
    const complaints = me.perms.has('complaints.handle')
      ? (await zite.complaints.findAll({ filters: { submitter: m.id }, limit: 100 })).records.filter((c) => first(c.against) !== me.id)
      : [];
    const hours = time.records.reduce((s, t) => {
      if (!t.start || !t.end) return s;
      return s + Math.max(0, (new Date(t.end).getTime() - new Date(t.start).getTime()) / 3600000 - (t.breakMinutes || 0) / 60);
    }, 0);
    return {
      member: { id: m.id, fullName: m.fullName, email: m.email, phone: m.phone, jobTitle: m.jobTitle, status: m.status, employmentStatus: m.employmentStatus, startDate: m.startDate, lastActive: m.lastActive, avatar: m.avatar, bio: m.bio, activated: !!first(m.user), createdOn: m.createdOn },
      absences: abs.records.map((a) => ({ id: a.id, category: a.category, startDate: a.startDate, endDate: a.endDate, status: a.status })),
      hours: Math.round(hours * 10) / 10,
      time: time.records.slice(0, 15).map((t) => ({ id: t.id, workDate: t.workDate, start: t.start, end: t.end, breakMinutes: t.breakMinutes, status: t.status, activity: t.activity })),
      shifts: shifts.records.map((s) => ({ id: s.id, title: s.title, start: s.start, end: s.end })),
      reviews: reviews.records.map((r: any) => ({ id: r.id, title: r.title, type: r.type, date: r.date, notes: r.notes, author: r.author, confidential: r.confidential })),
      activity: logs.records.map((l: any) => ({ id: l.id, action: l.action, category: l.category, createdOn: l.createdOn })),
      complaints: complaints.map((c) => ({ id: c.id, subject: c.subject, status: c.status, number: c.complaintNumber })),
      tasks: tasks.records.map((t) => ({ id: t.id, title: t.title, status: t.status, dueDate: t.dueDate })),
    };
  },
});
