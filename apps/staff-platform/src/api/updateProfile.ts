import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { audit, requireMe } from '../server/core';

export default createEndpoint({
  description: 'Werkt het eigen profiel en de notificatievoorkeuren bij',
  authenticated: true,
  inputSchema: z.object({
    fullName: z.string().min(2).optional(),
    username: z.string().optional(),
    phone: z.string().optional(),
    avatar: z.string().optional(),
    bio: z.string().optional(),
    disabledNotifications: z.array(z.string()).optional(),
  }),
  outputSchema: z.object({ success: z.boolean() }),
  execute: async ({ input, context }) => {
    const me = await requireMe(context);
    const { disabledNotifications, ...rest } = input;
    const record: Record<string, string | null> = {};
    for (const [k, v] of Object.entries(rest)) if (v !== undefined) record[k] = v || null;
    if (disabledNotifications) record.notificationPreferences = JSON.stringify(disabledNotifications);
    await zite.members.update({ id: me.id, record });
    await audit(me, 'Eigen profiel bijgewerkt', 'Gebruikers', me.id, Object.keys(record).join(', '));
    return { success: true };
  },
});
