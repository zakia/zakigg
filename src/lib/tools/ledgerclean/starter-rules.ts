import { CATEGORY_IDS as C, DEFAULT_CATEGORIES, type CategoryDictionary } from './category-model';
import type { Rule } from './processing';

/** Reviewed, versioned application defaults; personal edits are saved in the workspace. */
export const STARTER_RULE_VERSION = 1;
const merchants: readonly [string, string, string][] = [
	['starbucks', 'STARBUCKS', C.Cafes],
	['tim-hortons', 'TIM HORTONS', C.Cafes],
	['second-cup', 'SECOND CUP', C.Cafes],
	['uber-eats', 'UBER EATS', C.Takeaway],
	['doordash', 'DOORDASH', C.Takeaway],
	['skip-the-dishes', 'SKIPTHEDISHES', C.Takeaway],
	['loblaws', 'LOBLAWS', C.Groceries],
	['no-frills', 'NO FRILLS', C.Groceries],
	['presto', 'PRESTO', C.Transport],
	['lyft', 'LYFT', C.Transport],
	['netflix', 'NETFLIX', C.Entertainment],
	['spotify', 'SPOTIFY', C.Entertainment],
	['openai', 'OPENAI', C.Business],
	['digitalocean', 'DIGITALOCEAN', C.Business]
];
const patterns: readonly [string, string, string][] = [
	['cafes', 'coffee, cafe, café, espresso', C.Cafes],
	['restaurants', 'restaurant, restaurants, bar, bistro, pub, diner', C.Restaurants],
	['takeaway', 'takeaway, takeout, pizzeria, pizza', C.Takeaway],
	['groceries', 'grocery, groceries, supermarket', C.Groceries],
	['dental', 'dental, dentist, orthodontics', C.Dental],
	['pharmacy', 'pharmacy, drugstore', C.Pharmacy],
	['fitness', 'gym, fitness, pilates', C.Fitness],
	['transport', 'parking, taxi, transit', C.Transport],
	['hotels', 'hotel, motel, hostel', C.Travel],
	['cinema', 'cinema, cineplex', C.Entertainment],
	['grooming', 'barber, barbershop, hairdresser', C.Shopping]
];

export function starterRules(categories: CategoryDictionary = DEFAULT_CATEGORIES): Rule[] {
	return [
		...merchants.map(([starterId, keyword, categoryId]) => ({
			starterId,
			keyword,
			categoryId,
			match: 'merchant' as const
		})),
		...patterns.map(([starterId, keyword, categoryId]) => ({
			starterId,
			keyword,
			categoryId,
			match: 'words' as const
		}))
	]
		.filter((rule) => !!categories[rule.categoryId])
		.map((rule) => ({ ...rule, source: 'starter' as const, spendingOnly: true, enabled: true }));
}
