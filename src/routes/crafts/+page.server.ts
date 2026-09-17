import { listStaticCrafts } from '$lib/server/content/static';
import type { PageServerLoad } from './$types';

export const prerender = true;

export const load: PageServerLoad = async () => ({ crafts: listStaticCrafts() });
