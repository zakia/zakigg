import * as v from 'valibot';
import { defineComponentEmbed } from '$lib/editor/components/registry';

export const propsSchema = v.object({
	src: v.optional(v.string(), ''),
	assetId: v.optional(v.string(), ''),
	alt: v.optional(v.string(), ''),
	title: v.optional(v.string(), ''),
	caption: v.optional(v.string(), ''),
	width: v.optional(v.number(), 100),
	align: v.optional(v.picklist(['left', 'center', 'right']), 'center')
});

export const embed = defineComponentEmbed({
	id: 'core.Image',
	markdownName: 'Image',
	label: 'Image',
	description: 'Resizable image with caption and alignment',
	icon: 'mdi:image-outline',
	editLabel: 'Edit image',
	keywords: ['photo', 'media', 'picture'],
	fields: [
		{ name: 'src', label: 'Source URL', type: 'text' },
		{ name: 'alt', label: 'Alt text', type: 'text' },
		{ name: 'caption', label: 'Caption', type: 'text' },
		{ name: 'width', label: 'Width', type: 'number' }
	],
	props: propsSchema,
	initialProps: () => ({
		src: '',
		assetId: '',
		alt: '',
		title: '',
		caption: '',
		width: 100,
		align: 'center' as const
	}),
	load: () => import('./Image.svelte')
});
