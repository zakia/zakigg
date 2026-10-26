import { listPublishedCrafts } from '#lib/server/content/static.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => ({ crafts: await listPublishedCrafts() });
