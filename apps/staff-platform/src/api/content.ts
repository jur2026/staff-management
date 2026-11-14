import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { audit, fail, notify, requireMe } from '../server/core';

export default createEndpoint({
  description: 'Documentenbibliotheek, kennisbank en mededelingen',
  authenticated: true,
  inputSchema: z.object({
    kind: z.enum(['document', 'announcement']),
    action: z.enum(['list', 'save', 'delete']),
    id: z.string().optional(),
    doc: z.object({ title: z.string().min(2), category: z.string(), content: z.string().optional(), file: z.string().optional(), minRank: z.number().min(0).max(100) }).optional(),
    ann: z.object({ title: z.string().min(2), body: z.string().min(2), pinned: z.boolean() }).optional(),
  }),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const me = await requireMe(context);
    const allActive = async () => (await zite.members.findAll({ filters: { status: 'Actief' }, limit: 2000, fields: ['id'] as any })).records.map((m) => m.id);
    if (input.kind === 'document') {
      if (input.action === 'list') {
        const { records } = await zite.documents.findAll({ sort: [{ field: 'title', direction: 'asc' }], limit: 2000 });
        return { canManage: me.perms.has('documents.manage'), items: records.filter((d) => (d.minRank ?? 0) <= me.rank).map((d) => ({ id: d.id, title: d.title || '', category: d.category || '', content: d.content || '', file: d.file || '', minRank: d.minRank ?? 0, updatedBy: d.updatedBy || '', createdOn: d.createdOn || '' })) };
      }
      if (!me.perms.has('documents.manage')) throw fail('FORBIDDEN', 'Geen rechten om documenten te beheren.');
      if (input.action === 'delete') {
        await zite.documents.delete({ id: input.id! });
        await audit(me, 'Document verwijderd', 'Documenten', input.id!);
        return { success: true };
      }
      const d = input.doc!;
      const rec = { title: d.title, category: d.category, content: d.content || null, file: d.file || null, minRank: d.minRank, updatedBy: me.name };
      if (input.id) {
        await zite.documents.update({ id: input.id, record: rec });
        await audit(me, 'Document bijgewerkt', 'Documenten', input.id, d.title);
      } else {
        const r = await zite.documents.create({ record: rec });
        await audit(me, 'Document toegevoegd', 'Documenten', r.id, d.title);
        if (d.minRank <= 10) await notify(await allActive(), 'document', 'Nieuw document', `${d.category}: ${d.title}`, '/documenten');
      }
      return { success: true };
    }
    if (input.action === 'list') {
      const { records } = await zite.announcements.findAll({ sort: [{ field: 'createdOn', direction: 'desc' }], limit: 200 });
      return { canManage: me.perms.has('announcements.manage'), items: records.sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned)).map((a) => ({ id: a.id, title: a.title || '', body: a.body || '', author: a.author || '', pinned: !!a.pinned, createdOn: a.createdOn || '' })) };
    }
    if (!me.perms.has('announcements.manage')) throw fail('FORBIDDEN', 'Geen rechten om mededelingen te beheren.');
    if (input.action === 'delete') {
      await zite.announcements.delete({ id: input.id! });
      await audit(me, 'Mededeling verwijderd', 'Communicatie', input.id!);
      return { success: true };
    }
    const a = input.ann!;
    if (input.id) {
      await zite.announcements.update({ id: input.id, record: { title: a.title, body: a.body, pinned: a.pinned } });
      await audit(me, 'Mededeling gewijzigd', 'Communicatie', input.id, a.title);
    } else {
      const r = await zite.announcements.create({ record: { title: a.title, body: a.body, pinned: a.pinned, author: me.name } });
      await audit(me, 'Mededeling geplaatst', 'Communicatie', r.id, a.title);
      await notify((await allActive()).filter((id) => id !== me.id), 'announcement', `Mededeling: ${a.title}`, a.body.slice(0, 140), '/mededelingen');
    }
    return { success: true };
  },
});
