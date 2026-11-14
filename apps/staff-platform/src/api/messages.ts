import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { audit, fail, first, many, memberNames, notify, requireMe } from '../server/core';

export default createEndpoint({
  description: 'Privéberichten en groepsgesprekken',
  authenticated: true,
  inputSchema: z.object({
    action: z.enum(['conversations', 'messages', 'send', 'create']),
    id: z.string().optional(),
    body: z.string().optional(),
    title: z.string().optional(),
    participantIds: z.array(z.string()).optional(),
  }),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const me = await requireMe(context);
    if (input.action === 'conversations') {
      const { records } = await zite.conversations.findAll({ filters: { participants: me.id }, sort: [{ field: 'lastMessageAt', direction: 'desc' }], limit: 500 });
      const mine = records.filter((c) => many(c.participants).includes(me.id));
      const names = await memberNames(mine.flatMap((c) => many(c.participants)));
      return {
        items: mine.map((c) => {
          const others = many(c.participants).filter((p) => p !== me.id);
          return { id: c.id, title: c.isGroup ? c.title || 'Groep' : names.get(others[0] || '') || c.title || 'Gesprek', isGroup: !!c.isGroup, participants: many(c.participants).map((p) => names.get(p) || ''), lastMessageAt: c.lastMessageAt || '' };
        }),
      };
    }
    if (input.action === 'create') {
      const ids = [...new Set([me.id, ...(input.participantIds || [])])];
      if (ids.length < 2) throw fail('BAD_REQUEST', 'Kies minimaal één ontvanger.');
      const isGroup = ids.length > 2;
      if (!isGroup) {
        const { records } = await zite.conversations.findAll({ filters: { participants: me.id, isGroup: false }, limit: 500 });
        const ex = records.find((c) => { const p = many(c.participants); return p.length === 2 && ids.every((i) => p.includes(i)); });
        if (ex) return { id: ex.id };
      }
      const c = await zite.conversations.create({ record: { title: input.title || (isGroup ? 'Groepsgesprek' : 'Gesprek'), participants: ids, isGroup, lastMessageAt: new Date().toISOString() } });
      return { id: c.id };
    }
    const c = await zite.conversations.findOne({ id: input.id! });
    if (!c || !many(c.participants).includes(me.id)) throw fail('FORBIDDEN', 'Je neemt geen deel aan dit gesprek.');
    if (input.action === 'messages') {
      const { records } = await zite.messages.findAll({ filters: { conversation: c.id }, sort: [{ field: 'createdOn', direction: 'asc' }], limit: 1000 });
      const names = await memberNames(records.map((m) => first(m.sender) || ''));
      return { items: records.map((m) => ({ id: m.id, body: m.body || '', senderId: first(m.sender) || '', sender: names.get(first(m.sender) || '') || '', createdOn: m.createdOn || '', mine: first(m.sender) === me.id })) };
    }
    if (!input.body?.trim()) throw fail('BAD_REQUEST', 'Bericht is leeg.');
    await zite.messages.create({ record: { body: input.body.trim(), conversation: [c.id], sender: [me.id] } });
    await zite.conversations.update({ id: c.id, record: { lastMessageAt: new Date().toISOString() } });
    await notify(many(c.participants).filter((p) => p !== me.id), 'message', `Nieuw bericht van ${me.name}`, input.body.slice(0, 120), `/berichten?c=${c.id}`);
    void audit;
    return { success: true };
  },
});
