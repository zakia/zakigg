import type { PageServerLoad } from './$types';

export const load = (async ({ locals }) => {
  // JavaScript SDK
  const tasks = await locals.pb.collection('task').getList();
  console.log(tasks);
  return {};
}) satisfies PageServerLoad;