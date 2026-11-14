import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { audit, fail, first, holdersOf, memberNames, notify, requireMe, scopeIds } from '../server/core';

const STATUSES = ['Nieuw', 'In behandeling', 'Goedgekeurd', 'Afgewezen', 'Aanvullende informatie nodig', 'Geannuleerd'] as const;

export default createEndpoint({
  description: 'Afwezigheidsmeldingen en verlofaanvragen: indienen, bekijken en behandelen',
  authenticated: true,
  inputSchema: z.object({
    action: z.enum(['list', 'create', 'cancel', 'review']),
    scope: z.enum(['mine', 'team']).optional(),
    id: z.string().optional(),
    status: z.enum(STATUSES).optional(),
    response: z.string().optional(),
    data: z.object({
      category: z.string(),
      startDate: z.string(),
      endDate: z.string(),
      startTime: z.string().optional(),
      endTime: z.string().optional(),
      explanation: z.string().min(3),
      attachment: z.string().optional(),
      replacement: z.string().optional(),
    }).optional(),
  }),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const me = await requireMe(context);
    if (input.action === 'list') {
      let records;
      if (input.scope === 'team') {
        if (!me.perms.has('absence.handle')) throw fail('FORBIDDEN', 'Geen rechten om aanvragen te behandelen.');
        records = (await zite.absenceRequests.findAll({ sort: [{ field: 'startDate', direction: 'desc' }], limit: 2000 })).records;
        const scope = await scopeIds(me);
        if (scope) records = records.filter((r) => scope.includes(first(r.member) || ''));
      } else {
        records = (await zite.absenceRequests.findAll({ filters: { member: me.id }, sort: [{ field: 'startDate', direction: 'desc' }], limit: 500 })).records;
      }
      const names = await memberNames(records.map((r) => first(r.member) || ''));
      return {
        items: records.map((r) => ({ id: r.id, memberId: first(r.member) || '', memberName: names.get(first(r.member) || '') || '', category: r.category || '', startDate: r.startDate || '', endDate: r.endDate || '', startTime: r.startTime || '', endTime: r.endTime || '', explanation: r.explanation || '', attachment: r.attachment || '', replacement: r.replacement || '', status: r.status || '', response: r.response || '', handledBy: r.handledBy || '', createdOn: r.createdOn || '' })),
      };
    }
    if (input.action === 'create') {
      const d = input.data!;
      if (d.endDate < d.startDate) throw fail('BAD_REQUEST', 'Einddatum ligt voor de begindatum.');
      const r = await zite.absenceRequests.create({
        record: { summary: `${d.category} – ${me.name}`, category: d.category, member: [me.id], startDate: d.startDate, endDate: d.endDate, startTime: d.startTime || null, endTime: d.endTime || null, explanation: d.explanation, attachment: d.attachment || null, replacement: d.replacement || null, status: 'Nieuw' },
      });
      await audit(me, `Afwezigheid gemeld (${d.category})`, 'Afwezigheid', r.id, `${d.startDate} t/m ${d.endDate}`);
      await notify(await holdersOf('absence.handle', me.departmentId, me.id), 'absence', 'Nieuwe afwezigheidsmelding', `${me.name}: ${d.category} van ${d.startDate} t/m ${d.endDate}`, '/management/afwezigheid');
      return { success: true };
    }
    const r = await zite.absenceRequests.findOne({ id: input.id! });
    if (!r) throw fail('NOT_FOUND', 'Aanvraag niet gevonden.');
    const ownerId = first(r.member) || '';
    if (input.action === 'cancel') {
      if (ownerId !== me.id) throw fail('FORBIDDEN', 'Je kunt alleen je eigen aanvragen annuleren.');
      await zite.absenceRequests.update({ id: r.id, record: { status: 'Geannuleerd' } });
      await audit(me, 'Afwezigheid geannuleerd', 'Afwezigheid', r.id);
      return { success: true };
    }
    if (!me.perms.has('absence.handle')) throw fail('FORBIDDEN', 'Geen rechten om aanvragen te behandelen.');
    if (ownerId === me.id) throw fail('FORBIDDEN', 'Je kunt je eigen aanvraag niet behandelen.');
    const scope = await scopeIds(me);
    if (scope && !scope.includes(ownerId)) throw fail('FORBIDDEN', 'Deze medewerker valt buiten je afdeling.');
    await zite.absenceRequests.update({ id: r.id, record: { status: input.status!, response: input.response || r.response || null, handledBy: me.name } });
    await audit(me, `Afwezigheid ${input.status!.toLowerCase()}`, 'Afwezigheid', r.id, input.response || '');
    await notify([ownerId], 'absence', `Je aanvraag is ${input.status!.toLowerCase()}`, input.response || `${r.category} ${r.startDate} t/m ${r.endDate}`, '/afwezigheid');
    return { success: true };
  },
});
