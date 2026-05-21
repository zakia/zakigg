import { query, getRequestEvent } from '$app/server';

type GeoInfo = {
	status: 'success' | 'fail' | 'skipped';
	message?: string;
	city?: string | null;
	region?: string | null;
	country?: string | null;
	country_code?: string | null;
	lat?: number | null;
	lng?: number | null;
	isp?: string | null;
	org?: string | null;
	as?: string | null;
	timezone?: string | null;
	zip?: string | null;
	mobile?: boolean | null;
	proxy?: boolean | null;
	hosting?: boolean | null;
};

export type ServerInfo = {
	ip: string;
	geo: GeoInfo;
	headers: Record<string, string>;
};

const HEADER_WHITELIST = [
	'user-agent',
	'accept',
	'accept-language',
	'accept-encoding',
	'referer',
	'dnt',
	'sec-fetch-site',
	'sec-fetch-mode',
	'sec-fetch-dest',
	'sec-fetch-user',
	'sec-ch-ua',
	'sec-ch-ua-mobile',
	'sec-ch-ua-platform',
	'sec-ch-ua-platform-version',
	'sec-ch-ua-model',
	'sec-ch-ua-arch',
	'sec-ch-ua-bitness',
	'sec-ch-ua-full-version-list',
	'priority',
	'upgrade-insecure-requests',
	'cf-ipcountry',
	'cf-ipcity',
	'x-forwarded-for',
	'x-real-ip'
];

function extractIp(request: Request, fallback: string): string {
	const xff = request.headers.get('x-forwarded-for');
	if (xff) {
		const first = xff.split(',')[0]?.trim();
		if (first) return first;
	}
	const cf = request.headers.get('cf-connecting-ip');
	if (cf) return cf;
	const realIp = request.headers.get('x-real-ip');
	if (realIp) return realIp;
	return fallback;
}

function isPrivateIp(ip: string): boolean {
	if (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1') return true;
	if (ip.startsWith('10.')) return true;
	if (ip.startsWith('192.168.')) return true;
	if (ip.startsWith('172.')) {
		const second = parseInt(ip.split('.')[1] ?? '', 10);
		if (second >= 16 && second <= 31) return true;
	}
	if (ip.startsWith('fc00:') || ip.startsWith('fd00:') || ip.startsWith('fe80:')) return true;
	return false;
}

async function lookupIp(ip: string): Promise<GeoInfo> {
	if (isPrivateIp(ip)) {
		return {
			status: 'skipped',
			message: 'Private / loopback IP — geolocation only works for public IPs.'
		};
	}

	try {
		const fields =
			'status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,mobile,proxy,hosting';
		const res = await fetch(`http://ip-api.com/json/${encodeURIComponent(ip)}?fields=${fields}`, {
			signal: AbortSignal.timeout(3_000)
		});
		if (!res.ok) {
			return { status: 'fail', message: `IP lookup HTTP ${res.status}` };
		}
		const json = (await res.json()) as {
			status: string;
			message?: string;
			country?: string;
			countryCode?: string;
			regionName?: string;
			city?: string;
			zip?: string;
			lat?: number;
			lon?: number;
			timezone?: string;
			isp?: string;
			org?: string;
			as?: string;
			mobile?: boolean;
			proxy?: boolean;
			hosting?: boolean;
		};
		if (json.status !== 'success') {
			return { status: 'fail', message: json.message ?? 'IP lookup failed' };
		}
		return {
			status: 'success',
			country: json.country ?? null,
			country_code: json.countryCode ?? null,
			region: json.regionName ?? null,
			city: json.city ?? null,
			zip: json.zip ?? null,
			lat: json.lat ?? null,
			lng: json.lon ?? null,
			timezone: json.timezone ?? null,
			isp: json.isp ?? null,
			org: json.org ?? null,
			as: json.as ?? null,
			mobile: json.mobile ?? null,
			proxy: json.proxy ?? null,
			hosting: json.hosting ?? null
		};
	} catch (err) {
		return {
			status: 'fail',
			message: err instanceof Error ? err.message : 'IP lookup error'
		};
	}
}

export const getServerInfo = query<ServerInfo>(async () => {
	const { request, getClientAddress } = getRequestEvent();
	const ip = extractIp(request, getClientAddress());

	const headers: Record<string, string> = {};
	for (const name of HEADER_WHITELIST) {
		const value = request.headers.get(name);
		if (value) headers[name] = value;
	}

	const geo = await lookupIp(ip);
	return { ip, geo, headers };
});
