import type { RequestHandler } from "@sveltejs/kit";

export const GET: RequestHandler = async ({ locals }) => {
  const tasks = locals.pb.collection('task').getList();
  const response = new Response(JSON.stringify(tasks));
  return response;
};

export const POST: RequestHandler = async ({ request, locals }) => {
  const formData = await request.formData();

  const email = formData.get('email')?.toString() || ''
  const password = formData.get('password')?.toString() || ''

  const { token, record } = await locals.pb.collection('users').authWithPassword(email, password);

  console.log(token, record);

  return new Response('Success...');
}