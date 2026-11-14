import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { PERM_KEYS } from '../lib/permissions';
import { assertCanGrant, audit, fail, first, parseJson, requireMe } from '../server/core';

export default createEndpoint({
  description: 'Maakt, wijzigt of verwijdert rollen en afdelingen',
  authenticated: true,
  inputSchema: z.object({
    kind: z.enum(['role', 'department']),
    action: z.enum(['save', 'delete']),
    id: z.string().optional(),
    name: z.string().min(2).optional(),
    description: z.string().optional(),
    rank: z.number().min(1).max(100).optional(),
    permissions: z.array(z.string()).optional(),
  }),
  outputSchema: z.object({ success: z.boolean() }),
  execute: async ({ input, context }) => {
    if (input.kind === 'role') {
      const me = await requireMe(context, 'roles.manage');
      if (input.action === 'delete') {
        const r = await zite.roles.findOne({ id: input.id! });
        if (!r) throw fail('NOT_FOUND', 'Rol niet gevonden.');
        if (r.isSystem) throw fail('BAD_REQUEST', 'Standaardrollen kunnen niet worden verwijderd.');
        const { records } = await zite.members.findAll({ filters: { role: r.id }, limit: 1 });
        if (records.length) throw fail('BAD_REQUEST', 'Er zijn nog medewerkers met deze rol.');
        await zite.roles.delete({ id: r.id });
        await audit(me, `Rol verwijderd: ${r.name}`, 'Rechten', r.id);
        return { success: true };
      }
      const perms = (input.permissions || []).filter((p) => (PERM_KEYS as string[]).includes(p));
      if (input.id) {
        const r = await zite.roles.findOne({ id: input.id });
        if (!r) throw fail('NOT_FOUND', 'Rol niet gevonden.');
        assertCanGrant(me, [...perms, ...parseJson<string[]>(r.permissions, [])]);
        if ((r.rank ?? 0) >= 100 && !perms.includes('roles.manage')) throw fail('BAD_REQUEST', 'De Beheer-rol moet rollenbeheer behouden.');
        if (r.id === me.roleId && !perms.includes('roles.manage')) throw fail('BAD_REQUEST', 'Je kunt het rollenbeheer niet bij je eigen rol weghalen.');
        await zite.roles.update({ id: r.id, record: { name: r.isSystem ? r.name : input.name, description: input.description || null, rank: input.rank ?? r.rank, permissions: JSON.stringify(perms) } });
        await audit(me, `Rol aangepast: ${r.name}`, 'Rechten', r.id, perms.join(', '));
      } else {
        assertCanGrant(me, perms);
        const r = await zite.roles.create({ record: { name: input.name!, description: input.description || null, rank: input.rank ?? 20, permissions: JSON.stringify(perms), isSystem: false } });
        await audit(me, `Rol aangemaakt: ${input.name}`, 'Rechten', r.id, perms.join(', '));
      }
      return { success: true };
    }
    const me = await requireMe(context, 'users.manage');
    if (input.action === 'delete') {
      const { records } = await zite.members.findAll({ filters: { department: input.id! }, limit: 1 });
      if (records.length) throw fail('BAD_REQUEST', 'Er zijn nog medewerkers in deze afdeling.');
      await zite.departments.delete({ id: input.id! });
      await audit(me, 'Afdeling verwijderd', 'Gebruikers', input.id!);
    } else if (input.id) {
      await zite.departments.update({ id: input.id, record: { name: input.name!, description: input.description || null } });
      await audit(me, `Afdeling aangepast: ${input.name}`, 'Gebruikers', input.id);
    } else {
      const d = await zite.departments.create({ record: { name: input.name!, description: input.description || null } });
      await audit(me, `Afdeling aangemaakt: ${input.name}`, 'Gebruikers', d.id);
    }
    void first;
    return { success: true };
  },
});
