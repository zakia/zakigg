const GRID_SPACING_KEY = 'zaki.gg:grid-spacing';
const GRID_DOT_SIZE_KEY = 'zaki.gg:grid-dot-size';

export const DEFAULT_GRID_SPACING = 64;
export const DEFAULT_GRID_DOT_SIZE = 2;

const state = $state({
	spacing: DEFAULT_GRID_SPACING,
	dotSize: DEFAULT_GRID_DOT_SIZE,
	ready: false
});

let initialized = false;

export function useGridSettings() {
	$effect(() => {
		if (initialized) return;
		initialized = true;

		state.spacing = readNumber(GRID_SPACING_KEY, DEFAULT_GRID_SPACING, 24, 112);
		state.dotSize = readNumber(GRID_DOT_SIZE_KEY, DEFAULT_GRID_DOT_SIZE, 0, 6);
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

	function reset() {
		setSpacing(DEFAULT_GRID_SPACING);
		setDotSize(DEFAULT_GRID_DOT_SIZE);
	}

	return {
		get spacing() {
			return state.spacing;
		},
		get dotSize() {
			return state.dotSize;
		},
		get ready() {
			return state.ready;
		},
		setSpacing,
		setDotSize,
		reset
	};
}

function applyGridSettings() {
	document.documentElement.style.setProperty('--grid-spacing', `${state.spacing}px`);
	document.documentElement.style.setProperty('--grid-dot-size', `${state.dotSize}px`);
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

function persist(key: string, value: number) {
	try {
		localStorage.setItem(key, String(value));
	} catch {
		// The live setting still works when storage is unavailable.
	}
}

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}
