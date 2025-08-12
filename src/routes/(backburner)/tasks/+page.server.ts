import type { Actions, PageServerLoad } from './$types';

export const load = (async ({ locals }) => {
  const tasks = locals.pb.collection('task').getList();
  return tasks;
}) satisfies PageServerLoad;


const formatDate = (date?: string) => {
  if (!date) return '';
  const d = new Date(date);
  return d.toISOString();
}

export const actions: Actions = {
  default: async ({ request, locals }) => {

    const formData = await request.formData();
    const task = {
      name: formData.get('name')?.toString() || '',
      description: formData.get('description')?.toString() || '',
      tags: formData.get('tags')?.toString().split(',') || [],
      due_date: formatDate(formData.get('due_date')?.toString()),
      start_date: formatDate(formData.get('start_date')?.toString()),
      end_date: formatDate(formData.get('end_date')?.toString()),
    };

    const response = await locals.pb.collection('task').create(task);
    return response;
  }
}