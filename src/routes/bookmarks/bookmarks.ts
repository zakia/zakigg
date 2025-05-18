export const categories = {
	billing: 'Billing',
	admin: 'Admin',
	tools: 'Tools',
	entertainment: 'Entertainment',
	organization: 'Organization',
	inspiration: 'Inspiration',
	social: 'Social'
};

// export const bookmarks = [
// 	{
// 		url: 'https://www.amazon.ca/',
// 		icon: 'ri:amazon-line',
// 		tags: [categories.billing]
// 	},
// 	{
// 		url: 'https://my.beanfield.com/',
// 		icon: 'ri:globe-line',
// 		tags: [categories.billing]
// 	},
// 	{
// 		url: 'https://providentbilling.com/Customer',
// 		icon: 'ri:lightbulb-flash-line',
// 		tags: [categories.billing]
// 	},
// 	{
// 		url: 'https://myaccount.virginplus.ca/',
// 		icon: 'ri:phone-line',
// 		tags: [categories.billing]
// 	},
// 	{
// 		url: 'https://console.cloud.google.com/',
// 		icon: 'tabler:cloud',
// 		tags: [categories.admin]
// 	},
// 	{
// 		url: 'https://codepen.io/spark',
// 		icon: 'ri:codepen-line',
// 		tags: [categories.inspiration]
// 	},
// 	{
// 		url: 'https://us-east-1.console.aws.amazon.com/',
// 		icon: 'fa-brands:aws',
// 		tags: [categories.admin]
// 	},
// 	{
// 		url: 'https://people.payin.one/pc/#/wallet',
// 		icon: 'ri:money-dollar-circle-line',
// 		tags: [categories.billing]
// 	},
// 	{
// 		url: 'https://www.youtube.com/',
// 		icon: 'ri:youtube-line',
// 		tags: [categories.entertainment]
// 	},
// 	{
// 		url: 'https://www.google.com/',
// 		icon: 'ri:google-line',
// 		tags: [categories.organization]
// 	},
// 	{
// 		url: 'https://tasks.google.com/',
// 		icon: 'ri:task-line',
// 		tags: [categories.organization]
// 	},
// 	{
// 		url: 'https://photos.google.com/',
// 		icon: 'tabler:brand-google-photos',
// 		tags: [categories.organization]
// 	},
// 	{
// 		url: 'https://keep.google.com',
// 		icon: 'hugeicons:note',
// 		tags: [categories.organization]
// 	},
// 	{
// 		url: 'https://drive.google.com/',
// 		icon: 'ri:drive-line',
// 		tags: [categories.organization]
// 	},
// 	{
// 		url: 'https://www.instagram.com/',
// 		icon: 'ri:instagram-line',
// 		tags: [categories.social]
// 	},
// 	{
// 		url: 'https://www.messenger.com/',
// 		icon: 'ri:messenger-line',
// 		tags: [categories.social]
// 	},
// 	{
// 		url: 'https://web.whatsapp.com/',
// 		icon: 'ri:whatsapp-line',
// 		tags: [categories.social]
// 	},
// 	{
// 		url: 'https://icon-sets.iconify.design/',
// 		icon: 'tabler:icons',
// 		tags: [categories.tools]
// 	},
// 	{
// 		url: 'https://chatgpt.com/',
// 		icon: 'ri:openai-line',
// 		tags: [categories.tools]
// 	},
// 	{
// 		url: 'https://claude.ai/',
// 		icon: 'ri:claude-line',
// 		tags: [categories.tools]
// 	},
// 	{
// 		url: 'https://gemini.google.com/',
// 		icon: 'ri:gemini-line',
// 		tags: [categories.tools]
// 	},
// 	{
// 		url: 'https://contacts.google.com/',
// 		icon: 'ri:contacts-line',
// 		tags: [categories.organization]
// 	},
// 	{
// 		url: 'https://calendar.google.com/calendar/u/0/r/customday',
// 		icon: `ri:calendar-line`,
// 		tags: [categories.organization]
// 	},
// 	{
// 		url: 'https://github.com/azakiio',
// 		icon: 'ri:github-line',
// 		tags: [categories.tools]
// 	},
// 	{
// 		url: 'https://mail.google.com/',
// 		icon: 'ri:mail-line',
// 		tags: [categories.organization]
// 	},
// 	{
// 		url: 'https://messages.google.com/web/conversations',
// 		icon: 'ri:message-line',
// 		tags: [categories.social]
// 	},
// 	{
// 		url: 'https://kasra.io/',
// 		icon: 'ri:book-line',
// 		tags: [categories.inspiration]
// 	},
// 	{
// 		url: 'https://vercel.com/',
// 		icon: 'ri:vercel-line',
// 		tags: [categories.admin]
// 	},
// 	{
// 		url: 'https://lichess.org/',
// 		icon: 'ri:chess-line',
// 		tags: [categories.entertainment]
// 	}
// ];

