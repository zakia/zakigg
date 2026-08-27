import * as v from 'valibot';
import { defineComponentEmbed } from '$lib/editor/components/registry';

export const propsSchema = v.object({
	src: v.string(),
	name: v.string(),
	mediaType: v.string(),
	size: v.number()
});

export const embed = defineComponentEmbed({
	id: 'core.Attachment',
	label: 'Attachment',
	description: 'Downloadable file attachment',
	icon: 'mdi:paperclip',
	keywords: ['file', 'download'],
	fields: [
		{ name: 'name', label: 'File name', type: 'text' },
		{ name: 'src', label: 'File URL', type: 'text' }
	],
	props: propsSchema,
	initialProps: () => ({ src: '', name: '', mediaType: '', size: 0 }),
	load: () => import('./Attachment.svelte')
});
