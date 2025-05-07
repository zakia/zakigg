export const categories = {
	billing: 'Billing',
	admin: 'Admin',
	tools: 'Tools',
	entertainment: 'Entertainment',
	organization: 'Organization',
	inspiration: 'Inspiration',
	social: 'Social'
};

export const bookmarks = [
	{
		url: 'https://www.amazon.ca/',
		icon: 'arcticons:amazon',
		tags: [categories.billing]
	},
	{
		url: 'https://my.beanfield.com/',
		icon: 'arcticons:emoji-globe-with-meridians',
		tags: [categories.billing]
	},
	{
		url: 'https://providentbilling.com/Customer',
		icon: 'arcticons:emoji-electric-plug',
		tags: [categories.billing]
	},
	{
		url: 'https://myaccount.virginplus.ca/',
		icon: 'arcticons:phone',
		tags: [categories.billing]
	},
	{
		url: 'https://console.cloud.google.com/',
		icon: 'arcticons:google-cloud',
		tags: [categories.admin]
	},
	{
		url: 'https://codepen.io/spark',
		icon: 'arcticons:codeassist',
		tags: [categories.inspiration]
	},
	{
		url: 'https://us-east-1.console.aws.amazon.com/',
		icon: 'arcticons:amazon-aws-console',
		tags: [categories.admin]
	},
	{
		url: 'https://people.payin.one/pc/#/wallet',
		icon: 'arcticons:money-manager',
		tags: [categories.billing]
	},
	{
		url: 'https://www.youtube.com/',
		icon: 'arcticons:youtube',
		tags: [categories.entertainment]
	},
	{
		url: 'https://www.google.com/',
		icon: 'arcticons:google',
		tags: [categories.organization]
	},
	{
		url: 'https://tasks.google.com/',
		icon: 'arcticons:google-tasks',
		tags: [categories.organization]
	},
	{
		url: 'https://photos.google.com/',
		icon: 'arcticons:google-photos',
		tags: [categories.organization]
	},
	{
		url: 'https://keep.google.com',
		icon: 'arcticons:google-keep',
		tags: [categories.organization]
	},
	{
		url: 'https://drive.google.com/',
		icon: 'arcticons:google-drive',
		tags: [categories.organization]
	},
	{
		url: 'https://www.instagram.com/',
		icon: 'arcticons:instagram',
		tags: [categories.social]
	},
	{
		url: 'https://www.messenger.com/',
		icon: 'arcticons:messenger',
		tags: [categories.social]
	},
	{
		url: 'https://web.whatsapp.com/',
		icon: 'arcticons:whatsapp',
		tags: [categories.social]
	},
	{
		url: 'https://icon-sets.iconify.design/',
		icon: 'arcticons:iconify',
		tags: [categories.tools]
	},
	{
		url: 'https://chatgpt.com/',
		icon: 'arcticons:openai-chatgpt',
		tags: [categories.tools]
	},
	{
		url: 'https://claude.ai/',
		icon: 'arcticons:claude',
		tags: [categories.tools]
	},
	{
		url: 'https://gemini.google.com/',
		icon: 'arcticons:google-gemini',
		tags: [categories.tools]
	},
	{
		url: 'https://chat.deepseek.com/',
		icon: 'arcticons:deepseek',
		tags: [categories.tools]
	},
	{
		url: 'https://contacts.google.com/',
		icon: 'arcticons:google-contacts',
		tags: [categories.organization]
	},
	{
		url: 'https://calendar.google.com/calendar/u/0/r/customday',
		icon: `arcticons:calendar-google-${new Date().getMonth() + 1}`,
		tags: [categories.organization]
	},
	{
		url: 'https://github.com/azakiio',
		icon: 'arcticons:github',
		tags: [categories.organization]
	},
	{
		url: 'https://mail.google.com/',
		icon: 'arcticons:google-gmail',
		tags: [categories.organization]
	},
	{
		url: 'https://messages.google.com/web/conversations',
		icon: 'arcticons:google-messages',
		tags: [categories.social]
	}
];