export const bookmarks = {
	organization: [
		{
			url: 'https://www.google.com/',
			icon: 'ri:google-line'
		},
		{
			url: 'https://tasks.google.com/',
			icon: 'ri:task-line'
		},
		{
			url: 'https://photos.google.com/',
			icon: 'tabler:brand-google-photos'
		},
		{
			url: 'https://keep.google.com',
			icon: 'hugeicons:note'
		},
		{
			url: 'https://drive.google.com/',
			icon: 'ri:drive-line'
		},
		{
			url: 'https://contacts.google.com/',
			icon: 'ri:contacts-line'
		},
		{
			url: 'https://calendar.google.com/calendar/u/0/r/customday',
			icon: 'ri:calendar-line'
		},
		{
			url: 'https://mail.google.com/',
			icon: 'ri:mail-line'
		}
	],
	admin: [
		{
			url: 'https://www.amazon.ca/',
			icon: 'ri:amazon-line'
		},
		{
			url: 'https://my.beanfield.com/',
			icon: 'ri:globe-line'
		},
		{
			url: 'https://providentbilling.com/Customer',
			icon: 'ri:lightbulb-flash-line'
		},
		{
			url: 'https://myaccount.virginplus.ca/',
			icon: 'ri:phone-line'
		},
		{
			url: 'https://people.payin.one/pc/#/wallet',
			icon: 'ri:money-dollar-circle-line'
		},
		{
			url: 'https://console.cloud.google.com/',
			icon: 'tabler:cloud'
		},
		{
			url: 'https://us-east-1.console.aws.amazon.com/',
			icon: 'fa-brands:aws'
		},
		{
			url: 'https://vercel.com/',
			icon: 'ri:vercel-line'
		}
	],
	tools: [
		{
			url: 'https://icon-sets.iconify.design/',
			icon: 'tabler:icons'
		},
		{
			url: 'https://chatgpt.com/',
			icon: 'ri:openai-line'
		},
		{
			url: 'https://claude.ai/',
			icon: 'ri:claude-line'
		},
		{
			url: 'https://gemini.google.com/',
			icon: 'ri:gemini-line'
		},
		{
			url: 'https://github.com/azakiio',
			icon: 'ri:github-line'
		}
	],
	fun: [
		{
			url: 'https://www.youtube.com/',
			icon: 'ri:youtube-line'
		},
		{
			url: 'https://lichess.org/',
			icon: 'ri:chess-line'
		},
		{
			url: 'https://codepen.io/spark',
			icon: 'ri:codepen-line'
		},
		{
			url: 'https://kasra.io/',
			icon: 'ri:book-line'
		}
	],
	social: [
		{
			url: 'https://www.instagram.com/',
			icon: 'ri:instagram-line'
		},
		{
			url: 'https://www.messenger.com/',
			icon: 'ri:messenger-line'
		},
		{
			url: 'https://web.whatsapp.com/',
			icon: 'ri:whatsapp-line'
		},
		{
			url: 'https://messages.google.com/web/conversations',
			icon: 'ri:message-line'
		}
	]
};
