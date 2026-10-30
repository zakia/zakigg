export const themeHues = [
	{ label: 'red', value: 25 },
	{ label: 'orange', value: 50 },
	{ label: 'green', value: 145 },
	{ label: 'blue', value: 240 },
	{ label: 'violet', value: 290 }
];

type ThemeMode = 'light' | 'dark';
type GridAppearance = {
	/** Null keeps the stylesheet's responsive spacing. */
	spacing: number | null;
	dotSize: number;
	fixed: boolean;
};

function rootProperty(name: string) {
	return typeof document === 'undefined'
		? ''
		: document.documentElement.style.getPropertyValue(name).trim();
}

function rootNumber(name: string, min: number, max: number) {
	const raw = rootProperty(name);
	const value = Number(raw.endsWith('px') ? raw.slice(0, -2) : raw);
	return raw && Number.isFinite(value) && value >= min && value <= max ? value : null;
}

function setRootProperty(name: string, value: string | null) {
	if (typeof document === 'undefined') return;
	if (value === null) document.documentElement.style.removeProperty(name);
	else document.documentElement.style.setProperty(name, value);
}

function persist(key: string, value: string | number | boolean | null) {
	try {
		if (value === null) localStorage.removeItem(key);
		else localStorage.setItem(key, String(value));
	} catch {
		// Appearance still works when browser storage is unavailable.
	}
}

const syncSystemThemeColor = () => {
	if (typeof document === 'undefined' || !document.body) return;
	const meta = document.querySelector<HTMLMetaElement>('#theme-color');
	if (!meta) return;

	meta.content = getComputedStyle(document.body).backgroundColor;
};

class ThemeController {
	#mode = $state<ThemeMode>(
		typeof document !== 'undefined' && document.documentElement.dataset.theme === 'dark'
			? 'dark'
			: 'light'
	);
	#hue = $state(String(rootNumber('--hue', 0, 360) ?? 145));
	#grid = $state<GridAppearance>({
		spacing: rootNumber('--grid-spacing', 24, 112),
		dotSize: rootNumber('--grid-dot-size', 0, 6) ?? 2,
		fixed: rootProperty('--grid-background-attachment') === 'fixed'
	});

	constructor() {
		if (typeof document !== 'undefined') {
			syncSystemThemeColor();
		}
	}

	get mode() {
		return this.#mode;
	}

	get hue() {
		return this.#hue;
	}

	get grid(): Readonly<GridAppearance> {
		return this.#grid;
	}

	setTheme = (newTheme: ThemeMode) => {
		if (typeof document !== 'undefined') document.documentElement.dataset.theme = newTheme;
		this.#mode = newTheme;
		persist('theme', newTheme);
		syncSystemThemeColor();
	};

	setHue = (newHue: string) => {
		const hue = Number(newHue);
		if (!newHue.trim() || !Number.isFinite(hue) || hue < 0 || hue > 360) return;
		const value = String(hue);
		if (value === this.#hue) return;

		setRootProperty('--hue', value);
		this.#hue = value;
		persist('hue', value);
		syncSystemThemeColor();
	};

	setGrid = ({ spacing, dotSize, fixed }: Partial<GridAppearance>) => {
		if (spacing === null || (spacing !== undefined && Number.isFinite(spacing))) {
			this.#grid.spacing = spacing === null ? null : Math.min(112, Math.max(24, spacing));
			setRootProperty(
				'--grid-spacing',
				this.#grid.spacing === null ? null : `${this.#grid.spacing}px`
			);
			persist('zaki.gg:grid-spacing', this.#grid.spacing);
		}
		if (dotSize !== undefined && Number.isFinite(dotSize)) {
			this.#grid.dotSize = Math.min(6, Math.max(0, dotSize));
			setRootProperty('--grid-dot-size', `${this.#grid.dotSize}px`);
			persist('zaki.gg:grid-dot-size', this.#grid.dotSize);
		}
		if (typeof fixed === 'boolean') {
			this.#grid.fixed = fixed;
			setRootProperty('--grid-background-attachment', fixed ? 'fixed' : 'scroll');
			persist('zaki.gg:grid-fixed', fixed);
		}
	};

	resetGrid = () => this.setGrid({ spacing: null, dotSize: 2, fixed: false });

	toggle = (event?: MouseEvent) => {
		const newTheme = this.#mode === 'light' ? 'dark' : 'light';

		const x = event?.clientX ?? window.innerWidth / 2;
		const y = event?.clientY ?? window.innerHeight / 2;
		const originX = `${(x / window.innerWidth) * 100}%`;
		const originY = `${(y / window.innerHeight) * 100}%`;

		if (
			!document.startViewTransition ||
			window.matchMedia('(prefers-reduced-motion: reduce)').matches
		) {
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
