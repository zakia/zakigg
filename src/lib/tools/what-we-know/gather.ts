// Client-side passive data gathering for /what-we-know.
// Every field is optional — browsers vary wildly and many APIs are experimental.

export type PassiveField = {
	key: string;
	label: string;
	value: string;
	explanation: string;
	creepy?: boolean;
	group: 'identity' | 'hardware' | 'display' | 'network' | 'environment' | 'provenance' | 'gpu';
};

type UaInfo = { browser: string; os: string; raw: string };

function parseUa(ua: string): UaInfo {
	let browser = 'Unknown';
	let os = 'Unknown';

	if (/Edg\//.test(ua)) browser = 'Edge';
	else if (/OPR\/|Opera/.test(ua)) browser = 'Opera';
	else if (/Firefox\//.test(ua)) browser = 'Firefox';
	else if (/Chrome\//.test(ua)) browser = 'Chrome';
	else if (/Safari\//.test(ua)) browser = 'Safari';

	const versionMatch =
		ua.match(/Edg\/([\d.]+)/) ||
		ua.match(/OPR\/([\d.]+)/) ||
		ua.match(/Firefox\/([\d.]+)/) ||
		ua.match(/Chrome\/([\d.]+)/) ||
		ua.match(/Version\/([\d.]+).*Safari/);
	if (versionMatch) browser += ` ${versionMatch[1].split('.')[0]}`;

	if (/iPhone|iPad|iPod/.test(ua)) os = /iPad/.test(ua) ? 'iPadOS' : 'iOS';
	else if (/Android/.test(ua)) os = 'Android';
	else if (/Mac OS X|Macintosh/.test(ua)) os = 'macOS';
	else if (/Windows/.test(ua)) os = 'Windows';
	else if (/Linux/.test(ua)) os = 'Linux';
	else if (/CrOS/.test(ua)) os = 'ChromeOS';

	return { browser, os, raw: ua };
}

export function deviceClass(touchPoints: number, width: number): string {
	if (touchPoints > 0 && width < 640) return 'Mobile phone';
	if (touchPoints > 0 && width < 1024) return 'Tablet';
	if (touchPoints > 0) return 'Touch device';
	return 'Desktop / laptop';
}

function colorGamut(): string {
	if (window.matchMedia('(color-gamut: rec2020)').matches) return 'rec2020 (HDR-wide)';
	if (window.matchMedia('(color-gamut: p3)').matches) return 'p3 (wide)';
	if (window.matchMedia('(color-gamut: srgb)').matches) return 'sRGB';
	return 'Unknown';
}

function getWebGlInfo(): { vendor: string | null; renderer: string | null } {
	try {
		const canvas = document.createElement('canvas');
		const gl = (canvas.getContext('webgl') ||
			canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
		if (!gl) return { vendor: null, renderer: null };
		const ext = gl.getExtension('WEBGL_debug_renderer_info');
		if (ext) {
			return {
				vendor: gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) as string,
				renderer: gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) as string
			};
		}
		return {
			vendor: gl.getParameter(gl.VENDOR) as string,
			renderer: gl.getParameter(gl.RENDERER) as string
		};
	} catch {
		return { vendor: null, renderer: null };
	}
}

function hasStorage(type: 'localStorage' | 'sessionStorage'): boolean {
	try {
		const storage = window[type];
		const key = '__probe__';
		storage.setItem(key, '1');
		storage.removeItem(key);
		return true;
	} catch {
		return false;
	}
}

function hasIndexedDb(): boolean {
	try {
		return typeof indexedDB !== 'undefined';
	} catch {
		return false;
	}
}

function prefersColorScheme(): string {
	if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
	if (window.matchMedia('(prefers-color-scheme: light)').matches) return 'light';
	return 'no-preference';
}

function prefersReducedMotion(): string {
	return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'reduce' : 'no-preference';
}

function pwaInstalled(): string {
	if (window.matchMedia('(display-mode: standalone)').matches) return 'Installed (standalone)';
	return 'Running in browser tab';
}

function referrerInfo(): string {
	const r = document.referrer;
	if (!r) return 'Direct — no referrer';
	try {
		const url = new URL(r);
		if (url.origin === window.location.origin) return 'Same site';
		return url.hostname;
	} catch {
		return r;
	}
}

function fmtBool(v: boolean | undefined | null, yes = 'Yes', no = 'No'): string {
	if (v === true) return yes;
	if (v === false) return no;
	return '—';
}

function fmtNum(v: number | undefined | null, suffix = ''): string {
	if (v === undefined || v === null || Number.isNaN(v)) return '—';
	return `${v}${suffix}`;
}

export function gatherPassiveData(): PassiveField[] {
	const fields: PassiveField[] = [];
	const push = (f: PassiveField) => fields.push(f);

	// Identity & locale
	const ua = parseUa(navigator.userAgent);
	push({
		key: 'browser',
		label: 'Browser',
		value: ua.browser,
		explanation: 'Parsed from navigator.userAgent.',
		group: 'identity'
	});
	push({
		key: 'os',
		label: 'Operating system',
		value: ua.os,
		explanation: 'Parsed from navigator.userAgent.',
		group: 'identity'
	});
	push({
		key: 'language',
		label: 'Primary language',
		value: navigator.language || '—',
		explanation: 'navigator.language — your preferred UI language.',
		group: 'identity'
	});
	push({
		key: 'languages',
		label: 'All languages',
		value: (navigator.languages || []).join(', ') || '—',
		explanation: 'navigator.languages — every language you accept, in order.',
		group: 'identity'
	});
	try {
		const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
		push({
			key: 'timezone',
			label: 'Time zone',
			value: tz,
			explanation:
				'Intl.DateTimeFormat().resolvedOptions().timeZone — reveals your rough location even without geolocation.',
			creepy: true,
			group: 'identity'
		});
	} catch {
		/* ignore */
	}
	push({
		key: 'local-time',
		label: 'Local time',
		value: new Date().toLocaleString(),
		explanation: 'Computed from your system clock + time zone.',
		group: 'identity'
	});

	// Hardware
	push({
		key: 'cpu',
		label: 'CPU cores',
		value: fmtNum(navigator.hardwareConcurrency),
		explanation: 'navigator.hardwareConcurrency — number of logical cores.',
		group: 'hardware'
	});
	const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
	push({
		key: 'memory',
		label: 'Device memory',
		value: deviceMemory ? `${deviceMemory} GB (approx)` : '—',
		explanation:
			'navigator.deviceMemory — Chrome/Edge only. Rounded to nearest power of two for privacy.',
		group: 'hardware'
	});
	push({
		key: 'touch',
		label: 'Max touch points',
		value: fmtNum(navigator.maxTouchPoints),
		explanation: 'navigator.maxTouchPoints — 0 on most desktops, 5+ on touchscreens.',
		group: 'hardware'
	});

	// Display
	push({
		key: 'screen',
		label: 'Screen size',
		value: `${screen.width} × ${screen.height}`,
		explanation: 'screen.width × screen.height — your physical screen resolution.',
		group: 'display'
	});
	push({
		key: 'dpr',
		label: 'Pixel density',
		value: `${window.devicePixelRatio}x`,
		explanation: 'window.devicePixelRatio — retina / HiDPI indicator.',
		group: 'display'
	});
	push({
		key: 'color-depth',
		label: 'Color depth',
		value: `${screen.colorDepth}-bit`,
		explanation: 'screen.colorDepth — bits per pixel.',
		group: 'display'
	});
	push({
		key: 'color-gamut',
		label: 'Color gamut',
		value: colorGamut(),
		explanation: "matchMedia('(color-gamut: p3)') — wider gamut = newer hardware.",
		group: 'display'
	});

	// Network
	type NetInfo = {
		effectiveType?: string;
		downlink?: number;
		rtt?: number;
		saveData?: boolean;
		type?: string;
	};
	const conn = (navigator as Navigator & { connection?: NetInfo }).connection;
	push({
		key: 'conn-type',
		label: 'Connection type',
		value: conn?.effectiveType ?? '—',
		explanation: 'navigator.connection.effectiveType — slow-2g, 2g, 3g, 4g.',
		group: 'network'
	});
	push({
		key: 'downlink',
		label: 'Downlink',
		value: conn?.downlink ? `${conn.downlink} Mbps` : '—',
		explanation: 'navigator.connection.downlink — estimated bandwidth.',
		group: 'network'
	});
	push({
		key: 'rtt',
		label: 'Round-trip time',
		value: conn?.rtt !== undefined ? `${conn.rtt} ms` : '—',
		explanation: 'navigator.connection.rtt — estimated latency.',
		group: 'network'
	});
	push({
		key: 'save-data',
		label: 'Data-saver',
		value: fmtBool(conn?.saveData, 'On', 'Off'),
		explanation: 'navigator.connection.saveData — user wants reduced data usage.',
		group: 'network'
	});
	push({
		key: 'online',
		label: 'Online',
		value: fmtBool(navigator.onLine),
		explanation: 'navigator.onLine — browser thinks you have network.',
		group: 'network'
	});

	// Environment
	push({
		key: 'cookies',
		label: 'Cookies enabled',
		value: fmtBool(navigator.cookieEnabled),
		explanation: 'navigator.cookieEnabled',
		group: 'environment'
	});
	push({
		key: 'localstorage',
		label: 'localStorage',
		value: fmtBool(hasStorage('localStorage'), 'Available', 'Blocked'),
		explanation: 'Probed by writing a test key.',
		group: 'environment'
	});
	push({
		key: 'indexeddb',
		label: 'IndexedDB',
		value: fmtBool(hasIndexedDb(), 'Available', 'Blocked'),
		explanation: 'typeof indexedDB !== "undefined"',
		group: 'environment'
	});
	const dnt =
		(navigator as Navigator & { doNotTrack?: string | null }).doNotTrack ??
		(window as Window & { doNotTrack?: string | null }).doNotTrack ??
		null;
	push({
		key: 'dnt',
		label: 'Do-not-track',
		value: dnt === '1' ? 'Requested' : dnt === '0' ? 'Off' : 'Not set',
		explanation: 'navigator.doNotTrack — most sites ignore this anyway.',
		group: 'environment'
	});
	push({
		key: 'color-scheme',
		label: 'Prefers color scheme',
		value: prefersColorScheme(),
		explanation: "matchMedia('(prefers-color-scheme: dark)')",
		group: 'environment'
	});
	push({
		key: 'reduced-motion',
		label: 'Prefers reduced motion',
		value: prefersReducedMotion(),
		explanation: "matchMedia('(prefers-reduced-motion: reduce)')",
		group: 'environment'
	});
	push({
		key: 'pdf-viewer',
		label: 'PDF viewer',
		value: fmtBool(
			(navigator as Navigator & { pdfViewerEnabled?: boolean }).pdfViewerEnabled,
			'Enabled',
			'Disabled'
		),
		explanation: 'navigator.pdfViewerEnabled',
		group: 'environment'
	});
	push({
		key: 'pwa',
		label: 'Display mode',
		value: pwaInstalled(),
		explanation: "matchMedia('(display-mode: standalone)') — whether this is a PWA install.",
		group: 'environment'
	});

	// Provenance
	push({
		key: 'referrer',
		label: 'Came from',
		value: referrerInfo(),
		explanation: 'document.referrer — which site linked you here.',
		creepy: true,
		group: 'provenance'
	});
	push({
		key: 'history-length',
		label: 'History depth',
		value: fmtNum(window.history.length),
		explanation: "window.history.length — pages in this tab's history stack.",
		group: 'provenance'
	});
	push({
		key: 'current-url',
		label: 'Current URL',
		value: window.location.href,
		explanation: 'window.location.href',
		group: 'provenance'
	});

	// GPU
	const webgl = getWebGlInfo();
	push({
		key: 'gpu-vendor',
		label: 'GPU vendor',
		value: webgl.vendor ?? '—',
		explanation: 'WebGL WEBGL_debug_renderer_info — many browsers now spoof this for privacy.',
		creepy: true,
		group: 'gpu'
	});
	push({
		key: 'gpu-renderer',
		label: 'GPU model',
		value: webgl.renderer ?? '—',
		explanation:
			'WebGL WEBGL_debug_renderer_info — reveals your specific graphics chip when unmasked.',
		creepy: true,
		group: 'gpu'
	});

	return fields;
}

export const GROUP_META: Record<PassiveField['group'], { label: string; icon: string }> = {
	identity: { label: 'Identity & locale', icon: 'lucide:fingerprint' },
	hardware: { label: 'Hardware', icon: 'lucide:cpu' },
	display: { label: 'Display', icon: 'lucide:monitor' },
	network: { label: 'Network', icon: 'lucide:wifi' },
	environment: { label: 'Environment', icon: 'lucide:settings' },
	provenance: { label: 'Where you came from', icon: 'lucide:route' },
	gpu: { label: 'Graphics', icon: 'lucide:gpu' }
};
