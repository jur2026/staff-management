import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { buildMe, findMemberByUser, first, getSetting, parseJson } from '../server/core';

export default createEndpoint({
  description: 'Geeft het account, de rol, rechten en platforminstellingen van de ingelogde gebruiker',
  authenticated: true,
  inputSchema: z.object({}),
  outputSchema: z.any(),
  execute: async ({ context }) => {
    const platformName = (await getSetting('platformName')) || 'Staff HQ';
    const maintenance = (await getSetting('maintenance')) === 'true';
    const modules = parseJson<Record<string, boolean>>(await getSetting('modules'), {});
    const member = await findMemberByUser(context.user.id);
    if (!member) {
      const { records } = await zite.members.findAll({ limit: 1, fields: ['id'] as any });
      return { state: 'unactivated' as const, bootstrap: records.length === 0, platformName };
    }
    if (member.status !== 'Actief') return { state: 'blocked' as const, status: member.status || 'Onbekend', platformName };
    const me = await buildMe(member);
    if (maintenance && !me.perms.has('settings.manage')) return { state: 'maintenance' as const, platformName };
    const dept = me.departmentId ? await zite.departments.findOne({ id: me.departmentId }) : undefined;
    const { records: notes } = await zite.notifications.findAll({ filters: { member: me.id, read: false }, limit: 200, fields: ['id'] as any });
    const { records: pages } = await zite.pages.findAll({ filters: { published: true }, sort: [{ field: 'sortOrder', direction: 'asc' }], limit: 100 });
    return {
      state: 'active' as const,
      platformName,
      maintenance,
      modules,
      unread: notes.length,
      pages: pages.filter((p) => (p.minRank ?? 0) <= me.rank).map((p) => ({ id: p.id, title: p.title || 'Pagina' })),
      me: {
        id: me.id,
        name: me.name,
        email: me.email,
        rank: me.rank,
        roleName: me.roleName,
        department: dept?.name || '',
        departmentId: me.departmentId || '',
        jobTitle: member.jobTitle || '',
        username: member.username || '',
        avatar: member.avatar || '',
        phone: member.phone || '',
        bio: member.bio || '',
        notificationPreferences: parseJson<string[]>(member.notificationPreferences, []),
        perms: [...me.perms],
      },
      _role: first(member.role),
    };
  },
});
