const hues = [
	{ label: 'red', value: 25 },
	{ label: 'pink', value: 350 },
	{ label: 'purple', value: 310 },
	{ label: 'violet', value: 290 },
	{ label: 'indigo', value: 270 },
	{ label: 'blue', value: 240 },
	// { label: 'cyan', value: 210, },
	// { label: 'teal', value: 185, },
	{ label: 'green', value: 145 },
	{ label: 'lime', value: 125 },
	{ label: 'yellow', value: 100 },
	{ label: 'orange', value: 75 }
];

let theme = $state('light');
let hue = $state('145');

export const useTheme = () => {
	$effect(() => {
		theme = document.documentElement.dataset.theme || 'light';
	});

	$effect(() => {
		hue = document.documentElement.style.getPropertyValue('--color-hue') || '145';
	});

	const setTheme = (newTheme: string) => {
		document.cookie = `theme=${newTheme}; path=/; max-age=31536000;`;
		console.log(document.cookie);
		document.documentElement.dataset.theme = newTheme;
		theme = newTheme;
	};

	const setHue = (newHue: string) => {
		document.cookie = `hue=${newHue}; path=/; max-age=31536000`;
		document.documentElement.style.setProperty('--color-hue', newHue);
		hue = newHue;
	};

	const toggle = () => {
		const css = document.createElement('style');
		css.appendChild(
			document.createTextNode(
				`* {
          -webkit-transition: none !important;
          -moz-transition: none !important;
          -o-transition: none !important;
          -ms-transition: none !important;
          transition: none !important;
        }`
			)
		);
		document.head.appendChild(css);

		setTheme(theme === 'light' ? 'dark' : 'light');

		// Force repaint
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const _ = window.getComputedStyle(css).opacity;
		document.head.removeChild(css);
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
