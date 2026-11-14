import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { audit, fail, first, holdersOf, memberNames, notify, requireMe, scopeIds } from '../server/core';

const overlap = (a1: string, a2: string, b1: string, b2: string) => new Date(a1) < new Date(b2) && new Date(b1) < new Date(a2);

export default createEndpoint({
  description: 'Roosters: diensten plannen, publiceren, open diensten, beschikbaarheid en ruilverzoeken',
  authenticated: true,
  inputSchema: z.object({
    action: z.enum(['list', 'save', 'delete', 'duplicate', 'publish', 'claim', 'availability', 'saveAvailability', 'deleteAvailability', 'swaps', 'requestSwap', 'decideSwap']),
    from: z.string().optional(),
    to: z.string().optional(),
    id: z.string().optional(),
    repeatWeeks: z.number().min(0).max(26).optional(),
    data: z.object({ title: z.string().min(1), memberId: z.string().optional(), start: z.string(), end: z.string(), departmentId: z.string().optional(), notes: z.string().optional(), published: z.boolean().optional() }).optional(),
    availability: z.object({ date: z.string(), type: z.string(), note: z.string().optional() }).optional(),
    swap: z.object({ shiftId: z.string(), targetId: z.string().optional(), reason: z.string().min(3) }).optional(),
    decision: z.enum(['Goedgekeurd', 'Afgewezen', 'Geannuleerd']).optional(),
  }),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const me = await requireMe(context);
    const manager = me.perms.has('shifts.manage');
    const scope = manager ? await scopeIds(me) : [me.id];
    const requireManager = () => { if (!manager) throw fail('FORBIDDEN', 'Geen rechten om roosters te beheren.'); };

    if (input.action === 'list') {
      const from = input.from || new Date().toISOString();
      const to = input.to || new Date(Date.now() + 31 * 86400000).toISOString();
      let shifts = (await zite.shifts.findAll({ filters: { start: { gte: from, lte: to } } as any, sort: [{ field: 'start', direction: 'asc' }], limit: 2000 })).records;
      if (!manager) shifts = shifts.filter((s) => s.published && (!first(s.member) || first(s.member) === me.id));
      else if (scope) shifts = shifts.filter((s) => !first(s.member) || scope.includes(first(s.member)!));
      const absences = (await zite.absenceRequests.findAll({ filters: { status: { in: ['Nieuw', 'In behandeling', 'Goedgekeurd'] }, endDate: { gte: from.slice(0, 10) } } as any, limit: 2000 })).records;
      const names = await memberNames(shifts.map((s) => first(s.member) || ''));
      const { records: depts } = await zite.departments.findAll({ limit: 500 });
      const dn = new Map(depts.map((d) => [d.id, d.name || '']));
      return {
        canManage: manager,
        shifts: shifts.map((s) => {
          const mid = first(s.member);
          const warnings: string[] = [];
          if (mid) {
            if (shifts.some((o) => o.id !== s.id && first(o.member) === mid && overlap(s.start!, s.end!, o.start!, o.end!))) warnings.push('Dubbele boeking');
            const a = absences.find((x) => first(x.member) === mid && overlap(s.start!, s.end!, `${x.startDate}T00:00:00`, `${x.endDate}T23:59:59`));
            if (a) warnings.push(`Afwezig: ${a.category} (${a.status})`);
          }
          return { id: s.id, title: s.title || '', memberId: mid || '', memberName: mid ? names.get(mid) || '' : '', start: s.start || '', end: s.end || '', departmentId: first(s.department) || '', department: dn.get(first(s.department) || '') || '', notes: s.notes || '', published: !!s.published, seriesId: s.seriesId || '', warnings };
        }),
      };
    }
    if (input.action === 'save') {
      requireManager();
      const d = input.data!;
      if (new Date(d.end) <= new Date(d.start)) throw fail('BAD_REQUEST', 'Einde moet na begin liggen.');
      if (d.memberId && scope && !scope.includes(d.memberId)) throw fail('FORBIDDEN', 'Medewerker valt buiten je afdeling.');
      const rec = { title: d.title, member: d.memberId ? [d.memberId] : null, start: d.start, end: d.end, department: d.departmentId ? [d.departmentId] : null, notes: d.notes || null, published: !!d.published };
      if (input.id) {
        const old = await zite.shifts.findOne({ id: input.id });
        await zite.shifts.update({ id: input.id, record: rec });
        await audit(me, 'Dienst gewijzigd', 'Roosters', input.id, `${d.title} ${d.start}`);
        const affected = [first(old?.member), d.memberId].filter(Boolean) as string[];
        if (d.published) await notify(affected, 'schedule', 'Roosterwijziging', `${d.title} op ${new Date(d.start).toLocaleDateString('nl-NL')}`, '/rooster');
      } else {
        const weeks = input.repeatWeeks || 0;
        const series = weeks ? crypto.randomUUID() : null;
        const recs = Array.from({ length: weeks + 1 }, (_, i) => ({ ...rec, seriesId: series, start: new Date(new Date(d.start).getTime() + i * 7 * 86400000).toISOString(), end: new Date(new Date(d.end).getTime() + i * 7 * 86400000).toISOString() }));
        await zite.shifts.bulkCreate({ records: recs });
        await audit(me, `Dienst aangemaakt${weeks ? ` (+${weeks} weken herhaling)` : ''}`, 'Roosters', d.title, d.start);
        if (d.published && d.memberId) await notify([d.memberId], 'schedule', 'Je bent ingeroosterd', `${d.title} op ${new Date(d.start).toLocaleDateString('nl-NL')}`, '/rooster');
      }
      return { success: true };
    }
    if (input.action === 'delete' || input.action === 'duplicate') {
      requireManager();
      const s = await zite.shifts.findOne({ id: input.id! });
      if (!s) throw fail('NOT_FOUND', 'Dienst niet gevonden.');
      if (input.action === 'delete') {
        await zite.shifts.delete({ id: s.id });
        await audit(me, 'Dienst verwijderd', 'Roosters', s.id, `${s.title} ${s.start}`);
        if (s.published && first(s.member)) await notify([first(s.member)!], 'schedule', 'Dienst vervallen', `${s.title} op ${new Date(s.start!).toLocaleDateString('nl-NL')}`, '/rooster');
      } else {
        const shift = 7 * 86400000;
        await zite.shifts.create({ record: { title: s.title!, member: first(s.member) ? [first(s.member)!] : null, department: first(s.department) ? [first(s.department)!] : null, notes: s.notes || null, published: false, start: new Date(new Date(s.start!).getTime() + shift).toISOString(), end: new Date(new Date(s.end!).getTime() + shift).toISOString() } });
        await audit(me, 'Dienst gedupliceerd naar volgende week', 'Roosters', s.id);
      }
      return { success: true };
    }
    if (input.action === 'publish') {
      requireManager();
      let { records } = await zite.shifts.findAll({ filters: { published: false, start: { gte: input.from!, lte: input.to! } } as any, limit: 2000 });
      if (scope) records = records.filter((s) => !first(s.member) || scope.includes(first(s.member)!));
      for (const s of records) await zite.shifts.update({ id: s.id, record: { published: true } });
      await audit(me, `Rooster gepubliceerd (${records.length} diensten)`, 'Roosters', `${input.from} – ${input.to}`);
      await notify(records.map((s) => first(s.member) || ''), 'schedule', 'Nieuw rooster gepubliceerd', 'Bekijk je diensten in het rooster.', '/rooster');
      return { count: records.length };
    }
    if (input.action === 'claim') {
      const s = await zite.shifts.findOne({ id: input.id! });
      if (!s || !s.published || first(s.member)) throw fail('BAD_REQUEST', 'Deze dienst is niet (meer) beschikbaar.');
      await zite.shifts.update({ id: s.id, record: { member: [me.id] } });
      await audit(me, 'Open dienst opgepakt', 'Roosters', s.id);
      await notify(await holdersOf('shifts.manage', me.departmentId, me.id), 'schedule', 'Open dienst opgepakt', `${me.name}: ${s.title} op ${new Date(s.start!).toLocaleDateString('nl-NL')}`, '/management/rooster');
      return { success: true };
    }
    if (input.action === 'availability') {
      let recs = (await zite.availability.findAll({ filters: { date: { gte: (input.from || new Date().toISOString()).slice(0, 10) } } as any, sort: [{ field: 'date', direction: 'asc' }], limit: 2000 })).records;
      recs = recs.filter((a) => (manager ? !scope || scope.includes(first(a.member) || '') : first(a.member) === me.id));
      const names = await memberNames(recs.map((a) => first(a.member) || ''));
      return { items: recs.map((a) => ({ id: a.id, date: a.date || '', type: a.type || '', note: a.note || '', memberId: first(a.member) || '', memberName: names.get(first(a.member) || '') || '' })) };
    }
    if (input.action === 'saveAvailability') {
      const a = input.availability!;
      const existing = (await zite.availability.findAll({ filters: { member: me.id, date: a.date }, limit: 1 })).records[0];
      if (existing) await zite.availability.update({ id: existing.id, record: { type: a.type, note: a.note || null } });
      else await zite.availability.create({ record: { date: a.date, type: a.type, note: a.note || null, member: [me.id] } });
      return { success: true };
    }
    if (input.action === 'deleteAvailability') {
      const a = await zite.availability.findOne({ id: input.id! });
      if (!a || first(a.member) !== me.id) throw fail('FORBIDDEN', 'Niet jouw beschikbaarheid.');
      await zite.availability.delete({ id: a.id });
      return { success: true };
    }
    if (input.action === 'swaps') {
      let recs = (await zite.shiftSwaps.findAll({ sort: [{ field: 'createdOn', direction: 'desc' }], limit: 1000 })).records;
      recs = recs.filter((r) => first(r.requester) === me.id || first(r.target) === me.id || (manager && (!scope || scope.includes(first(r.requester) || ''))));
      const shiftIds = recs.map((r) => first(r.shift)).filter(Boolean) as string[];
      const shifts = shiftIds.length ? (await zite.shifts.findAll({ filters: { id: { in: shiftIds } } as any, limit: 2000 })).records : [];
      const sm = new Map(shifts.map((s) => [s.id, s]));
      const names = await memberNames(recs.flatMap((r) => [first(r.requester) || '', first(r.target) || '']));
      return { canManage: manager, items: recs.map((r) => { const s = sm.get(first(r.shift) || ''); return { id: r.id, reason: r.reason || '', status: r.status || '', requesterId: first(r.requester) || '', requester: names.get(first(r.requester) || '') || '', target: names.get(first(r.target) || '') || 'Open (iedereen)', shiftTitle: s?.title || '—', shiftStart: s?.start || '', createdOn: r.createdOn || '' }; }) };
    }
    if (input.action === 'requestSwap') {
      const sw = input.swap!;
      const s = await zite.shifts.findOne({ id: sw.shiftId });
      if (!s || first(s.member) !== me.id) throw fail('FORBIDDEN', 'Je kunt alleen je eigen diensten ruilen.');
      const r = await zite.shiftSwaps.create({ record: { reason: sw.reason, shift: [s.id], requester: [me.id], target: sw.targetId ? [sw.targetId] : null, status: 'Aangevraagd' } });
      await audit(me, 'Dienstruil aangevraagd', 'Roosters', r.id);
      await notify([...(await holdersOf('shifts.manage', me.departmentId, me.id)), sw.targetId || ''], 'schedule', 'Nieuw ruilverzoek', `${me.name} wil ${s.title} ruilen: ${sw.reason}`, '/rooster');
      return { success: true };
    }
    if (input.action === 'decideSwap') {
      const r = await zite.shiftSwaps.findOne({ id: input.id! });
      if (!r || r.status !== 'Aangevraagd') throw fail('BAD_REQUEST', 'Verzoek is al afgehandeld.');
      if (input.decision === 'Geannuleerd') {
        if (first(r.requester) !== me.id) throw fail('FORBIDDEN', 'Alleen de aanvrager kan annuleren.');
      } else {
        requireManager();
        if (scope && !scope.includes(first(r.requester) || '')) throw fail('FORBIDDEN', 'Buiten je afdeling.');
        if (input.decision === 'Goedgekeurd') await zite.shifts.update({ id: first(r.shift)!, record: { member: first(r.target) ? [first(r.target)!] : null } });
      }
      await zite.shiftSwaps.update({ id: r.id, record: { status: input.decision! } });
      await audit(me, `Dienstruil ${input.decision!.toLowerCase()}`, 'Roosters', r.id);
      await notify([first(r.requester) || '', first(r.target) || ''].filter((x) => x !== me.id), 'schedule', `Ruilverzoek ${input.decision!.toLowerCase()}`, r.reason || '', '/rooster');
      return { success: true };
    }
    return { success: false };
  },
});
