import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { audit, fail, first, memberNames, notify, requireMe, scopeIds } from '../server/core';

export default createEndpoint({
  description: 'Taken en projecten: toewijzen, status bijwerken en controleren',
  authenticated: true,
  inputSchema: z.object({
    action: z.enum(['list', 'save', 'status', 'delete']),
    scope: z.enum(['mine', 'team']).optional(),
    id: z.string().optional(),
    status: z.enum(['Open', 'Bezig', 'Ter controle', 'Afgerond']).optional(),
    data: z.object({ title: z.string().min(2), description: z.string().optional(), assigneeId: z.string().optional(), dueDate: z.string().optional(), priority: z.string(), project: z.string().optional() }).optional(),
  }),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const me = await requireMe(context);
    const manager = me.perms.has('tasks.assign');
    const scope = manager ? await scopeIds(me) : [me.id];
    if (input.action === 'list') {
      let recs = (await zite.tasks.findAll({ ...(input.scope === 'team' ? {} : { filters: { assignee: me.id } }), sort: [{ field: 'dueDate', direction: 'asc' }], limit: 2000 })).records;
      if (input.scope === 'team') {
        if (!manager) throw fail('FORBIDDEN', 'Geen rechten.');
        if (scope) recs = recs.filter((t) => scope.includes(first(t.assignee) || ''));
      }
      const names = await memberNames(recs.map((t) => first(t.assignee) || ''));
      return { items: recs.map((t) => ({ id: t.id, title: t.title || '', description: t.description || '', assigneeId: first(t.assignee) || '', assignee: names.get(first(t.assignee) || '') || '', createdBy: t.createdBy || '', dueDate: t.dueDate || '', priority: t.priority || '', status: t.status || '', project: t.project || '', createdOn: t.createdOn || '' })) };
    }
    if (input.action === 'save') {
      const d = input.data!;
      const assignee = d.assigneeId || me.id;
      if (assignee !== me.id && !manager) throw fail('FORBIDDEN', 'Je kunt alleen taken voor jezelf aanmaken.');
      if (scope && !scope.includes(assignee)) throw fail('FORBIDDEN', 'Medewerker valt buiten je afdeling.');
      const rec = { title: d.title, description: d.description || null, assignee: [assignee], dueDate: d.dueDate || null, priority: d.priority, project: d.project || null };
      if (input.id) {
        const t = await zite.tasks.findOne({ id: input.id });
        if (!t) throw fail('NOT_FOUND', 'Taak niet gevonden.');
        if (!manager && first(t.assignee) !== me.id) throw fail('FORBIDDEN', 'Niet jouw taak.');
        await zite.tasks.update({ id: t.id, record: rec });
        await audit(me, 'Taak gewijzigd', 'Taken', t.id, d.title);
      } else {
        const t = await zite.tasks.create({ record: { ...rec, status: 'Open', createdBy: me.name } });
        await audit(me, 'Taak aangemaakt', 'Taken', t.id, d.title);
        if (assignee !== me.id) await notify([assignee], 'task', 'Nieuwe taak toegewezen', `${d.title}${d.dueDate ? ` · deadline ${d.dueDate}` : ''}`, '/taken');
      }
      return { success: true };
    }
    const t = await zite.tasks.findOne({ id: input.id! });
    if (!t) throw fail('NOT_FOUND', 'Taak niet gevonden.');
    const own = first(t.assignee) === me.id;
    if (!own && !(manager && (!scope || scope.includes(first(t.assignee) || '')))) throw fail('FORBIDDEN', 'Geen toegang tot deze taak.');
    if (input.action === 'delete') {
      if (!manager && t.createdBy !== me.name) throw fail('FORBIDDEN', 'Alleen de opdrachtgever kan deze taak verwijderen.');
      await zite.tasks.delete({ id: t.id });
      await audit(me, 'Taak verwijderd', 'Taken', t.id, t.title || '');
      return { success: true };
    }
    await zite.tasks.update({ id: t.id, record: { status: input.status! } });
    await audit(me, `Taakstatus: ${input.status}`, 'Taken', t.id, t.title || '');
    if (own && input.status === 'Ter controle' && t.createdBy && t.createdBy !== me.name) {
      const { records } = await zite.members.findAll({ filters: { fullName: t.createdBy }, limit: 1 });
      if (records[0]) await notify([records[0].id], 'task', 'Taak ter controle', `${me.name}: ${t.title}`, '/management/taken');
    }
    if (!own) await notify([first(t.assignee) || ''], 'task', `Taak: ${input.status}`, t.title || '', '/taken');
    return { success: true };
  },
});
