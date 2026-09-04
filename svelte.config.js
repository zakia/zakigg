import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://kit.svelte.dev/docs/integrations#preprocessors
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	// Ignore specific Svelte compiler warnings
	onwarn: (warning, handler) => {
		// Ignore self-closing tag warnings for non-void elements
		if (warning.code === 'element_invalid_self_closing_tag') {
			return;
		}
		// Ignore accessibility warning about media elements needing captions
		if (warning.code === 'a11y_media_has_caption') {
			return;
		}
		// Handle all other warnings normally
		handler(warning);
	},

	kit: {
		// adapter-auto only supports some environments, see https://kit.svelte.dev/docs/adapter-auto for a list.
		// If your environment is not supported, or you settled on a specific environment, switch out the adapter.
		// See https://kit.svelte.dev/docs/adapters for more information about adapters.
		adapter: adapter(),
		experimental: {
			remoteFunctions: true
		}
	},
	compilerOptions: {
		experimental: {
			async: true
		}
	}
};

export default config;
