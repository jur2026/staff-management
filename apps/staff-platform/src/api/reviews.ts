import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { audit, fail, first, holdersOf, memberNames, notify, requireMe, scopeIds } from '../server/core';

export default createEndpoint({
  description: 'Gesprekken, evaluaties, waarschuwingen, complimenten, trainingen en gespreksaanvragen',
  authenticated: true,
  inputSchema: z.object({
    action: z.enum(['list', 'mine', 'save', 'delete', 'requestMeeting']),
    id: z.string().optional(),
    data: z.object({ title: z.string().min(2), memberId: z.string(), type: z.string(), date: z.string(), notes: z.string().optional(), confidential: z.boolean() }).optional(),
    request: z.object({ subject: z.string().min(3), notes: z.string().optional() }).optional(),
  }),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const me = await requireMe(context);
    const shape = (r: any, names: Map<string, string>) => ({ id: r.id, title: r.title || '', memberId: first(r.member) || '', memberName: names.get(first(r.member) || '') || '', type: r.type || '', date: r.date || '', notes: r.notes || '', author: r.author || '', confidential: !!r.confidential, createdOn: r.createdOn || '' });
    if (input.action === 'mine') {
      const { records } = await zite.reviews.findAll({ filters: { member: me.id }, sort: [{ field: 'date', direction: 'desc' }], limit: 500 });
      const vis = records.filter((r) => !r.confidential || r.type === 'Gespreksaanvraag');
      return { items: vis.map((r) => shape(r, new Map([[me.id, me.name]]))) };
    }
    if (input.action === 'requestMeeting') {
      const r = input.request!;
      await zite.reviews.create({ record: { title: r.subject, member: [me.id], type: 'Gespreksaanvraag', date: new Date().toISOString().slice(0, 10), notes: r.notes || null, author: me.name, confidential: false } });
      await audit(me, 'Gesprek aangevraagd', 'Gesprekken', me.id, r.subject);
      await notify(await holdersOf('reviews.manage', me.departmentId, me.id), 'account', 'Nieuwe gespreksaanvraag', `${me.name}: ${r.subject}`, '/management/gesprekken');
      return { success: true };
    }
    if (!me.perms.has('reviews.manage')) throw fail('FORBIDDEN', 'Geen rechten.');
    const scope = await scopeIds(me);
    if (input.action === 'list') {
      let { records } = await zite.reviews.findAll({ sort: [{ field: 'date', direction: 'desc' }], limit: 2000 });
      records = records.filter((r) => first(r.member) !== me.id && (!scope || scope.includes(first(r.member) || '')));
      const names = await memberNames(records.map((r) => first(r.member) || ''));
      return { items: records.map((r) => shape(r, names)) };
    }
    if (input.action === 'delete') {
      const r = await zite.reviews.findOne({ id: input.id! });
      if (!r || (scope && !scope.includes(first(r.member) || ''))) throw fail('FORBIDDEN', 'Geen toegang.');
      await zite.reviews.delete({ id: r.id });
      await audit(me, 'Gespreksverslag verwijderd', 'Gesprekken', r.id, r.title || '');
      return { success: true };
    }
    const d = input.data!;
    if (d.memberId === me.id) throw fail('FORBIDDEN', 'Je kunt geen verslag over jezelf vastleggen.');
    if (scope && !scope.includes(d.memberId)) throw fail('FORBIDDEN', 'Buiten je afdeling.');
    const rec = { title: d.title, member: [d.memberId], type: d.type, date: d.date, notes: d.notes || null, confidential: d.confidential };
    if (input.id) {
      await zite.reviews.update({ id: input.id, record: rec });
      await audit(me, `${d.type} bijgewerkt`, 'Gesprekken', input.id, d.title);
    } else {
      const r = await zite.reviews.create({ record: { ...rec, author: me.name } });
      await audit(me, `${d.type} geregistreerd`, 'Gesprekken', r.id, d.title);
      if (!d.confidential) await notify([d.memberId], 'account', d.type === 'Compliment' ? 'Je hebt een compliment ontvangen 🎉' : `Nieuw: ${d.type}`, d.title, '/ontwikkeling');
    }
    return { success: true };
  },
});
