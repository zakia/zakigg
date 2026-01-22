import Konrad from './assets/konrad.svg';
import Procter from './assets/procter.svg';
import Siteful from './assets/siteful.svg';
import uoft from './assets/uoft.svg';

export const projects = [
	{
		company: 'TurboMenu',
		description:
			'Built a scalable platform for restaurants to **create QR code menus**, handling [10,000+ monthly visitors](https://winken.io/turbo.menu){target=_blank}, and delivering fast, interactive menus **optimized for mobile**.',
		website: 'https://turbo.menu',
		code: 'https://github.com/azakiio/turbomenu'
	},
	{
		company: 'Quickset',
		description:
			'Developed a **real-time multiplayer** card game using **WebSockets** and **PostgreSQL**, with a scalable backend deployed on **AWS** to ensure smooth, low-latency gameplay.',
		website: 'https://www.quickset.online/',
		code: 'https://github.com/azakiio/quickset'
	},
	{
		company: 'Nice Buttons',
		description:
			'Created an **open-source CSS generator** for beautiful, customizable gradient hover effects, featuring a **live preview**, **one-click copy**, and an intuitive interface for easy use.',
		website: 'https://www.nicebuttons.com/',
		code: 'https://github.com/azakiio/nice-buttons'
	}
];

export const education = {
	company: 'University of Toronto',
	positions: [
		{
			role: 'Industrial Engineering',
			startDate: '2015-09-01',
			endDate: '2020-06-01'
		}
	],
	description: ['Graduated with Honours', 'Minor in AI Engineering'],
	icon: uoft
};

export const experiences = [
	{
		company: 'Siteful.io',
		link: 'https://siteful.io',
		positions: [
			{
				role: 'Founder & Operator',
				startDate: '2024-01-02',
				endDate: undefined
			}
		],
		description: [
			'Spearhead a dynamic web development start-up, **delivering polished, high-performance** web applications across diverse [platforms](/projects){target=_blank}.',
			'Oversee the complete project lifecycle, from **design to deployment**, ensuring robust, secure, and optimized solutions with **Lighthouse scores over 90**.',
			'Collaborate closely with clients to **define project scope** and **align technical strategies** with **stakeholder expectations**.',
			'Navigate the balance between technical feasibility and long-term objectives, adhering to engineering best practices.'
		],
		icon: Siteful
	},
	{
		company: 'Konrad Group',
		link: 'https://www.konrad.com/',
		positions: [
			{
				role: 'Full Stack Developer',
				startDate: '2020-06-02',
				endDate: '2023-06-02'
			}
		],
		description: [
			'Consistently shipped **production-level** websites built on **Next.js**, integrating various APIs and services for **engaging, interactive experiences.**',
			'Integrated **headless CMS** solutions, empowering non-technical clients to **manage content independently** while avoiding **vendor lock-in**.',
			'Built a **custom e-commerce platform** for [Equinox+](https://shop.equinoxplus.com/){target=_blank} using **Shopify** and **Stripe**, simplifying **product and transaction** management for clients.',
			'Automated laborious database migration tasks, **saving** roughly **8 hours weekly.**'
		],
		icon: Konrad
	},
	{
		company: 'Procter & Gamble',
		link: 'https://www.pg.com/',
		positions: [
			{
				role: 'Data Science Intern',
				startDate: '2018-05-02',
				endDate: '2019-05-02'
			}
		],
		description: [
			'Developed data pipelines in **Python** to **analyze web traffic** and **optimize for high ROI channels**, achieving a **15% increase in conversions** with the **same budget**.',
			'Created **interactive dashboards** to visualize marketing metrics, enabling **real-time performance** tracking and **data-driven decisions**.',
			'Automated web-page performance audits using **JavaScript**, **collaborating with brand teams** to implement enhancements, resulting in a **3-5 second reduction in load times**.'
		],
		icon: Procter
	}
];

export const skills = {
	frontendDevelopment: [
		{ label: 'Javascript', icon: 'logos:javascript' },
		{ label: 'Typescript', icon: 'logos:typescript-icon' },
		{ label: 'HTML', icon: 'devicon:html5' },
		{ label: 'React', icon: 'logos:react' },
		{ label: 'Next.js', icon: 'logos:nextjs-icon' },
		{ label: 'Remix', icon: 'logos:remix-icon' },
		// { label: "Gatsby", icon: "logos:gatsby" },
		{ label: 'Vue', icon: 'logos:vue' },
		{ label: 'Svelte', icon: 'logos:svelte-icon' },
		{ label: 'Astro', icon: 'logos:astro-icon' },
		{ label: 'Phoenix', icon: 'logos:phoenix' },
		{ label: 'CSS', icon: 'devicon:css3' }
		// { label: "Tailwind", icon: "logos:tailwindcss-icon" },
	],
	backendDevelopment: [
		{ label: 'Node.js', icon: 'logos:nodejs-icon' },
		{ label: 'Elixir', icon: 'devicon:elixir' },
		{ label: 'SQL', icon: 'logos:postgresql' },
		{ label: 'Firebase', icon: 'logos:firebase' },
		{ label: 'MongoDB', icon: 'logos:mongodb-icon' },
		{ label: 'AWS', icon: 'logos:aws' },
		{ label: 'Google Cloud', icon: 'logos:google-cloud' },
		{ label: 'GraphQL', icon: 'logos:graphql' },
		// { label: "Contentful", icon: "logos:contentful" },
		{ label: 'Stripe', icon: 'logos:stripe' }
	],
	machineLearning: [
		{ label: 'Python', icon: 'logos:python' },
		{ label: 'Pytorch', icon: 'logos:pytorch-icon' },
		{ label: 'TensorFlow', icon: 'logos:tensorflow' },
		{ label: 'Numpy', icon: 'logos:numpy' },
		{ label: 'Pandas', icon: 'logos:pandas-icon' }
	]
};

export const hobbies = [
	{ label: 'guitar', icon: 'fa-solid:guitar' },
	{ label: 'chess', icon: 'fa-solid:chess' },
	{ label: 'gaming', icon: 'mdi:controller' },
	{ label: 'swimming', icon: 'fa-solid:swimmer' },
	{ label: 'coding', icon: 'fa-solid:code' },
	{
		label: 'cat',
		icon: 'fa-solid:cat',
		link: 'https://www.instagram.com/wally.wallberg/'
	}
];
