import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { audit, fail, first, holdersOf, memberNames, notify, requireMe } from '../server/core';

export default createEndpoint({
  description: 'Auditlogs bekijken en inzageverzoeken indienen en behandelen',
  authenticated: true,
  inputSchema: z.object({
    action: z.enum(['logs', 'myRequests', 'allRequests', 'request', 'withdraw', 'decide']),
    requestId: z.string().optional(),
    category: z.string().optional(),
    search: z.string().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    id: z.string().optional(),
    approve: z.boolean().optional(),
    note: z.string().optional(),
    days: z.number().min(1).max(30).optional(),
    data: z.object({ reason: z.string().min(3), categories: z.array(z.string()).min(1), periodStart: z.string(), periodEnd: z.string(), explanation: z.string().min(10) }).optional(),
  }),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const me = await requireMe(context);
    const direct = me.perms.has('audit.view');
    const expire = async (recs: Awaited<ReturnType<typeof zite.auditAccessRequests.findAll>>['records']) => {
      for (const r of recs) if (r.status === 'Goedgekeurd' && r.accessExpiresAt && new Date(r.accessExpiresAt).getTime() < Date.now()) {
        await zite.auditAccessRequests.update({ id: r.id, record: { status: 'Verlopen' } });
        r.status = 'Verlopen';
      }
      return recs;
    };
    const shapeReq = (r: any, names: Map<string, string>) => ({ id: r.id, reason: r.reason || '', memberId: first(r.member) || '', memberName: names.get(first(r.member) || '') || '', categories: r.categories || [], periodStart: r.periodStart || '', periodEnd: r.periodEnd || '', explanation: r.explanation || '', status: r.status || '', decisionNote: r.decisionNote || '', decidedBy: r.decidedBy || '', accessExpiresAt: r.accessExpiresAt || '', createdOn: r.createdOn || '' });

    if (input.action === 'logs') {
      const filters: Record<string, unknown> = {};
      let allowedCats: string[] | null = null;
      let from = input.from, to = input.to;
      if (!direct) {
        const req = await zite.auditAccessRequests.findOne({ id: input.requestId || '' });
        if (!req || first(req.member) !== me.id) throw fail('FORBIDDEN', 'Je hebt goedgekeurde toestemming nodig om auditlogs te bekijken.');
        await expire([req]);
        if (req.status !== 'Goedgekeurd') throw fail('FORBIDDEN', `Je toegang is ${(req.status || '').toLowerCase()}.`);
        allowedCats = (req.categories as string[]) || [];
        from = req.periodStart; to = req.periodEnd;
        await audit(me, `Auditlogs ingezien via verzoek (${allowedCats.join(', ')})`, 'Auditinzage', req.id, `${from} t/m ${to}`);
      }
      if (from || to) filters.createdOn = { ...(from ? { gte: `${from}T00:00:00Z` } : {}), ...(to ? { lte: `${to}T23:59:59Z` } : {}) };
      if (input.category) filters.category = input.category;
      let { records } = await zite.auditLogs.findAll({ filters: filters as any, sort: [{ field: 'createdOn', direction: 'desc' }], limit: 1000 });
      if (allowedCats) records = records.filter((l) => allowedCats!.includes(l.category || '') && l.category !== 'Auditinzage');
      if (input.search) { const s = input.search.toLowerCase(); records = records.filter((l) => `${l.action} ${l.actor} ${l.details} ${l.entity}`.toLowerCase().includes(s)); }
      return { items: records.map((l) => ({ id: l.id, action: l.action || '', category: l.category || '', actor: l.actor || '', entity: l.entity || '', details: l.details || '', createdOn: l.createdOn || '' })) };
    }
    if (input.action === 'myRequests') {
      const recs = await expire((await zite.auditAccessRequests.findAll({ filters: { member: me.id }, sort: [{ field: 'createdOn', direction: 'desc' }], limit: 200 })).records);
      return { direct, items: recs.map((r) => shapeReq(r, new Map([[me.id, me.name]]))) };
    }
    if (input.action === 'allRequests') {
      if (!direct) throw fail('FORBIDDEN', 'Geen rechten.');
      const recs = await expire((await zite.auditAccessRequests.findAll({ sort: [{ field: 'createdOn', direction: 'desc' }], limit: 1000 })).records);
      const names = await memberNames(recs.map((r) => first(r.member) || ''));
      return { direct, items: recs.map((r) => shapeReq(r, names)) };
    }
    if (input.action === 'request') {
      const d = input.data!;
      if (d.periodEnd < d.periodStart) throw fail('BAD_REQUEST', 'Periode is ongeldig.');
      const r = await zite.auditAccessRequests.create({ record: { reason: d.reason, member: [me.id], categories: d.categories, periodStart: d.periodStart, periodEnd: d.periodEnd, explanation: d.explanation, status: 'In behandeling' } });
      await audit(me, 'Inzageverzoek auditlogs ingediend', 'Auditinzage', r.id, `${d.categories.join(', ')} · ${d.periodStart} t/m ${d.periodEnd}`);
      await notify(await holdersOf('audit.view', undefined, me.id), 'audit', 'Nieuw inzageverzoek auditlogs', `${me.name}: ${d.reason}`, '/audit');
      return { success: true };
    }
    const r = await zite.auditAccessRequests.findOne({ id: input.id! });
    if (!r) throw fail('NOT_FOUND', 'Verzoek niet gevonden.');
    if (input.action === 'withdraw') {
      if (first(r.member) !== me.id) throw fail('FORBIDDEN', 'Niet jouw verzoek.');
      await zite.auditAccessRequests.update({ id: r.id, record: { status: 'Ingetrokken' } });
      await audit(me, 'Inzageverzoek ingetrokken', 'Auditinzage', r.id);
      return { success: true };
    }
    if (!direct) throw fail('FORBIDDEN', 'Geen rechten om verzoeken te behandelen.');
    if (first(r.member) === me.id) throw fail('FORBIDDEN', 'Je kunt je eigen verzoek niet behandelen.');
    if (r.status !== 'In behandeling' && input.approve) throw fail('BAD_REQUEST', 'Dit verzoek is al afgehandeld.');
    const status = input.approve ? 'Goedgekeurd' : 'Afgewezen';
    const expires = input.approve ? new Date(Date.now() + (input.days || 7) * 86400000).toISOString() : null;
    await zite.auditAccessRequests.update({ id: r.id, record: { status, decisionNote: input.note || null, decidedBy: me.name, accessExpiresAt: expires } });
    await audit(me, `Inzageverzoek ${status.toLowerCase()}`, 'Auditinzage', r.id, input.note || '');
    await notify([first(r.member) || ''], 'audit', `Je inzageverzoek is ${status.toLowerCase()}`, input.approve ? `Tijdelijke toegang tot ${new Date(expires!).toLocaleDateString('nl-NL')}. ${input.note || ''}` : input.note || 'Geen reden opgegeven.', '/audit');
    return { success: true };
  },
});
