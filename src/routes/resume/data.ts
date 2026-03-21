export const projects = [
	{
		company: 'TurboMenu',
		description:
			'Built a scalable platform for restaurants to **create QR code menus**, handling 10,000+ monthly visitors and delivering high-performance, interactive menus **optimized for mobile**.',
		website: 'https://turbo.menu',
		code: 'https://github.com/zakia/turbomenu'
	},
	{
		company: 'Nice Buttons',
		description:
			'Created an **open-source CSS generator** for customizable gradient hover effects, featuring a **live preview**, **one-click copy**, and an intuitive interface.',
		website: 'https://www.nicebuttons.com/',
		code: 'https://github.com/zakia/nice-buttons'
	}
];

export const education = {
	company: 'University of Toronto',
	position:
	{
		role: 'B.A.Sc. Industrial Engineering (Honours)',
		startDate: '2015-09-01',
		endDate: '2020-06-01'
	},
	description: ['Minor in Artificial Intelligence Engineering'],
};

export const experiences = [
	{
		company: 'Vizzylabs',
		link: 'https://vizzylabs.ai',
		position:
		{
			role: 'Founding Engineer',
			startDate: '2024-10-01',
			endDate: undefined
		},
		subtitle: 'Joined as Employee #5 (3rd Engineer); architected the AI video analytics SaaS and led its strategic evolution into a $1M ARR UGC platform.',
		description: [
			'Architected a scalable data pipeline and **model-agnostic AI layer** to extract and index structured insights from **10M+ videos** using LLMs.',
			'Led migration from legacy Django to FastAPI, utilizing asynchronous concurrency to eliminate blocking I/O for AI tasks; reduced cloud costs by 40% while significantly increasing system throughput.',
			'Built the **Video Discovery Dashboard** and **Campaign Management Platform** featuring AI-assisted review workflows and version history.',
			'Directed daily engineering operations and mentored new hires; defined code standards as the team grew 5x.'
		]
	},
	// {
	// 	company: 'Engineering Consultancy',
	// 	link: 'https://siteful.io',
	// 	position:
	// 	{
	// 		role: 'Founder & Lead Engineer',
	// 		startDate: '2023-06-01',
	// 		endDate: '2024-10-01'
	// 	},
	// 	description: [
	// 		'Established a boutique consultancy specializing in **digital transformation** and automation for the **DACH (Germany)** market.',
	// 		'Architected automated document processing pipelines for **Bayer**, replacing manual paper systems with custom engines for secure data syncing.',
	// 		'Built the **MDPronto** telemedicine platform frontend, engineering an **API-driven interface** to manage complex healthcare data flows.',
	// 		'Modernized legacy analog operations for German SMEs by building custom **CMS and internal ERP tools** ensuring strict **GDPR compliance**.'
	// 	],
	// },
	{
		company: 'Konrad Group',
		link: 'https://www.konrad.com/',
		position:
		{
			role: 'Senior Fullstack Developer (Promoted from Junior)',
			startDate: '2020-06-01',
			endDate: '2024-06-01'
		},
		description: [
			'Architected mission-critical web applications for global brands like **Equinox+**, supporting high-traffic e-commerce and interactive experiences.',
			'Integrated **headless CMS** solutions and custom design systems, bridging the gap between high-fidelity UX and scalable production code.',
			'Optimized application performance and accessibility, consistently meeting strict **Lighthouse benchmarks** prior to deployment.',
			'Mentored junior developers through code reviews and technical **"Power Hours"** to maintain engineering excellence.'
		],
	},
	{
		company: 'Procter & Gamble',
		link: 'https://www.pg.com/',
		position:
		{
			role: 'Data Science Intern',
			startDate: '2018-05-01',
			endDate: '2019-05-01'
		},
		description: [
			'Developed data pipelines in **Python** to analyze web traffic, achieving a **15% increase in conversions** with the same budget.',
			'Engineered **real-time telemetry dashboards** to visualize marketing metrics and enable data-driven performance tracking.',
			'Automated web performance audits in **JavaScript**, resulting in a **3-5 second reduction in page load times** across brand sites.'
		],
	}
];

export const skills = {
	languagesAndFrameworks: [
		{ label: 'TypeScript', icon: 'logos:typescript-icon' },
		{ label: 'Python', icon: 'logos:python' },
		{ label: 'SQL', icon: 'logos:postgresql' },
		{ label: 'React', icon: 'logos:react' },
		{ label: 'SvelteKit', icon: 'logos:svelte-icon' },
		{ label: 'FastAPI', icon: 'logos:fastapi-icon' },
		{ label: 'Next.js', icon: 'logos:nextjs-icon' },
		{ label: 'Node.js', icon: 'logos:nodejs-icon' }
	],
	infrastructureAndAI: [
		{ label: 'PostgreSQL', icon: 'logos:postgresql' },
		{ label: 'Redis', icon: 'logos:redis' },
		{ label: 'AWS', icon: 'logos:aws' },
		{ label: 'Docker', icon: 'logos:docker-icon' },
		{ label: 'LLM Integration', icon: 'mdi:robot-assistant' },
		{ label: 'Vector Databases', icon: 'mdi:database-search' }
	]
};