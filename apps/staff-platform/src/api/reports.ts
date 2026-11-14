import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireMe } from '../server/core';

const n = (v: unknown) => Number(v ?? 0);

export default createEndpoint({
  description: 'Rapportages en statistieken over personeel, uren, afwezigheid, klachten, roosters en taken',
  authenticated: true,
  inputSchema: z.object({ from: z.string(), to: z.string(), departmentId: z.string().optional() }),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const me = await requireMe(context, 'reports.view');
    const dept = me.perms.has('scope.all') ? input.departmentId || null : me.departmentId || '00000000-0000-0000-0000-000000000000';
    // member ids in scope as a CTE
    const scopeCte = `WITH sm AS (SELECT m.id, m."fullName", m."status" FROM "Members" m ${dept ? `JOIN "DepartmentsMembers" dm ON dm."membersId" = m.id AND dm."departmentsId" = $3::uuid` : ''} WHERE $1::date IS NOT NULL AND $2::date IS NOT NULL)`;
    const p = dept ? [input.from, input.to, dept] : [input.from, input.to];
    // Pass exactly as many params as the highest $N the final query references.
    const q = (sql: string) => {
      const query = `${scopeCte} ${sql}`;
      const max = Math.max(0, ...[...query.matchAll(/\$(\d+)/g)].map((m) => Number(m[1])));
      return zite.sql({ query, params: p.slice(0, max) }).catch((e) => {
        console.error('reports query failed', { error: String(e), query });
        throw e;
      });
    };

    const [members, hours, absence, tasks, shifts, absByCat, hoursByDay, complaints] = await Promise.all([
      q(`SELECT "status", COUNT(*)::int AS c FROM sm WHERE $1::text IS NOT NULL AND $2::text IS NOT NULL GROUP BY "status"`),
      q(`SELECT sm.id, sm."fullName" AS name,
           COALESCE(SUM(EXTRACT(EPOCH FROM (t."end" - t."start"))/3600 - COALESCE(t."breakMinutes",0)/60.0),0) AS hours,
           COUNT(t.id)::int AS entries,
           COUNT(t.id) FILTER (WHERE t."status" = 'Ingediend')::int AS pending
         FROM sm LEFT JOIN "MembersTimeEntries" l ON l."membersId" = sm.id
         LEFT JOIN "TimeEntries" t ON t.id = l."timeEntriesId" AND t."workDate" >= $1::date AND t."workDate" <= $2::date AND t."end" IS NOT NULL
         GROUP BY sm.id, sm."fullName" ORDER BY hours DESC`),
      q(`SELECT a."status", COUNT(*)::int AS c FROM "AbsenceRequests" a JOIN "AbsenceRequestsMembers" l ON l."absenceRequestsId" = a.id JOIN sm ON sm.id = l."membersId"
         WHERE a."startDate" <= $2::date AND a."endDate" >= $1::date GROUP BY a."status"`),
      q(`SELECT t."status", COUNT(*)::int AS c, COUNT(*) FILTER (WHERE t."dueDate" < CURRENT_DATE AND t."status" <> 'Afgerond')::int AS overdue
         FROM "Tasks" t JOIN "MembersTasks" l ON l."tasksId" = t.id JOIN sm ON sm.id = l."membersId" GROUP BY t."status"`),
      zite.sql({ query: `SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM "MembersShifts" l WHERE l."shiftsId" = s.id))::int AS open,
           COUNT(*) FILTER (WHERE s."published")::int AS published FROM "Shifts" s WHERE s."start" >= $1::date AND s."start" < ($2::date + 1)`, params: [input.from, input.to] }),
      q(`SELECT a."category", COUNT(*)::int AS c FROM "AbsenceRequests" a JOIN "AbsenceRequestsMembers" l ON l."absenceRequestsId" = a.id JOIN sm ON sm.id = l."membersId"
         WHERE a."startDate" <= $2::date AND a."endDate" >= $1::date GROUP BY a."category"`),
      q(`SELECT to_char(t."workDate", 'YYYY-MM-DD') AS d, COALESCE(SUM(EXTRACT(EPOCH FROM (t."end" - t."start"))/3600 - COALESCE(t."breakMinutes",0)/60.0),0) AS hours
         FROM "TimeEntries" t JOIN "MembersTimeEntries" l ON l."timeEntriesId" = t.id JOIN sm ON sm.id = l."membersId"
         WHERE t."workDate" >= $1::date AND t."workDate" <= $2::date AND t."end" IS NOT NULL GROUP BY 1 ORDER BY 1`),
      me.perms.has('complaints.handle') || me.perms.has('scope.all')
        ? zite.sql({ query: `SELECT "status", COUNT(*)::int AS c FROM "Complaints" WHERE created_at >= $1::date AND created_at < ($2::date + 1) GROUP BY "status"`, params: [input.from, input.to] })
        : Promise.resolve({ rows: [] as Record<string, unknown>[] }),
    ]);
    const today = new Date().toISOString().slice(0, 10);
    const absentToday = await q(`SELECT COUNT(DISTINCT sm.id)::int AS c FROM "AbsenceRequests" a JOIN "AbsenceRequestsMembers" l ON l."absenceRequestsId" = a.id JOIN sm ON sm.id = l."membersId"
         WHERE a."status" = 'Goedgekeurd' AND a."startDate" <= '${today}'::date AND a."endDate" >= '${today}'::date AND $1::text IS NOT NULL AND $2::text IS NOT NULL`);
    return {
      members: members.rows.map((r) => ({ status: String(r.status ?? 'Onbekend'), count: n(r.c) })),
      absentToday: n(absentToday.rows[0]?.c),
      hoursPerMember: hours.rows.map((r) => ({ id: String(r.id), name: String(r.name ?? ''), hours: Math.round(n(r.hours) * 10) / 10, entries: n(r.entries), pending: n(r.pending) })),
      hoursByDay: hoursByDay.rows.map((r) => ({ date: String(r.d), hours: Math.round(n(r.hours) * 10) / 10 })),
      absence: absence.rows.map((r) => ({ status: String(r.status ?? ''), count: n(r.c) })),
      absenceByCategory: absByCat.rows.map((r) => ({ category: String(r.category ?? ''), count: n(r.c) })),
      tasks: tasks.rows.map((r) => ({ status: String(r.status ?? ''), count: n(r.c), overdue: n(r.overdue) })),
      shifts: { total: n(shifts.rows[0]?.total), open: n(shifts.rows[0]?.open), published: n(shifts.rows[0]?.published) },
      complaints: complaints.rows.map((r) => ({ status: String(r.status ?? ''), count: n(r.c) })),
    };
  },
});
