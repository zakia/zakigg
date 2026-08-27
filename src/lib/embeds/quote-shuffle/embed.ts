import * as v from 'valibot';
import { defineComponentEmbed } from '$lib/editor/components/registry';

export const embed = defineComponentEmbed({
	id: 'quotes.shuffle',
	markdownName: 'QuoteShuffle',
	label: 'Quote Shuffle',
	description: 'Interactive shuffled quotations',
	icon: 'mdi:format-quote-close',
	keywords: ['random', 'quotation'],
	fields: [],
	props: v.object({}),
	load: () => import('./QuoteShuffle.svelte')
});
