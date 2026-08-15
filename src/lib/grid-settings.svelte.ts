const GRID_SPACING_KEY = 'zaki.gg:grid-spacing';
const GRID_DOT_SIZE_KEY = 'zaki.gg:grid-dot-size';
const GRID_FIXED_KEY = 'zaki.gg:grid-fixed';

export const DEFAULT_GRID_SPACING = 64;
export const DEFAULT_GRID_DOT_SIZE = 2;
export const DEFAULT_GRID_FIXED = false;

const state = $state({
	spacing: DEFAULT_GRID_SPACING,
	dotSize: DEFAULT_GRID_DOT_SIZE,
	fixed: DEFAULT_GRID_FIXED,
	ready: false
});

let initialized = false;

export function useGridSettings() {
	$effect(() => {
		if (initialized) return;
		initialized = true;

		state.spacing = readNumber(GRID_SPACING_KEY, DEFAULT_GRID_SPACING, 24, 112);
		state.dotSize = readNumber(GRID_DOT_SIZE_KEY, DEFAULT_GRID_DOT_SIZE, 0, 6);
		state.fixed = readBoolean(GRID_FIXED_KEY, DEFAULT_GRID_FIXED);
		state.ready = true;
		applyGridSettings();
	});

	function setSpacing(value: number) {
		state.spacing = clamp(value, 24, 112);
		persist(GRID_SPACING_KEY, state.spacing);
		applyGridSettings();
	}

	function setDotSize(value: number) {
		state.dotSize = clamp(value, 0, 6);
		persist(GRID_DOT_SIZE_KEY, state.dotSize);
		applyGridSettings();
	}

	function setFixed(value: boolean) {
		state.fixed = value;
		persist(GRID_FIXED_KEY, value);
		applyGridSettings();
	}

	function reset() {
		setSpacing(DEFAULT_GRID_SPACING);
		setDotSize(DEFAULT_GRID_DOT_SIZE);
		setFixed(DEFAULT_GRID_FIXED);
	}

	return {
		get spacing() {
			return state.spacing;
		},
		get dotSize() {
			return state.dotSize;
		},
		get fixed() {
			return state.fixed;
		},
		get ready() {
			return state.ready;
		},
		setSpacing,
		setDotSize,
		setFixed,
		reset
	};
}

function applyGridSettings() {
	document.documentElement.style.setProperty('--grid-spacing', `${state.spacing}px`);
	document.documentElement.style.setProperty('--grid-dot-size', `${state.dotSize}px`);
	document.documentElement.style.setProperty(
		'--grid-background-attachment',
		state.fixed ? 'fixed' : 'scroll'
	);
}

function readNumber(key: string, fallback: number, min: number, max: number) {
	try {
		const stored = localStorage.getItem(key);
		if (stored === null) return fallback;

		const value = Number(stored);
		return Number.isFinite(value) && value >= min && value <= max ? value : fallback;
	} catch {
		return fallback;
	}
}

function readBoolean(key: string, fallback: boolean) {
	try {
		const stored = localStorage.getItem(key);
		return stored === null ? fallback : stored === 'true';
	} catch {
		return fallback;
	}
}

function persist(key: string, value: number | boolean) {
	try {
		localStorage.setItem(key, String(value));
	} catch {
		// The live setting still works when storage is unavailable.
	}
}

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}
