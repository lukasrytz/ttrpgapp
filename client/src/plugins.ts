import type { ClientPlugin } from '@ttrpgapp/shared/plugin-client';
import { dnd5eClientPlugin } from '@ttrpgapp/plugin-dnd5e/client';

/** All plugins compiled into this build; /api/config decides which are shown. */
export const availableClientPlugins: ClientPlugin[] = [dnd5eClientPlugin];
