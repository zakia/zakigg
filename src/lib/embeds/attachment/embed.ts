import * as v from 'valibot';
import type { ComponentEmbedConfig } from '$lib/editor/core';

export const propsSchema = v.object({
	src: v.string(),
	name: v.string(),
	mediaType: v.string(),
	size: v.number()
});

export const embed = {
	id: 'core.Attachment',
	label: 'Attachment',
	icon: 'mdi:paperclip',
	props: propsSchema,
	initialProps: () => ({ src: '', name: '', mediaType: '', size: 0 })
} satisfies ComponentEmbedConfig<typeof propsSchema>;
