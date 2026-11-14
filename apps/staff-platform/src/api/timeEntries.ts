import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { audit, fail, first, holdersOf, memberNames, notify, requireMe, scopeIds } from '../server/core';

export default createEndpoint({
  description: 'Urenregistratie: in/uitklokken, pauzes, handmatige uren, correcties en goedkeuring',
  authenticated: true,
  inputSchema: z.object({
    action: z.enum(['list', 'clockIn', 'clockOut', 'breakStart', 'breakEnd', 'save', 'delete', 'requestCorrection', 'review']),
    scope: z.enum(['mine', 'team']).optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    id: z.string().optional(),
    status: z.enum(['Goedgekeurd', 'Afgekeurd', 'Correctie gevraagd']).optional(),
    note: z.string().optional(),
    activity: z.string().optional(),
    data: z.object({ workDate: z.string(), start: z.string(), end: z.string(), breakMinutes: z.number().min(0), activity: z.string().min(2), department: z.string().optional(), notes: z.string().optional() }).optional(),
  }),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const me = await requireMe(context);
    const now = new Date().toISOString();
    const running = async () => (await zite.timeEntries.findAll({ filters: { member: me.id, status: 'Lopend' }, limit: 1 })).records[0];

    if (input.action === 'list') {
      const filters: Record<string, unknown> = {};
      if (input.from) filters.workDate = { gte: input.from, ...(input.to ? { lte: input.to } : {}) };
      let recs;
      if (input.scope === 'team') {
        if (!me.perms.has('time.approve')) throw fail('FORBIDDEN', 'Geen rechten om uren te controleren.');
        recs = (await zite.timeEntries.findAll({ filters: filters as any, sort: [{ field: 'workDate', direction: 'desc' }], limit: 2000 })).records;
        const scope = await scopeIds(me);
        if (scope) recs = recs.filter((r) => scope.includes(first(r.member) || ''));
      } else {
        recs = (await zite.timeEntries.findAll({ filters: { ...filters, member: me.id } as any, sort: [{ field: 'workDate', direction: 'desc' }], limit: 1000 })).records;
      }
      const names = await memberNames(recs.map((r) => first(r.member) || ''));
      const run = input.scope === 'team' ? undefined : await running();
      return {
        running: run ? { id: run.id, start: run.start || '', breakStartedAt: run.breakStartedAt || '', breakMinutes: run.breakMinutes || 0, activity: run.activity || '' } : null,
        items: recs.map((r) => ({ id: r.id, memberId: first(r.member) || '', memberName: names.get(first(r.member) || '') || '', workDate: r.workDate || '', start: r.start || '', end: r.end || '', breakMinutes: r.breakMinutes || 0, activity: r.activity || '', department: r.department || '', notes: r.notes || '', status: r.status || '', reviewedBy: r.reviewedBy || '', reviewNote: r.reviewNote || '' })),
      };
    }
    if (input.action === 'clockIn') {
      if (await running()) throw fail('CONFLICT', 'Je dienst loopt al.');
      const r = await zite.timeEntries.create({ record: { workDate: now.slice(0, 10), member: [me.id], start: now, breakMinutes: 0, activity: input.activity || 'Dienst', status: 'Lopend' } });
      await audit(me, 'Dienst gestart', 'Uren', r.id);
      return { success: true };
    }
    if (input.action === 'breakStart' || input.action === 'breakEnd' || input.action === 'clockOut') {
      const r = await running();
      if (!r) throw fail('BAD_REQUEST', 'Er loopt geen dienst.');
      let breakMinutes = r.breakMinutes || 0;
      if (r.breakStartedAt && input.action !== 'breakStart') breakMinutes += Math.round((Date.now() - new Date(r.breakStartedAt).getTime()) / 60000);
      if (input.action === 'breakStart') {
        if (r.breakStartedAt) throw fail('CONFLICT', 'Pauze loopt al.');
        await zite.timeEntries.update({ id: r.id, record: { breakStartedAt: now } });
      } else if (input.action === 'breakEnd') {
        await zite.timeEntries.update({ id: r.id, record: { breakStartedAt: null, breakMinutes } });
      } else {
        await zite.timeEntries.update({ id: r.id, record: { end: now, breakStartedAt: null, breakMinutes, status: 'Ingediend', activity: input.activity || r.activity || 'Dienst' } });
        await notify(await holdersOf('time.approve', me.departmentId, me.id), 'time', 'Uren ingediend', `${me.name} heeft een dienst afgesloten.`, '/management/uren');
      }
      await audit(me, { breakStart: 'Pauze gestart', breakEnd: 'Pauze gestopt', clockOut: 'Dienst gestopt' }[input.action], 'Uren', r.id);
      return { success: true };
    }
    if (input.action === 'save') {
      const d = input.data!;
      if (new Date(d.end) <= new Date(d.start)) throw fail('BAD_REQUEST', 'Eindtijd moet na begintijd liggen.');
      const rec = { workDate: d.workDate, start: d.start, end: d.end, breakMinutes: d.breakMinutes, activity: d.activity, department: d.department || null, notes: d.notes || null, status: 'Ingediend' };
      if (input.id) {
        const r = await zite.timeEntries.findOne({ id: input.id });
        if (!r || first(r.member) !== me.id) throw fail('FORBIDDEN', 'Niet jouw registratie.');
        if (r.status === 'Goedgekeurd') throw fail('BAD_REQUEST', 'Goedgekeurde uren kun je alleen via een correctieverzoek wijzigen.');
        await zite.timeEntries.update({ id: r.id, record: rec });
        await audit(me, 'Uren gewijzigd', 'Uren', r.id, `Was: ${r.start} – ${r.end}, pauze ${r.breakMinutes}m. Nu: ${d.start} – ${d.end}, pauze ${d.breakMinutes}m`);
      } else {
        const r = await zite.timeEntries.create({ record: { ...rec, member: [me.id] } });
        await audit(me, 'Uren handmatig geregistreerd', 'Uren', r.id, `${d.start} – ${d.end}`);
      }
      await notify(await holdersOf('time.approve', me.departmentId, me.id), 'time', 'Uren ingediend', `${me.name} heeft uren ingediend voor ${d.workDate}.`, '/management/uren');
      return { success: true };
    }
    const r = await zite.timeEntries.findOne({ id: input.id! });
    if (!r) throw fail('NOT_FOUND', 'Registratie niet gevonden.');
    const owner = first(r.member) || '';
    if (input.action === 'delete') {
      if (owner !== me.id || r.status === 'Goedgekeurd') throw fail('FORBIDDEN', 'Deze registratie kan niet worden verwijderd.');
      await zite.timeEntries.delete({ id: r.id });
      await audit(me, 'Uren verwijderd', 'Uren', r.id, `${r.start} – ${r.end}`);
      return { success: true };
    }
    if (input.action === 'requestCorrection') {
      if (owner !== me.id) throw fail('FORBIDDEN', 'Niet jouw registratie.');
      await zite.timeEntries.update({ id: r.id, record: { status: 'Correctie gevraagd', reviewNote: `Correctieverzoek: ${input.note || ''}` } });
      await audit(me, 'Correctieverzoek uren', 'Uren', r.id, input.note || '');
      await notify(await holdersOf('time.approve', me.departmentId, me.id), 'time', 'Correctieverzoek uren', `${me.name}: ${input.note || ''}`, '/management/uren');
      return { success: true };
    }
    if (!me.perms.has('time.approve')) throw fail('FORBIDDEN', 'Geen rechten om uren goed te keuren.');
    if (owner === me.id) throw fail('FORBIDDEN', 'Je kunt je eigen uren niet goedkeuren.');
    const scope = await scopeIds(me);
    if (scope && !scope.includes(owner)) throw fail('FORBIDDEN', 'Buiten je afdeling.');
    await zite.timeEntries.update({ id: r.id, record: { status: input.status!, reviewedBy: me.name, reviewNote: input.note || null } });
    await audit(me, `Uren ${input.status!.toLowerCase()}`, 'Uren', r.id, input.note || '');
    await notify([owner], 'time', `Uren ${input.status!.toLowerCase()}`, `${r.workDate}: ${input.note || ''}`, '/uren');
    return { success: true };
  },
});
