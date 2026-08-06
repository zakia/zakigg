import { env } from '$env/dynamic/public';

// Minimal surface of the Google Identity Services script we use.
type GoogleAccountsId = {
	initialize(config: {
		client_id: string;
		callback: (response: { credential: string }) => void;
	}): void;
	renderButton(
		container: HTMLElement,
		options: { type?: string; theme?: string; size?: string; text?: string; shape?: string }
	): void;
};

declare global {
	interface Window {
		google?: { accounts?: { id?: GoogleAccountsId } };
	}
}

const GIS_SRC = 'https://accounts.google.com/gsi/client';

let scriptPromise: Promise<GoogleAccountsId> | null = null;

function loadGis(): Promise<GoogleAccountsId> {
	scriptPromise ??= new Promise((resolve, reject) => {
		const existing = window.google?.accounts?.id;
		if (existing) return resolve(existing);

		const script = document.createElement('script');
		script.src = GIS_SRC;
		script.async = true;
		script.onload = () => {
			const id = window.google?.accounts?.id;
			if (id) resolve(id);
			else reject(new Error('Google Identity Services failed to initialize'));
		};
		script.onerror = () => {
			scriptPromise = null;
			reject(new Error('Failed to load Google Identity Services'));
		};
		document.head.append(script);
	});

	return scriptPromise;
}

// Renders the official Google button into `container`; `onCredential` receives
// the ID-token credential once the user completes sign-in.
export async function renderGoogleSignInButton(
	container: HTMLElement,
	onCredential: (credential: string) => void
): Promise<void> {
	const clientId = env.PUBLIC_GOOGLE_CLIENT_ID;

	if (!clientId) throw new Error('Sync is not configured (missing Google client id)');

	const gis = await loadGis();

	gis.initialize({ client_id: clientId, callback: ({ credential }) => onCredential(credential) });
	gis.renderButton(container, {
		type: 'standard',
		theme: 'outline',
		size: 'medium',
		shape: 'pill'
	});
}
