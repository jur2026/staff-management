import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { audit, fail, first, holdersOf, memberNames, notify, requireMe } from '../server/core';

const CATS = ['Inloggen', 'Accountproblemen', 'Wachtwoordproblemen', 'Websiteproblemen', 'Technische problemen', 'Rechten en toegang', 'Overige vragen'] as const;
const STATUSES = ['Open', 'In behandeling', 'Wacht op reactie', 'Opgelost', 'Gesloten'] as const;

export default createEndpoint({
  description: 'Interne supporttickets: aanmaken, reageren en behandelen',
  authenticated: true,
  inputSchema: z.object({
    action: z.enum(['list', 'create', 'reply', 'status', 'thread']),
    scope: z.enum(['mine', 'all']).optional(),
    id: z.string().optional(),
    subject: z.string().min(3).optional(),
    category: z.enum(CATS).optional(),
    description: z.string().optional(),
    attachments: z.array(z.string()).optional(),
    body: z.string().optional(),
    internal: z.boolean().optional(),
    status: z.enum(STATUSES).optional(),
  }),
  outputSchema: z.object({
    tickets: z.array(z.object({ id: z.string(), subject: z.string(), category: z.string(), status: z.string(), requester: z.string(), requesterId: z.string(), description: z.string(), attachments: z.array(z.string()), createdOn: z.string(), updatedOn: z.string() })),
    thread: z.array(z.object({ id: z.string(), body: z.string(), author: z.string(), internal: z.boolean(), createdOn: z.string() })),
    canHandle: z.boolean(),
  }),
  execute: async ({ input, context }) => {
    const me = await requireMe(context);
    const canHandle = me.perms.has('support.handle');
    const loadTicket = async (id: string) => {
      const t = await zite.supportTickets.findOne({ id });
      if (!t) throw fail('NOT_FOUND', 'Ticket niet gevonden.');
      if (!canHandle && first(t.requester) !== me.id) throw fail('FORBIDDEN', 'Dit ticket is niet van jou.');
      return t;
    };
    let thread: { id: string; body: string; author: string; internal: boolean; createdOn: string }[] = [];

    if (input.action === 'create') {
      const t = await zite.supportTickets.create({ record: { subject: input.subject!, category: input.category || 'Overige vragen', status: 'Open', requester: [me.id], description: input.description || null, attachments: (input.attachments || []).map((url) => ({ url })) } });
      await audit(me, `Supportticket aangemaakt: ${input.subject}`, 'Support', t.id);
      await notify(await holdersOf('support.handle', undefined, me.id), 'support', 'Nieuw supportticket', `${input.category}: ${input.subject}`, '/support');
    } else if (input.action === 'reply' && input.id && input.body) {
      const t = await loadTicket(input.id);
      const internal = canHandle && !!input.internal;
      await zite.supportMessages.create({ record: { body: input.body, ticket: [t.id], author: me.name, authorId: me.id, internal } });
      const reqId = first(t.requester) || '';
      if (me.id !== reqId && !internal) {
        await zite.supportTickets.update({ id: t.id, record: { status: 'Wacht op reactie' } });
        await notify([reqId], 'support', 'Reactie op je supportticket', t.subject || '', '/support');
      } else if (me.id === reqId) {
        await zite.supportTickets.update({ id: t.id, record: { status: 'Open' } });
        await notify(await holdersOf('support.handle', undefined, me.id), 'support', 'Nieuwe reactie op ticket', t.subject || '', '/support');
      }
    } else if (input.action === 'status' && input.id) {
      if (!canHandle) throw fail('FORBIDDEN', 'Je mag tickets niet behandelen.');
      const t = await loadTicket(input.id);
      await zite.supportTickets.update({ id: t.id, record: { status: input.status! } });
      await audit(me, `Ticketstatus: ${input.status}`, 'Support', t.id);
      await notify([first(t.requester) || ''], 'support', `Ticket ${input.status!.toLowerCase()}`, t.subject || '', '/support');
    }
    if (input.id && (input.action === 'thread' || input.action === 'reply')) {
      await loadTicket(input.id);
      const { records } = await zite.supportMessages.findAll({ filters: { ticket: input.id }, limit: 500, sort: [{ field: 'createdOn', direction: 'asc' }] as any });
      thread = records.filter((m) => canHandle || !m.internal).map((m) => ({ id: m.id, body: m.body || '', author: m.author || '', internal: !!m.internal, createdOn: m.createdOn || '' }));
    }
    const all = input.scope === 'all' && canHandle;
    const { records } = await zite.supportTickets.findAll({ filters: all ? {} : { requester: me.id }, limit: 1000, sort: [{ field: 'updatedOn', direction: 'desc' }] as any });
    const names = await memberNames(records.map((r) => first(r.requester) || ''));
    return {
      tickets: records.map((r) => ({ id: r.id, subject: r.subject || '', category: r.category || '', status: r.status || 'Open', requester: names.get(first(r.requester) || '') || '', requesterId: first(r.requester) || '', description: r.description || '', attachments: (r.attachments || []).map((a: any) => a.url), createdOn: r.createdOn || '', updatedOn: r.updatedOn || '' })),
      thread,
      canHandle,
    };
  },
});
