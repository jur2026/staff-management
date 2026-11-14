import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { fail, first, parseJson, requireMe, scopeIds } from '../server/core';

export default createEndpoint({
  description: 'Lijst van medewerkers binnen de bevoegdheid van de gebruiker',
  authenticated: true,
  inputSchema: z.object({ directory: z.boolean().optional() }),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const me = await requireMe(context);
    const [{ records: members }, { records: roles }, { records: depts }] = await Promise.all([
      zite.members.findAll({ limit: 2000, sort: [{ field: 'fullName', direction: 'asc' }] }),
      zite.roles.findAll({ limit: 200 }),
      zite.departments.findAll({ limit: 500 }),
    ]);
    const roleMap = new Map(roles.map((r) => [r.id, r]));
    const deptMap = new Map(depts.map((d) => [d.id, d.name || '']));
    const base = (m: (typeof members)[0]) => ({
      id: m.id,
      fullName: m.fullName || '',
      jobTitle: m.jobTitle || '',
      avatar: m.avatar || '',
      departmentId: first(m.department) || '',
      department: deptMap.get(first(m.department) || '') || '',
      roleName: roleMap.get(first(m.role) || '')?.name || '',
    });
    if (input.directory) {
      return { members: members.filter((m) => m.status === 'Actief').map((m) => ({ ...base(m), email: m.email || '', phone: m.phone || '' })) };
    }
    if (!me.perms.has('members.view') && !me.perms.has('users.manage')) throw fail('FORBIDDEN', 'Geen toegang tot het medewerkersoverzicht.');
    const scope = await scopeIds(me);
    return {
      members: members
        .filter((m) => !scope || scope.includes(m.id))
        .map((m) => ({
          ...base(m),
          email: m.email || '',
          username: m.username || '',
          phone: m.phone || '',
          roleId: first(m.role) || '',
          rank: roleMap.get(first(m.role) || '')?.rank ?? 0,
          status: m.status || '',
          employmentStatus: m.employmentStatus || '',
          activated: !!first(m.user),
          lastActive: m.lastActive || '',
          startDate: m.startDate || '',
          createdOn: m.createdOn || '',
          overrides: parseJson<{ grant?: string[]; deny?: string[] }>(m.permissionOverrides, {}),
        })),
    };
  },
});
