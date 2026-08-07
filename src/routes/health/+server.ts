import type { RequestHandler } from './$types';

export const GET: RequestHandler = () => {
	return new Response(JSON.stringify({ ok: true }), {
		headers: {
			'content-type': 'application/json',
			'cache-control': 'no-store'
		}
	});
};
