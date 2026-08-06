const hues = [
	{ label: 'red', value: 25 },
	{ label: 'pink', value: 350 },
	{ label: 'purple', value: 310 },
	{ label: 'violet', value: 290 },
	{ label: 'indigo', value: 270 },
	{ label: 'blue', value: 240 },
	{ label: 'green', value: 145 },
	{ label: 'lime', value: 125 },
	{ label: 'yellow', value: 100 },
	{ label: 'orange', value: 75 }
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
		const y = e?.clientY ?? 0;
		document.documentElement.style.setProperty('--transition-x', `${x}px`);
		document.documentElement.style.setProperty('--transition-y', `${y}px`);

		if (!document.startViewTransition) {
			setTheme(newTheme);
			return;
		}

		document.startViewTransition(() => {
			setTheme(newTheme);
		});
	};

	const toggleHue = () => {
		const currentIndex = hues.findIndex((h) => h.value === parseInt(hue));
		const nextIndex = currentIndex === hues.length - 1 ? 0 : currentIndex + 1;
		setHue(hues[nextIndex].value.toString());
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
		setHue,
		toggleHue
	};
};
