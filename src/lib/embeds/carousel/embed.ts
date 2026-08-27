import * as v from 'valibot';
import { defineComponentEmbed } from '$lib/editor/components/registry';

export const carouselAspectRatios = ['3:2', '16:9', '1:1', '4:5'] as const;
export const carouselObjectPositions = ['center', 'top', 'bottom', 'left', 'right'] as const;
export const carouselNavigationOptions = ['dots', 'none'] as const;

export const carouselSlideSchema = v.object({
	id: v.string(),
	src: v.string(),
	title: v.string(),
	caption: v.string(),
	alt: v.string(),
	objectPosition: v.picklist(carouselObjectPositions)
});

export const propsSchema = v.object({
	slides: v.array(carouselSlideSchema),
	aspectRatio: v.picklist(carouselAspectRatios),
	navigation: v.picklist(carouselNavigationOptions),
	arrows: v.boolean(),
	loop: v.boolean()
});

export type CarouselProps = v.InferOutput<typeof propsSchema>;
export type CarouselSlide = v.InferOutput<typeof carouselSlideSchema>;

export const embed = defineComponentEmbed({
	id: 'core.ImageCarousel',
	label: 'Image Carousel',
	description: 'Responsive gallery of images',
	icon: 'mdi:view-carousel-outline',
	editLabel: 'Edit carousel',
	keywords: ['gallery', 'photos', 'slides'],
	fields: [],
	props: propsSchema,
	initialProps: (): CarouselProps => ({
		slides: [],
		aspectRatio: '3:2',
		navigation: 'dots',
		arrows: true,
		loop: false
	}),
	load: () => import('./Carousel.svelte')
});
