import * as v from 'valibot';
import type { ComponentEmbedConfig } from '$lib/editor/component-embeds';

export const quoteShuffleEmbed = {
	id: 'quotes.shuffle',
	label: 'Quote Shuffle',
	icon: 'mdi:format-quote-close',
	props: v.object({})
} satisfies ComponentEmbedConfig;
