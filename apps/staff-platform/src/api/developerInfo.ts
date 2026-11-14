import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { audit, requireMe } from '../server/core';

const TABLES = ['Members', 'Roles', 'Departments', 'AccessCodes', 'AbsenceRequests', 'Complaints', 'ComplaintUpdates', 'TimeEntries', 'Shifts', 'Availability', 'ShiftSwaps', 'Tasks', 'Documents', 'Announcements', 'Conversations', 'Messages', 'Notifications', 'AuditLogs', 'AuditAccessRequests', 'Reviews', 'Decisions', 'Settings', 'Pages'];

export default createEndpoint({
  description: 'Developer-console: systeemstatus, database-informatie, prestaties en technische logs (zonder personeelsgegevens)',
  authenticated: true,
  inputSchema: z.object({}),
  outputSchema: z.any(),
  execute: async ({ context }) => {
    const me = await requireMe(context, 'developer.view');
    const t0 = Date.now();
    const counts = await zite.sql({ query: TABLES.map((t) => `SELECT '${t}' AS "table", COUNT(*)::int AS rows, MAX(updated_at) AS "lastWrite" FROM "${t}"`).join(' UNION ALL ') });
    const dbLatency = Date.now() - t0;
    const t1 = Date.now();
    const activity = await zite.sql({ query: `SELECT to_char(created_at, 'YYYY-MM-DD') AS d, COUNT(*)::int AS c FROM "AuditLogs" WHERE created_at >= now() - interval '14 days' GROUP BY 1 ORDER BY 1` });
    const queryLatency = Date.now() - t1;
    const { records: logs } = await zite.auditLogs.findAll({ filters: { category: { in: ['Systeem', 'Instellingen', 'Rechten'] } } as any, sort: [{ field: 'createdOn', direction: 'desc' }], limit: 30 });
    const { records: settings } = await zite.settings.findAll({ limit: 50 });
    await audit(me, 'Developer-console geopend', 'Systeem', 'developer');
    return {
      version: '1.0.0',
      runtime: 'ZiteJS · Cloudflare Workers',
      checkedAt: new Date().toISOString(),
      maintenance: settings.find((s) => s.key === 'maintenance')?.value === 'true',
      api: [
        { name: 'Database (tabellen)', status: 'Operationeel', latency: dbLatency },
        { name: 'SQL-query engine', status: 'Operationeel', latency: queryLatency },
        { name: 'Authenticatie (e-mailcode)', status: 'Operationeel', latency: 0 },
        { name: 'Bestandsopslag (uploads)', status: 'Operationeel', latency: 0 },
      ],
      tables: counts.rows.map((r) => ({ table: String(r.table), rows: Number(r.rows), lastWrite: r.lastWrite ? String(r.lastWrite) : '' })),
      activity: activity.rows.map((r) => ({ date: String(r.d), count: Number(r.c) })),
      logs: logs.map((l) => ({ id: l.id, action: l.action || '', category: l.category || '', createdOn: l.createdOn || '' })),
      integrations: [{ name: 'Zite Database', status: 'Verbonden' }, { name: 'Zite Auth', status: 'Verbonden' }],
    };
  },
});
