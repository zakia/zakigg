import type { PageLoad } from './$types';

const groceries = {
	fruits: {
		icon: '🍌',
		items: [
			'berries',
			'kiwi',
			'citrus (orange, grapefruit, tangerine, etc.)',
			'banana',
			'pineapple',
			'lemon/lime (for cooking)'
		]
	},
	vegetables: {
		icon: '🥦',
		items: [
			'broccoli',
			'bell pepper',
			'carrot',
			'leafy green (spinach, kale, lettuce, etc.)',
			'cucumber',
			'tomato',
			'avocado',
			'onion',
			'garlic',
			'potato/sweet potato',
			'mushroom',
			'frozen peas (or veggie mix)',
			'green onions'
		]
	},
	protein: {
		icon: '🍗',
		items: ['egg (organic if possible)', 'chicken', 'beef', 'tofu', 'beans & lentils']
	},
	dairy: {
		icon: '🧀',
		items: [
			'milk (plant-based is fine, soy is closest in macros)',
			'greek yogurt',
			'cottage cheese',
			'shreddable cheese',
			'hard cheese (parmesan, grana padano, etc.)'
		]
	},

	pantry: {
		icon: '🥫',
		items: [
			'pasta',
			'rice',
			'oats',
			'flour',
			'sugar (substitute if desired)',
			'baking powder + soda',
			'cornstarch',
			'coconut milk',
			'canned tomatoes',
			'tomato paste',
			'nut butter',
			'honey'
		]
	},
	sauces: {
		icon: '🍯',
		items: [
			'oils (olive, coconut, sesame, etc.)',
			'vinegar (white, balsamic, apple cider, etc.)',
			'condiments (ketchup, mustard, mayo, BBQ, etc.)',
			'hot sauce',
			'soy sauce',
			'fish sauce',
			'curry paste'
		]
	},
	spices: {
		icon: '🧂',
		items: [
			'salt',
			'pepper (black, white, green)',
			'garlic powder',
			'onion powder',
			'paprika',
			'cumin',
			'chili powder',
			'cayenne',
			'cinnamon',
			'turmeric',
			'curry powder',
			'Italian seasoning',
			'freeze dried shallots',
			'freeze dried chives',
			'chilli flakes (green or red)'
		]
	}
};

export const load = (async () => {
	return groceries;
}) satisfies PageLoad;
