import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { first, parseJson, requireMe } from '../server/core';

export default createEndpoint({
  description: 'Rollen en afdelingen met aantallen',
  authenticated: true,
  inputSchema: z.object({}),
  outputSchema: z.any(),
  execute: async ({ context }) => {
    await requireMe(context);
    const [{ records: roles }, { records: depts }, { records: members }] = await Promise.all([
      zite.roles.findAll({ limit: 200, sort: [{ field: 'rank', direction: 'desc' }] }),
      zite.departments.findAll({ limit: 500, sort: [{ field: 'name', direction: 'asc' }] }),
      zite.members.findAll({ limit: 2000, fields: ['id', 'role', 'department', 'status'] as any }),
    ]);
    const count = (key: 'role' | 'department', id: string) => members.filter((m) => first(m[key]) === id && m.status !== 'Gearchiveerd').length;
    return {
      roles: roles.map((r) => ({ id: r.id, name: r.name || '', rank: r.rank ?? 0, description: r.description || '', isSystem: !!r.isSystem, permissions: parseJson<string[]>(r.permissions, []), members: count('role', r.id) })),
      departments: depts.map((d) => ({ id: d.id, name: d.name || '', description: d.description || '', members: count('department', d.id) })),
    };
  },
});
