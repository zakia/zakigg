import * as v from 'valibot';
import { defineComponentEmbed } from '$lib/editor/components/registry';

export const propsSchema = v.object({
	src: v.optional(v.string(), ''),
	assetId: v.optional(v.string(), ''),
	alt: v.optional(v.string(), ''),
	title: v.optional(v.string(), ''),
	caption: v.optional(v.string(), ''),
	width: v.optional(v.number(), 100),
	align: v.optional(v.picklist(['left', 'center', 'right']), 'center'),
	controls: v.optional(v.boolean(), true),
	autoplay: v.optional(v.boolean(), false),
	loop: v.optional(v.boolean(), false),
	muted: v.optional(v.boolean(), false)
});

export const embed = defineComponentEmbed({
	id: 'core.Video',
	markdownName: 'Video',
	label: 'Video',
	description: 'Resizable video with playback settings',
	icon: 'mdi:video-outline',
	editLabel: 'Edit video',
	keywords: ['media', 'movie', 'clip'],
	fields: [
		{ name: 'src', label: 'Source URL', type: 'text' },
		{ name: 'caption', label: 'Caption', type: 'text' },
		{ name: 'width', label: 'Width', type: 'number' },
		{ name: 'controls', label: 'Controls', type: 'boolean' }
	],
	props: propsSchema,
	initialProps: () => ({
		src: '',
		assetId: '',
		alt: '',
		title: '',
		caption: '',
		width: 100,
		align: 'center' as const,
		controls: true,
		autoplay: false,
		loop: false,
		muted: false
	}),
	load: () => import('./Video.svelte')
});
