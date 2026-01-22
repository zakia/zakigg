export const range = (start: number, stop: number, step = 1) => {
	return Array.from({ length: (stop - start) / step + 1 }, (_, i) => start + i * step);
};

export function hexToHSL(hex: string) {
	const c = hex.substring(1); // strip #
	const rgb = parseInt(c, 16); // convert rrggbb to decimal
	let r = (rgb >> 16) & 0xff; // extract red
	let g = (rgb >> 8) & 0xff; // extract green
	let b = (rgb >> 0) & 0xff; // extract blue

	const onColor = getContrastColor(r, g, b, 1);

	r /= 255;
	g /= 255;
	b /= 255;

	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	let h = 0;
	let s = 0;
	const l = (max + min) / 2;

	if (max == min) {
		h = s = 0; // achromatic
	} else {
		const d = max - min;
		s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
		switch (max) {
			case r:
				h = (g - b) / d + (g < b ? 6 : 0);
				break;
			case g:
				h = (b - r) / d + 2;
				break;
			case b:
				h = (r - g) / d + 4;
				break;
		}
		h /= 6;
	}

	return {
		h: Math.round(h * 360),
		s,
		l,
		onColor
	};
}

function getContrastColor(R: number, G: number, B: number, A: number) {
	const brightness = R * 0.299 + G * 0.587 + B * 0.114 + (1 - A) * 255;

	return brightness > 186 ? '#000000' : '#FFFFFF';
}

export function clamp(x: number, min = 0, max = 1): number {
	return Math.max(min, Math.min(x, max));
}

export const checkDistance = (x1: number, y1: number, x2: number, y2: number) => {
	return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
};

export const transformRange = (
	x: number,
	old_min: number,
	old_max: number,
	new_min = 0,
	new_max = 100
) => {
	return ((x - old_min) / (old_max - old_min)) * (new_max - new_min) + new_min;
};

export const formatDate = (date?: string) => {
	if (!date) return 'Present';

	return new Date(date).toLocaleString(undefined, {
		month: 'short',
		year: 'numeric'
	});
};
