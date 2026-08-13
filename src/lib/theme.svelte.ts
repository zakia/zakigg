export const themeHues = [
	{ label: 'red', value: 25 },
	{ label: 'orange', value: 50 },
	{ label: 'green', value: 145 },
	{ label: 'blue', value: 240 },
	{ label: 'violet', value: 290 }
];

let theme = $state('light');
let hue = $state('145');
let themeColorFrame: number | undefined;

const syncSystemThemeColor = () => {
	if (themeColorFrame) cancelAnimationFrame(themeColorFrame);

	themeColorFrame = requestAnimationFrame(() => {
		const meta = document.querySelector<HTMLMetaElement>('#theme-color');
		if (!meta) return;

		const backgroundColor = getComputedStyle(document.body).backgroundColor;
		const canvas = document.createElement('canvas');
		canvas.width = 1;
		canvas.height = 1;

		const context = canvas.getContext('2d', { willReadFrequently: true });
		if (!context) {
			meta.content = backgroundColor;
			return;
		}

		context.fillStyle = backgroundColor;
		context.fillRect(0, 0, 1, 1);
		const [red, green, blue] = context.getImageData(0, 0, 1, 1).data;
		meta.content = `rgb(${red} ${green} ${blue})`;
	});
};

export const useTheme = () => {
	$effect(() => {
		theme = document.documentElement.dataset.theme || 'light';
		hue = document.documentElement.style.getPropertyValue('--hue') || '145';
		syncSystemThemeColor();
	});

	const setTheme = (newTheme: string) => {
		localStorage.setItem('theme', newTheme);
		document.documentElement.dataset.theme = newTheme;
		theme = newTheme;
		syncSystemThemeColor();
	};

	const setHue = (newHue: string) => {
		localStorage.setItem('hue', newHue);
		document.documentElement.style.setProperty('--hue', newHue);
		hue = newHue;
		syncSystemThemeColor();
	};

	const toggle = (e?: MouseEvent) => {
		const newTheme = theme === 'light' ? 'dark' : 'light';

		const x = e?.clientX ?? window.innerWidth / 2;
		const y = e?.clientY ?? window.innerHeight / 2;
		const originX = `${(x / window.innerWidth) * 100}%`;
		const originY = `${(y / window.innerHeight) * 100}%`;

		if (!document.startViewTransition) {
			setTheme(newTheme);
			return;
		}

		const transition = document.startViewTransition(async () => {
			setTheme(newTheme);
		});

		void transition.ready
			.then(() => {
				document.documentElement.animate(
					{
						clipPath: [
							`circle(0 at ${originX} ${originY})`,
							`circle(150% at ${originX} ${originY})`
						]
					},
					{
						duration: 500,
						easing: 'ease-out',
						pseudoElement: '::view-transition-new(root)'
					} as KeyframeAnimationOptions & { pseudoElement: string }
				);
			})
			.catch(() => {});
	};

	return {
		get theme() {
			return theme;
		},
		get hue() {
			return hue;
		},
		setTheme,
		toggle,
		setHue
	};
};
