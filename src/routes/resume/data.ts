export const projects = [
	{
		company: 'Wedding Strings International',
		description:
			'Built an automated gig-management platform for a **wedding music agency** replacing manual spreadsheet workflows with a **Postgres Database** and automated emails, scaling operations to **$200k+ in yearly revenue**.',
		website: 'https://bookings.weddingstrings.com/'
		// code: 'https://github.com/zakia/turbomenu'
	},
	{
		company: 'TurboMenu',
		description:
			'Built a **free and open-source** platform for restaurants to **create QR code menus**, handling [20,000+ monthly visits](https://zaki.click/share/vhnsFA6rqdAmlSjw/turbo.menu) and delivering high-performance, interactive menus **optimized for mobile**.',
		website: 'https://turbo.menu',
		code: 'https://github.com/zakia/turbomenu'
	}
	// {
	// 	company: 'Nice Buttons',
	// 	description:
	// 		'Created an **open-source CSS generator** for customizable gradient hover effects, featuring a **live preview**, **one-click copy**, and an intuitive interface.',
	// 	website: 'https://www.nicebuttons.com/',
	// 	code: 'https://github.com/zakia/nice-buttons'
	// }
];

export const education = {
	company: 'University of Toronto',
	position: {
		role: 'B.A.Sc. Industrial Engineering (Honours)',
		startDate: '2015-09-01',
		endDate: '2020-06-01'
	},
	description: ['Minor in Artificial Intelligence Engineering']
};

export const experiences = [
	{
		company: 'Vizzylabs',
		link: 'https://vizzylabs.ai',
		position: {
			role: 'Founding Engineer',
			startDate: '2024-10-01',
			endDate: undefined
		},
		description: [
			'Architected the core data pipeline to scrape and process trending social media content at scale; engineered a **model-agnostic AI layer** to extract and index structured insights (hooks, transcripts, viral patterns) from **10 million+ videos**.',
			'Migrated the legacy **Django** backend to **FastAPI**, utilizing **asynchronous concurrency** to eliminate blocking I/O during long-running AI tasks; reducing cloud infrastructure costs by **~40%** while significantly increasing system throughput.',
			'Engineered the primary client-facing dashboard and custom UGC analytics tool using **React** and **Next.js**, enabling brands to monitor sponsored creator performance; delivered the core product offering that directly scaled the company from pre-revenue to **$1M+ ARR**.',
			'Streamlined internal operations by deploying **autonomous AI agents** (OpenClaw/Nanobot), enabling non-technical team members to execute code changes and repository updates via **Slack**.',
			'Joined as the **3rd Engineer**; directed daily engineering operations (standup, sprint planning, retros) and mentored new hires; defined code standards as the team grew **5x**.'
		]
	},
	{
		company: 'Konrad Group',
		link: 'https://www.konrad.com/',
		position: {
			role: 'Senior Fullstack Developer (promoted from Junior)',
			startDate: '2020-06-01',
			endDate: '2024-06-01'
		},
		description: [
			'Built and deployed [Equinox+](https://equinoxplus.com) using **Next.js** and **Contentful** (headless CMS) to decouple the architecture and empowering marketing teams to autonomously deploy content with instant feedback.',
			'Architected a **headless e-commerce engine** for Equinox Shop, leveraging **Shopify** and **Stripe APIs** to enable a seamless, on-domain checkout that reduced funnel friction and maintained **real-time inventory synchronization**.',
			'Led the rebuild of the [Kia Canada](https://kia.ca) platform (**1M+ monthly visitors**), designing the **React** state machine and backend logic  for the ["Build and Price"](https://www.kia.ca/en/shopping-tools/build-and-price) tool to manage vehicle configurations.',
			'Drove technical delivery in an **Agile** environment, translating complex client requests from ambiguity to production; ran weekly technical "Power Hours" and mentored a team of **4 engineers** on system design and code quality.'
		]
	},
	{
		company: 'Procter & Gamble',
		link: 'https://www.pg.com/',
		position: {
			role: 'Data Science Intern',
			startDate: '2018-05-01',
			endDate: '2019-05-01'
		},
		description: [
			'Developed data pipelines in **Python** to analyze web search traffic and optimize ad spend, achieving a **15% increase in average conversions** by redistributing the same budget.',
			'Engineered **real-time telemetry dashboards** to visualize marketing metrics and enable data-driven decision-making.',
			'Automated web performance audits in **Javascript**, resulting in a **3-5 second reduction in page load times** across brand sites.'
		]
	}
];

export const skills = [
	{ label: 'TypeScript', icon: 'logos:typescript-icon' },
	{ label: 'Python', icon: 'logos:python' },
	{ label: 'SQL', icon: 'logos:postgresql' },
	{ label: 'React', icon: 'logos:react' },
	{ label: 'SvelteKit', icon: 'logos:svelte-icon' },
	{ label: 'FastAPI', icon: 'logos:fastapi-icon' },
	{ label: 'Next.js', icon: 'logos:nextjs-icon' },
	{ label: 'Node.js', icon: 'logos:nodejs-icon' },
	{ label: 'Redis', icon: 'logos:redis' },
	{ label: 'AWS', icon: 'logos:aws' },
	{ label: 'GCP', icon: 'logos:google-cloud' },
	{ label: 'Docker', icon: 'logos:docker-icon' },
	{ label: 'Vector Databases', icon: 'mdi:database-search' }
];
