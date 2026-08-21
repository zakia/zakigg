import * as v from 'valibot';
import type { ComponentEmbedConfig } from '$lib/editor/component-embeds';

export const styleGuideSections = ['colors', 'buttons', 'cards', 'forms'] as const;
export type StyleGuideSection = (typeof styleGuideSections)[number];

export const embed = {
	id: 'style-guide.preview',
	label: 'Style Guide Preview',
	icon: 'mdi:palette-outline',
	props: v.object({
		section: v.picklist(styleGuideSections)
	}),
	initialProps: () => ({ section: 'colors' as const })
} satisfies ComponentEmbedConfig;
