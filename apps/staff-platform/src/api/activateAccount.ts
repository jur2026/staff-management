import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { audit, buildMe, fail, findMemberByUser, first, holdersOf, notify } from '../server/core';

export default createEndpoint({
  description: 'Activeert een account met een eenmalige toegangscode',
  authenticated: true,
  inputSchema: z.object({ code: z.string().optional(), fullName: z.string().optional() }),
  outputSchema: z.object({ success: z.boolean() }),
  execute: async ({ input, context }) => {
    if (await findMemberByUser(context.user.id)) return { success: true };
    const email = context.user.email.toLowerCase();
    const { records: any } = await zite.members.findAll({ limit: 1, fields: ['id'] as any });

    if (any.length === 0) {
      const { records: roles } = await zite.roles.findAll({ filters: { name: 'Beheer' }, limit: 1 });
      const m = await zite.members.create({
        record: {
          fullName: input.fullName?.trim() || [context.user.firstName, context.user.lastName].filter(Boolean).join(' ') || email,
          user: context.user.id,
          email,
          username: email.split('@')[0],
          role: roles[0] ? [roles[0].id] : null,
          status: 'Actief',
          employmentStatus: 'In dienst',
          jobTitle: 'Beheerder',
          lastActive: new Date().toISOString(),
        },
      });
      await audit(await buildMe(m), 'Eerste beheerder geactiveerd', 'Gebruikers', m.id);
      return { success: true };
    }

    const code = (input.code || '').trim().toUpperCase();
    if (!code) throw fail('BAD_REQUEST', 'Vul je toegangscode in.');
    const ac = await zite.accessCodes.findOne({ filters: { code } });
    if (!ac || ac.status !== 'Actief') throw fail('BAD_REQUEST', 'Deze toegangscode is ongeldig of al gebruikt.');
    if (ac.expiresAt && new Date(ac.expiresAt).getTime() < Date.now()) throw fail('BAD_REQUEST', 'Deze toegangscode is verlopen.');
    if (ac.email && ac.email.toLowerCase() !== email) throw fail('BAD_REQUEST', 'Deze code hoort bij een ander e-mailadres.');

    const existing = await zite.members.findOne({ filters: { email } });
    const fields = {
      user: context.user.id,
      email,
      status: 'Actief',
      lastActive: new Date().toISOString(),
      ...(first(ac.role) ? { role: [first(ac.role)!] } : {}),
      ...(first(ac.department) ? { department: [first(ac.department)!] } : {}),
      ...(ac.jobTitle ? { jobTitle: ac.jobTitle } : {}),
    };
    let memberId: string;
    if (existing && !first(existing.user)) {
      await zite.members.update({ id: existing.id, record: fields });
      memberId = existing.id;
    } else {
      const m = await zite.members.create({
        record: {
          ...fields,
          fullName: ac.fullName || input.fullName?.trim() || email,
          username: email.split('@')[0],
          employmentStatus: 'Inwerktraject',
          startDate: new Date().toISOString().slice(0, 10),
        },
      });
      memberId = m.id;
    }
    await zite.accessCodes.update({ id: ac.id, record: { status: 'Gebruikt', usedAt: new Date().toISOString() } });
    const m = await zite.members.findOne({ id: memberId });
    const me = await buildMe(m!);
    await audit(me, `Account geactiveerd met code ${code}`, 'Toegangscodes', memberId);
    await notify(await holdersOf('users.manage'), 'account', 'Nieuw account geactiveerd', `${me.name} heeft een account geactiveerd.`, '/beheer/gebruikers');
    return { success: true };
  },
});
