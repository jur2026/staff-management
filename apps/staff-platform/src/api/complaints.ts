import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { audit, fail, first, holdersOf, memberNames, notify, parseJson, requireMe, scopeIds, type Me } from '../server/core';

async function rankOf(memberId?: string) {
  if (!memberId) return 0;
  const m = await zite.members.findOne({ id: memberId });
  const r = first(m?.role) ? await zite.roles.findOne({ id: first(m?.role)! }) : undefined;
  return r?.rank ?? 0;
}

type C = Awaited<ReturnType<typeof zite.complaints.findAll>>['records'][0];

async function canHandle(me: Me, c: C, scope: string[] | null, ranks: Map<string, number>) {
  if (!me.perms.has('complaints.handle')) return false;
  const against = first(c.against);
  if (against === me.id) return false;
  if (first(c.handler) === me.id) return true;
  if (against && (ranks.get(against) ?? 0) >= me.rank) return false;
  if (scope && !scope.includes(first(c.submitter) || '')) return false;
  return true;
}

export default createEndpoint({
  description: 'Vertrouwelijk klachtenbeheer: indienen, volgen, behandelen en reageren',
  authenticated: true,
  inputSchema: z.object({
    action: z.enum(['list', 'get', 'create', 'update', 'comment']),
    scope: z.enum(['mine', 'handle']).optional(),
    id: z.string().optional(),
    data: z.object({ subject: z.string().min(3), category: z.string(), description: z.string().min(10), priority: z.string(), againstId: z.string().optional(), attachment: z.string().optional() }).optional(),
    status: z.string().optional(),
    priority: z.string().optional(),
    handlerId: z.string().optional(),
    message: z.string().optional(),
    internal: z.boolean().optional(),
  }),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const me = await requireMe(context);
    const scope = await scopeIds(me);
    const loadRanks = async (cs: C[]) => {
      const ids = [...new Set(cs.map((c) => first(c.against)).filter(Boolean) as string[])];
      const { records: roles } = await zite.roles.findAll({ limit: 200 });
      const rr = new Map(roles.map((r) => [r.id, r.rank ?? 0]));
      const map = new Map<string, number>();
      if (ids.length) {
        const { records } = await zite.members.findAll({ filters: { id: { in: ids } } as any, limit: 2000 });
        records.forEach((m) => map.set(m.id, rr.get(first(m.role) || '') ?? 0));
      }
      return map;
    };
    const shape = (c: C, names: Map<string, string>, handler: boolean) => ({
      id: c.id, number: c.complaintNumber ?? 0, subject: c.subject || '', category: c.category || '', description: c.description || '', priority: c.priority || '', status: c.status || '', attachment: c.attachment || '', createdOn: c.createdOn || '',
      submitterName: handler ? names.get(first(c.submitter) || '') || '' : '', againstName: names.get(first(c.against) || '') || '', handlerName: names.get(first(c.handler) || '') || '', handlerId: first(c.handler) || '', mine: first(c.submitter) === me.id,
    });

    if (input.action === 'list') {
      let cs: C[];
      if (input.scope === 'handle') {
        if (!me.perms.has('complaints.handle')) throw fail('FORBIDDEN', 'Geen rechten.');
        const all = (await zite.complaints.findAll({ sort: [{ field: 'createdOn', direction: 'desc' }], limit: 2000 })).records;
        const ranks = await loadRanks(all);
        cs = [];
        for (const c of all) if (await canHandle(me, c, scope, ranks)) cs.push(c);
      } else {
        cs = (await zite.complaints.findAll({ filters: { submitter: me.id }, sort: [{ field: 'createdOn', direction: 'desc' }], limit: 500 })).records;
      }
      const names = await memberNames(cs.flatMap((c) => [first(c.submitter), first(c.against), first(c.handler)].filter(Boolean) as string[]));
      return { items: cs.map((c) => shape(c, names, input.scope === 'handle')) };
    }

    if (input.action === 'create') {
      const d = input.data!;
      if (d.againstId === me.id) throw fail('BAD_REQUEST', 'Je kunt geen klacht over jezelf indienen.');
      const c = await zite.complaints.create({ record: { subject: d.subject, category: d.category, description: d.description, priority: d.priority, status: 'Nieuw', submitter: [me.id], against: d.againstId ? [d.againstId] : null, attachment: d.attachment || null } });
      await audit(me, 'Klacht ingediend', 'Klachten', c.id, d.category);
      const againstRank = await rankOf(d.againstId);
      const handlers = await holdersOf('complaints.handle', me.departmentId, d.againstId);
      const allowed: string[] = [];
      for (const h of handlers) if (!d.againstId || (await rankOf(h)) > againstRank) allowed.push(h);
      await notify(allowed.filter((h) => h !== me.id), 'complaint', 'Nieuwe klacht ontvangen', `Categorie: ${d.category} · prioriteit ${d.priority}`, '/management/klachten');
      return { success: true };
    }

    const c = await zite.complaints.findOne({ id: input.id! });
    if (!c) throw fail('NOT_FOUND', 'Klacht niet gevonden.');
    const isOwner = first(c.submitter) === me.id;
    const handler = await canHandle(me, c, scope, await loadRanks([c]));
    if (!isOwner && !handler) throw fail('FORBIDDEN', 'Je hebt geen toegang tot deze klacht.');

    if (input.action === 'get') {
      const ids = [first(c.submitter), first(c.against), first(c.handler)].filter(Boolean) as string[];
      const names = await memberNames(ids);
      const { records: ups } = await zite.complaintUpdates.findAll({ filters: { complaint: c.id }, sort: [{ field: 'createdOn', direction: 'asc' }], limit: 500 });
      if (handler && !isOwner) await audit(me, 'Klacht ingezien', 'Klachten', c.id);
      return { complaint: shape(c, names, handler), canHandle: handler, updates: ups.filter((u) => handler || !u.internal).map((u) => ({ id: u.id, message: u.message || '', author: u.author || '', internal: !!u.internal, createdOn: u.createdOn || '' })) };
    }

    if (input.action === 'comment') {
      if (!input.message?.trim()) throw fail('BAD_REQUEST', 'Bericht is leeg.');
      const internal = handler && !!input.internal;
      await zite.complaintUpdates.create({ record: { message: input.message, complaint: [c.id], author: me.name, internal } });
      await audit(me, internal ? 'Interne notitie bij klacht' : 'Reactie op klacht', 'Klachten', c.id);
      if (!internal) {
        const target = isOwner ? first(c.handler) : first(c.submitter);
        if (target) await notify([target], 'complaint', `Nieuwe reactie op klacht #${c.complaintNumber}`, input.message.slice(0, 140), isOwner ? '/management/klachten' : '/klachten');
      }
      return { success: true };
    }

    if (!handler) throw fail('FORBIDDEN', 'Alleen behandelaars kunnen de klacht wijzigen.');
    const changes: string[] = [];
    const record: Record<string, unknown> = {};
    if (input.status && input.status !== c.status) { record.status = input.status; changes.push(`Status: ${input.status}`); }
    if (input.priority && input.priority !== c.priority) { record.priority = input.priority; changes.push(`Prioriteit: ${input.priority}`); }
    if (input.handlerId !== undefined && input.handlerId !== first(c.handler)) {
      if (input.handlerId && input.handlerId === first(c.against)) throw fail('BAD_REQUEST', 'De persoon over wie de klacht gaat kan geen behandelaar zijn.');
      if (input.handlerId === first(c.submitter)) throw fail('BAD_REQUEST', 'De indiener kan geen behandelaar zijn.');
      record.handler = input.handlerId ? [input.handlerId] : null;
      changes.push('Behandelaar gewijzigd');
      if (input.handlerId) await notify([input.handlerId], 'complaint', `Klacht #${c.complaintNumber} aan jou toegewezen`, c.subject || '', '/management/klachten');
    }
    if (!changes.length) return { success: true };
    await zite.complaints.update({ id: c.id, record: record as any });
    await zite.complaintUpdates.create({ record: { message: changes.join(' · '), complaint: [c.id], author: me.name, internal: false } });
    await audit(me, changes.join(' · '), 'Klachten', c.id);
    await notify([first(c.submitter) || ''], 'complaint', `Update klacht #${c.complaintNumber}`, changes.join(' · '), '/klachten');
    void parseJson;
    return { success: true };
  },
});
