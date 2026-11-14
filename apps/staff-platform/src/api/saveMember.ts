import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { audit, fail, first, notify, requireMe, type Me } from '../server/core';

async function guardTarget(me: Me, id: string) {
  if (id === me.id) throw fail('FORBIDDEN', 'Je kunt je eigen account of rechten niet op deze manier wijzigen.');
  const m = await zite.members.findOne({ id });
  if (!m) throw fail('NOT_FOUND', 'Medewerker niet gevonden.');
  const roleId = first(m.role);
  const role = roleId ? await zite.roles.findOne({ id: roleId }) : undefined;
  if ((role?.rank ?? 0) >= me.rank && !me.perms.has('roles.manage')) throw fail('FORBIDDEN', 'Je kunt geen medewerkers met een gelijke of hogere rol beheren.');
  return m;
}

export default createEndpoint({
  description: 'Beheert medewerkersaccounts: gegevens, rol, status, rechten, reset en verwijderen',
  authenticated: true,
  inputSchema: z.object({
    action: z.enum(['update', 'status', 'overrides', 'delete', 'resetAccess', 'bulkStatus']),
    id: z.string().optional(),
    ids: z.array(z.string()).optional(),
    status: z.enum(['Actief', 'Geblokkeerd', 'Gedeactiveerd', 'Gearchiveerd']).optional(),
    data: z
      .object({
        fullName: z.string().min(2),
        username: z.string().optional(),
        jobTitle: z.string().optional(),
        phone: z.string().optional(),
        departmentId: z.string().optional(),
        roleId: z.string().optional(),
        employmentStatus: z.string().optional(),
        startDate: z.string().optional(),
      })
      .optional(),
    overrides: z.object({ grant: z.array(z.string()), deny: z.array(z.string()) }).optional(),
  }),
  outputSchema: z.object({ success: z.boolean() }),
  execute: async ({ input, context }) => {
    const me = await requireMe(context, 'users.manage');
    if (input.action === 'bulkStatus') {
      for (const id of input.ids || []) {
        const m = await guardTarget(me, id);
        await zite.members.update({ id, record: { status: input.status! } });
        await audit(me, `Status gewijzigd naar ${input.status}`, 'Gebruikers', id, m.fullName || '');
      }
      return { success: true };
    }
    const id = input.id!;
    const m = await guardTarget(me, id);
    const name = m.fullName || '';
    if (input.action === 'update' && input.data) {
      const d = input.data;
      if (d.roleId && d.roleId !== first(m.role)) {
        const role = await zite.roles.findOne({ id: d.roleId });
        if (!role) throw fail('BAD_REQUEST', 'Rol bestaat niet.');
        if ((role.rank ?? 0) >= me.rank && !me.perms.has('roles.manage')) throw fail('FORBIDDEN', 'Je kunt geen rol toekennen die gelijk of hoger is dan je eigen rol.');
        await audit(me, `Rol gewijzigd naar ${role.name}`, 'Rechten', id, name);
        await notify([id], 'account', 'Je rol is gewijzigd', `Je hebt nu de rol ${role.name}.`);
      }
      if (d.jobTitle !== undefined && d.jobTitle !== (m.jobTitle || '')) {
        await zite.reviews.create({ record: { title: `Functiewijziging: ${m.jobTitle || '—'} → ${d.jobTitle}`, member: [id], type: 'Functiewijziging', date: new Date().toISOString().slice(0, 10), author: me.name, confidential: false } });
      }
      await zite.members.update({
        id,
        record: {
          fullName: d.fullName,
          username: d.username || null,
          jobTitle: d.jobTitle || null,
          phone: d.phone || null,
          department: d.departmentId ? [d.departmentId] : null,
          ...(d.roleId ? { role: [d.roleId] } : {}),
          employmentStatus: d.employmentStatus || null,
          startDate: d.startDate || null,
        },
      });
      await audit(me, 'Medewerkergegevens bijgewerkt', 'Gebruikers', id, name);
    } else if (input.action === 'status') {
      await zite.members.update({ id, record: { status: input.status! } });
      await audit(me, `Status gewijzigd naar ${input.status}`, 'Gebruikers', id, name);
    } else if (input.action === 'overrides') {
      if (!me.perms.has('roles.manage')) throw fail('FORBIDDEN', 'Alleen Beheer kan rechten per gebruiker instellen.');
      await zite.members.update({ id, record: { permissionOverrides: JSON.stringify(input.overrides) } });
      await audit(me, 'Individuele rechten aangepast', 'Rechten', id, JSON.stringify(input.overrides));
    } else if (input.action === 'resetAccess') {
      await zite.members.update({ id, record: { user: null } });
      await audit(me, 'Accounttoegang gereset (herstel via nieuwe code)', 'Gebruikers', id, name);
    } else if (input.action === 'delete') {
      await zite.members.delete({ id });
      await audit(me, 'Medewerker verwijderd', 'Gebruikers', id, name);
    }
    return { success: true };
  },
});
