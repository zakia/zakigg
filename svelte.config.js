import adapter from '@sveltejs/adapter-auto';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { mdsvex } from 'mdsvex';
import remarkGfm from 'remark-gfm';
import remarkAttr from 'remark-attr';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://kit.svelte.dev/docs/integrations#preprocessors
	// for more information about preprocessors
	extensions: ['.svelte', '.svx'],
	preprocess: [
		mdsvex({
			layout: {
				_: './src/lib/Layout.svelte',
				interface: './src/routes/(crafts)/interface/Layout.svelte'
			},
			remarkPlugins: [remarkGfm, remarkAttr]
		}),
		vitePreprocess()
	],

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
		adapter: adapter()
	}
};

export default config;
