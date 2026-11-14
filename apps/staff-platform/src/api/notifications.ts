import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { first, requireMe } from '../server/core';

export default createEndpoint({
  description: 'Notificatiecentrum: lijst, gelezen markeren en verwijderen',
  authenticated: true,
  inputSchema: z.object({ action: z.enum(['list', 'read', 'readAll', 'delete']), id: z.string().optional() }),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const me = await requireMe(context);
    if (input.action === 'list') {
      const { records } = await zite.notifications.findAll({ filters: { member: me.id }, sort: [{ field: 'createdOn', direction: 'desc' }], limit: 200 });
      return { items: records.map((n) => ({ id: n.id, title: n.title || '', body: n.body || '', type: n.type || '', read: !!n.read, link: n.link || '', createdOn: n.createdOn || '' })) };
    }
    if (input.action === 'readAll') {
      const { records } = await zite.notifications.findAll({ filters: { member: me.id, read: false }, limit: 500 });
      await Promise.all(records.map((n) => zite.notifications.update({ id: n.id, record: { read: true } })));
      return { success: true };
    }
    const n = await zite.notifications.findOne({ id: input.id! });
    if (!n || first(n.member) !== me.id) return { success: false };
    if (input.action === 'read') await zite.notifications.update({ id: n.id, record: { read: true } });
    else await zite.notifications.delete({ id: n.id });
    return { success: true };
  },
});
