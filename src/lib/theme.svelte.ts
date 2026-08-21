export const themeHues = [
	{ label: 'red', value: 25 },
	{ label: 'orange', value: 50 },
	{ label: 'green', value: 145 },
	{ label: 'blue', value: 240 },
	{ label: 'violet', value: 290 }
];

type ThemeMode = 'light' | 'dark';

const syncSystemThemeColor = () => {
	const meta = document.querySelector<HTMLMetaElement>('#theme-color');
	if (!meta) return;

	meta.content = getComputedStyle(document.body).backgroundColor;
};

class ThemeController {
	#mode = $state<ThemeMode>('light');
	#hue = $state('145');
	#initialized = false;

	get mode() {
		return this.#mode;
	}

	get hue() {
		return this.#hue;
	}

	initialize = () => {
		if (this.#initialized || typeof document === 'undefined') return;
		this.#initialized = true;

		this.#mode = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
		this.#hue = document.documentElement.style.getPropertyValue('--hue').trim() || '145';
		syncSystemThemeColor();
	};

	setTheme = (newTheme: ThemeMode) => {
		localStorage.setItem('theme', newTheme);
		document.documentElement.dataset.theme = newTheme;
		this.#mode = newTheme;
		syncSystemThemeColor();
	};

	setHue = (newHue: string) => {
		localStorage.setItem('hue', newHue);
		document.documentElement.style.setProperty('--hue', newHue);
		this.#hue = newHue;
		syncSystemThemeColor();
	};

	toggle = (event?: MouseEvent) => {
		const newTheme = this.#mode === 'light' ? 'dark' : 'light';

		const x = event?.clientX ?? window.innerWidth / 2;
		const y = event?.clientY ?? window.innerHeight / 2;
		const originX = `${(x / window.innerWidth) * 100}%`;
		const originY = `${(y / window.innerHeight) * 100}%`;

		if (!document.startViewTransition) {
			this.setTheme(newTheme);
			return;
		}

		const transition = document.startViewTransition(async () => {
			this.setTheme(newTheme);
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
}

export const theme = new ThemeController();
