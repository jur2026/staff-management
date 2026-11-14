import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { assertCanGrant, audit, fail, first, notify, holdersOf, parseJson, requireMe } from '../server/core';

const genCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const b = crypto.getRandomValues(new Uint8Array(12));
  const s = [...b].map((x) => chars[x % chars.length]).join('');
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8)}`;
};

export default createEndpoint({
  description: 'Beheert eenmalige toegangscodes: lijst, aanmaken, intrekken, vernieuwen',
  authenticated: true,
  inputSchema: z.object({
    action: z.enum(['list', 'create', 'revoke', 'renew', 'delete']),
    id: z.string().optional(),
    data: z.object({ fullName: z.string().min(2), email: z.string().email().optional().or(z.literal('')), jobTitle: z.string().optional(), roleId: z.string(), departmentId: z.string().optional(), validDays: z.number().min(1).max(365) }).optional(),
  }),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const me = await requireMe(context, 'codes.manage');
    if (input.action === 'list') {
      const [{ records }, { records: roles }] = await Promise.all([
        zite.accessCodes.findAll({ sort: [{ field: 'createdOn', direction: 'desc' }], limit: 1000 }),
        zite.roles.findAll({ limit: 200 }),
      ]);
      const rn = new Map(roles.map((r) => [r.id, r.name]));
      return {
        codes: records.map((c) => {
          const expired = c.status === 'Actief' && !!c.expiresAt && new Date(c.expiresAt).getTime() < Date.now();
          return { id: c.id, code: c.code || '', fullName: c.fullName || '', email: c.email || '', jobTitle: c.jobTitle || '', role: rn.get(first(c.role) || '') || '', status: expired ? 'Verlopen' : c.status || '', expiresAt: c.expiresAt || '', createdBy: c.createdBy || '', usedAt: c.usedAt || '', createdOn: c.createdOn || '' };
        }),
      };
    }
    if (input.action === 'create') {
      const d = input.data!;
      const role = await zite.roles.findOne({ id: d.roleId });
      if (!role) throw fail('BAD_REQUEST', 'Kies een geldige rol.');
      if ((role.rank ?? 0) >= me.rank && !me.perms.has('roles.manage')) throw fail('FORBIDDEN', 'Je kunt geen code maken voor een gelijke of hogere rol.');
      assertCanGrant(me, parseJson<string[]>(role.permissions, []));
      await notify((await holdersOf('codes.manage')).filter((x) => x !== me.id), 'account', 'Nieuwe activatiecode aangemaakt', `${me.name} heeft een code aangemaakt voor ${d.fullName} (${role.name}).`, '/beheer/codes');
      const code = genCode();
      const c = await zite.accessCodes.create({
        record: { code, fullName: d.fullName, email: d.email ? d.email.toLowerCase() : null, jobTitle: d.jobTitle || null, role: [role.id], department: d.departmentId ? [d.departmentId] : null, expiresAt: new Date(Date.now() + d.validDays * 86400000).toISOString(), status: 'Actief', createdBy: me.name },
      });
      await audit(me, `Toegangscode aangemaakt voor ${d.fullName} (${role.name})`, 'Toegangscodes', c.id);
      return { code };
    }
    const c = await zite.accessCodes.findOne({ id: input.id! });
    if (!c) throw fail('NOT_FOUND', 'Code niet gevonden.');
    if (input.action === 'revoke') {
      await zite.accessCodes.update({ id: c.id, record: { status: 'Ingetrokken' } });
      await audit(me, `Toegangscode ingetrokken (${c.fullName})`, 'Toegangscodes', c.id);
    } else if (input.action === 'renew') {
      if (c.status === 'Gebruikt') throw fail('BAD_REQUEST', 'Een gebruikte code kan niet worden vernieuwd.');
      const code = genCode();
      await zite.accessCodes.update({ id: c.id, record: { code, status: 'Actief', expiresAt: new Date(Date.now() + 14 * 86400000).toISOString() } });
      await audit(me, `Toegangscode opnieuw uitgegeven (${c.fullName})`, 'Toegangscodes', c.id);
      return { code };
    } else {
      await zite.accessCodes.delete({ id: c.id });
      await audit(me, `Toegangscode verwijderd (${c.fullName})`, 'Toegangscodes', c.id);
    }
    return { code: '' };
  },
});
