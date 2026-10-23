export const CATEGORY_PRESETS = {
	Business: {
		id: 'wkQ36tp7BgR0Nx_UJs4am',
		name: 'Business',
		color: '#8a80cb',
		kind: 'expense',
		parentId: null,
		description: 'Work software, cloud hosting, AI tools and other business expenses',
		example: 'Cloud hosting service'
	},
	Household: {
		id: '96IkbDey6iyoEvT-NeYJe',
		name: 'Household',
		color: '#7289b9',
		kind: 'expense',
		parentId: null,
		description:
			'Groceries and food for home, rent, mortgage, utilities, home supplies, children, dependants, pets and family costs',
		example: 'Monthly rent payment'
	},
	Groceries: {
		id: 'O31xfMwUt7qKeGDjBN2zh',
		name: 'Groceries',
		color: '#729f66',
		kind: 'expense',
		parentId: '96IkbDey6iyoEvT-NeYJe',
		description:
			'Food and essentials bought for home from supermarkets, grocery stores, markets and bakeries',
		example: 'Supermarket groceries'
	},
	Dining: {
		id: 'IuWjdryRMjXdthLZ9XXdF',
		name: 'Dining',
		color: '#d78f69',
		kind: 'expense',
		parentId: null,
		description: 'Restaurants, takeout, delivery, cafes and coffee shops',
		example: 'Restaurant meal'
	},
	Health: {
		id: 'F2BbWtr8d_lCJQX4ozHu5',
		name: 'Health',
		color: '#d38b9a',
		kind: 'expense',
		parentId: null,
		description:
			'Medical care, dentists, prescriptions, therapy, pharmacy, gym memberships and fitness',
		example: 'Dental appointment'
	},
	Entertainment: {
		id: 'V4lbhFkj-w9N6FbLXBHWI',
		name: 'Entertainment',
		color: '#a093c1',
		kind: 'expense',
		parentId: null,
		description: 'Movies, music, concerts, games, sports events, hobbies and leisure',
		example: 'Cinema tickets'
	},
	Transport: {
		id: 'gMFhR3wpZ18dUX2Qny_bt',
		name: 'Transport',
		color: '#6baaa6',
		kind: 'expense',
		parentId: null,
		description: 'Local public transit, taxis, ride-hailing, fuel, parking and vehicle costs',
		example: 'Bus fare'
	},
	Travel: {
		id: 'dqTW5ANZs8Ev_0CK1Lmu3',
		name: 'Travel',
		color: '#aa84b9',
		kind: 'expense',
		parentId: null,
		description:
			'Flights, accommodation and travel fees; other purchases retain their spending category and can have a trip tag',
		example: 'Hotel booking abroad'
	},
	Savings: {
		id: 'SVs3_6DFje9Tw2MXq7L8g',
		name: 'Savings',
		color: '#7baab9',
		kind: 'transfer',
		parentId: null,
		description:
			'Transfers to savings or investments; money moved between accounts, not consumption spending',
		example: 'Transfer to savings'
	},
	Shopping: {
		id: '6fW9KAdEzoM9hhPQIHfrJ',
		name: 'Shopping and Personal',
		color: '#c1a654',
		kind: 'expense',
		parentId: null,
		description: 'Clothing, electronics, grooming, personal care and other personal purchases',
		example: 'Clothing purchase'
	},
	Housing: {
		id: '5qv7nabkS_Nil0_6_h2dS',
		name: 'Housing',
		color: '#5a78b1',
		kind: 'expense',
		parentId: '96IkbDey6iyoEvT-NeYJe',
		description: 'Rent and mortgage payments for your home',
		example: 'Monthly rent payment'
	},
	Utilities: {
		id: '7Fjbad-EUSmkSUfIP1gl1',
		name: 'Bills and Utilities',
		color: '#7299c9',
		kind: 'expense',
		parentId: '96IkbDey6iyoEvT-NeYJe',
		description: 'Electricity, water, heating, internet, mobile phone and household bills',
		example: 'Internet bill'
	},
	HomeSupplies: {
		id: '71Dv6M3kZ8bZE9OgGAfQE',
		name: 'Home Supplies',
		color: '#90a4c7',
		kind: 'expense',
		parentId: '96IkbDey6iyoEvT-NeYJe',
		description: 'Furniture, cleaning, maintenance and supplies for the home',
		example: 'Cleaning supplies'
	},
	FamilyPets: {
		id: 'sqR30K7GUACOIoZ8e8VMd',
		name: 'Family and Pets',
		color: '#7286a1',
		kind: 'expense',
		parentId: '96IkbDey6iyoEvT-NeYJe',
		description: 'Childcare, dependants, children and pet costs',
		example: 'Pet supplies'
	},
	Cafes: {
		id: 'AQgp6j2wsU9eU5Ct-0WC3',
		name: 'Cafés',
		color: '#bb9067',
		kind: 'expense',
		parentId: 'IuWjdryRMjXdthLZ9XXdF',
		description:
			'Coffee shops, cafés, tea and café purchases regardless of whether you work or socialize',
		example: 'Coffee shop latte'
	},
	Restaurants: {
		id: '12VW24yneCpQq8ZubkNGQ',
		name: 'Restaurants',
		color: '#d57859',
		kind: 'expense',
		parentId: 'IuWjdryRMjXdthLZ9XXdF',
		description: 'Restaurant meals, bars and dining out',
		example: 'Restaurant dinner'
	},
	Takeaway: {
		id: 'NXWp_i6RADWbbID0_A1Ut',
		name: 'Takeaway',
		color: '#e3a880',
		kind: 'expense',
		parentId: 'IuWjdryRMjXdthLZ9XXdF',
		description: 'Takeout, fast food, delivery services and meals delivered to home',
		example: 'Food delivery order'
	},
	Medical: {
		id: 'ljIIwMBeybCSo2N7MuZYA',
		name: 'Medical',
		color: '#cf7892',
		kind: 'expense',
		parentId: 'F2BbWtr8d_lCJQX4ozHu5',
		description: 'Doctors, hospitals, therapy, specialists and medical care',
		example: 'Doctor appointment'
	},
	Dental: {
		id: '3Hct76XV5OQqlAYTpL6__',
		name: 'Dental',
		color: '#bd7c8d',
		kind: 'expense',
		parentId: 'F2BbWtr8d_lCJQX4ozHu5',
		description: 'Dentists, oral surgery and dental care',
		example: 'Dental appointment'
	},
	Pharmacy: {
		id: 'Y-_OIaYYtbREQC4SuGjzY',
		name: 'Pharmacy',
		color: '#df9bac',
		kind: 'expense',
		parentId: 'F2BbWtr8d_lCJQX4ozHu5',
		description: 'Prescriptions, medicines and pharmacy health purchases',
		example: 'Prescription refill'
	},
	Fitness: {
		id: 'fxeIJgnfOgufzI41KiPBE',
		name: 'Fitness',
		color: '#bf8daf',
		kind: 'expense',
		parentId: 'F2BbWtr8d_lCJQX4ozHu5',
		description: 'Gym memberships, fitness classes, sports training and exercise',
		example: 'Gym membership'
	}
} as const;
