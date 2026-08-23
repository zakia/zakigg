import * as v from 'valibot';
import type { ComponentEmbedConfig } from '$lib/editor/core';

export const embed = {
	id: 'quotes.shuffle',
	label: 'Quote Shuffle',
	icon: 'mdi:format-quote-close',
	props: v.object({})
} satisfies ComponentEmbedConfig;
