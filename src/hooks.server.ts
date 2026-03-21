import type { Handle } from '@sveltejs/kit';

// hooks.server.js
export const handle: Handle = async ({ event, resolve }) => {
	const response = await resolve(event, {
		transformPageChunk: ({ html }) => {
			// This section will modify the HTML
			// before being returned to the client
			let currentTheme = event.cookies.get('theme');
			let currentHue = event.cookies.get('hue');

			if (!currentTheme) {
				currentTheme = 'light';
				event.cookies.set('theme', currentTheme, { path: '/', maxAge: 31536000, httpOnly: false });
			}

			if (!currentHue) {
				currentHue = '270';
				event.cookies.set('hue', currentHue, { path: '/', maxAge: 31536000, httpOnly: false });
			}
			const newHtml = html.replace(`--hue: fff`, `--hue: ${currentHue}`);
			return newHtml.replace(`data-theme=""`, `data-theme="${currentTheme}"`);
		}
	});

	return response;
};
