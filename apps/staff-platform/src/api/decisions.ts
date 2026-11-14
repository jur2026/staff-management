import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { audit, fail, holdersOf, notify, requireMe } from '../server/core';

export default createEndpoint({
  description: 'Besluitenregister: besluiten aanmaken, bespreken, goedkeuren en archiveren',
  authenticated: true,
  inputSchema: z.object({
    action: z.enum(['list', 'save', 'delete']),
    id: z.string().optional(),
    data: z.object({ title: z.string().min(2), description: z.string().optional(), status: z.string(), meetingDate: z.string().optional(), outcome: z.string().optional() }).optional(),
  }),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const me = await requireMe(context, 'decisions.manage');
    if (input.action === 'list') {
      const { records } = await zite.decisions.findAll({ sort: [{ field: 'createdOn', direction: 'desc' }], limit: 1000 });
      return { items: records.map((d) => ({ id: d.id, title: d.title || '', description: d.description || '', status: d.status || '', meetingDate: d.meetingDate || '', outcome: d.outcome || '', author: d.author || '', createdOn: d.createdOn || '' })) };
    }
    if (input.action === 'delete') {
      await zite.decisions.delete({ id: input.id! });
      await audit(me, 'Besluit verwijderd', 'Besluiten', input.id!);
      return { success: true };
    }
    const d = input.data!;
    const rec = { title: d.title, description: d.description || null, status: d.status, meetingDate: d.meetingDate || null, outcome: d.outcome || null };
    if (input.id) {
      const old = await zite.decisions.findOne({ id: input.id });
      await zite.decisions.update({ id: input.id, record: rec });
      await audit(me, `Besluit bijgewerkt (${d.status})`, 'Besluiten', input.id, d.title);
      if (old?.status !== d.status) await notify(await holdersOf('decisions.manage', undefined, me.id), 'document', `Besluit ${d.status.toLowerCase()}`, d.title, '/bestuur/besluiten');
    } else {
      const r = await zite.decisions.create({ record: { ...rec, author: me.name } });
      await audit(me, 'Besluit aangemaakt', 'Besluiten', r.id, d.title);
      await notify(await holdersOf('decisions.manage', undefined, me.id), 'document', 'Nieuw besluit ter bespreking', d.title, '/bestuur/besluiten');
    }
    void fail;
    return { success: true };
  },
});
