import type { Handle } from "@sveltejs/kit";
import PocketBase from 'pocketbase';

// hooks.server.js
export const handle: Handle = async ({ event, resolve }) => {

  event.locals.pb = new PocketBase('http://127.0.0.1:8090');

  // load the store data from the request cookie string
  event.locals.pb.authStore.loadFromCookie(event.request.headers.get('cookie') || '');

  try {
    if (event.locals.pb.authStore.isValid) {
      await event.locals.pb.collection('users').authRefresh();
    }
  } catch (err) {
    // clear the auth store on failed refresh
    console.error(err);
    event.locals.pb.authStore.clear();
  }


  const response = await resolve(event, {
    transformPageChunk: ({ html }) => {
      // This section will modify the HTML 
      // before being returned to the client
      let currentTheme = event.cookies.get("theme");
      let currentHue = event.cookies.get("hue");

      if (!currentTheme) {
        currentTheme = "light";
        event.cookies.set("theme", currentTheme, { path: '/', maxAge: 31536000, httpOnly: false });
      }

      if (!currentHue) {
        currentHue = "270";
        event.cookies.set("hue", currentHue, { path: '/', maxAge: 31536000, httpOnly: false });
      }
      const newHtml = html.replace(`--color-hue: fff`, `--color-hue: ${currentHue}`);
      return newHtml.replace(`data-theme=""`, `data-theme="${currentTheme}"`);
    }
  });

  response.headers.append('set-cookie', event.locals.pb.authStore.exportToCookie());

  return response;
}