import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import type { Perm } from '../lib/permissions';
import { audit, fail, first, memberNames, requireMe } from '../server/core';

const KIND_PERM: Record<'Bug' | 'Taak' | 'Documentatie', Perm> = { Bug: 'dev.bugs', Taak: 'dev.tasks', Documentatie: 'dev.docs' };

export default createEndpoint({
  description: 'Bugs, technische taken en documentatie in het Developer Panel',
  authenticated: true,
  inputSchema: z.object({
    action: z.enum(['list', 'save', 'delete']),
    kind: z.enum(['Bug', 'Taak', 'Documentatie']),
    id: z.string().optional(),
    data: z.object({
      title: z.string().min(2),
      description: z.string().optional(),
      status: z.enum(['Nieuw', 'Te doen', 'Bezig', 'In controle', 'Afgerond', 'Gesloten']),
      priority: z.enum(['Laag', 'Normaal', 'Hoog', 'Kritiek']),
      component: z.string().optional(),
      assigneeId: z.string().optional(),
    }).optional(),
  }),
  outputSchema: z.object({
    items: z.array(z.object({ id: z.string(), title: z.string(), description: z.string(), status: z.string(), priority: z.string(), component: z.string(), assigneeId: z.string(), assignee: z.string(), reporter: z.string(), createdOn: z.string(), updatedOn: z.string() })),
    developers: z.array(z.object({ id: z.string(), name: z.string() })),
  }),
  execute: async ({ input, context }) => {
    const me = await requireMe(context, 'developer.view');
    if (!me.perms.has(KIND_PERM[input.kind])) throw fail('FORBIDDEN', 'Je hebt geen rechten voor dit onderdeel.');
    if (input.action === 'save' && input.data) {
      const d = input.data;
      const record = { title: d.title, kind: input.kind, description: d.description || null, status: d.status, priority: d.priority, component: d.component || null, assignee: d.assigneeId ? [d.assigneeId] : null };
      if (input.id) await zite.developerItems.update({ id: input.id, record });
      else await zite.developerItems.create({ record: { ...record, reporter: me.name } });
      await audit(me, `${input.kind} ${input.id ? 'bijgewerkt' : 'aangemaakt'}: ${d.title}`, 'Developer', input.id || 'nieuw');
    } else if (input.action === 'delete') {
      await zite.developerItems.delete({ id: input.id! });
      await audit(me, `${input.kind} verwijderd`, 'Developer', input.id!);
    }
    const { records } = await zite.developerItems.findAll({ filters: { kind: input.kind }, limit: 1000, sort: [{ field: 'updatedOn', direction: 'desc' }] as any });
    const names = await memberNames(records.map((r) => first(r.assignee) || ''));
    // Developers list: only names + ids of people holding developer.view (no personnel data)
    const { records: roles } = await zite.roles.findAll({ limit: 200 });
    const devRoles = roles.filter((r) => (r.permissions || '').includes('developer.view')).map((r) => r.id);
    const { records: members } = await zite.members.findAll({ filters: { status: 'Actief' }, limit: 2000, fields: ['id', 'fullName', 'role'] as any });
    return {
      items: records.map((r) => ({ id: r.id, title: r.title || '', description: r.description || '', status: r.status || 'Nieuw', priority: r.priority || 'Normaal', component: r.component || '', assigneeId: first(r.assignee) || '', assignee: names.get(first(r.assignee) || '') || '', reporter: r.reporter || '', createdOn: r.createdOn || '', updatedOn: r.updatedOn || '' })),
      developers: members.filter((m) => devRoles.includes(first(m.role) || '')).map((m) => ({ id: m.id, name: m.fullName || '—' })),
    };
  },
});
