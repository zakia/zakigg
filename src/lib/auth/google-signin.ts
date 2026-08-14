import { env } from '$env/dynamic/public';

type GoogleAccountsId = {
	initialize(config: {
		client_id: string;
		callback: (response: { credential: string }) => void;
	}): void;
	renderButton(
		container: HTMLElement,
		options: {
			type?: 'standard' | 'icon';
			theme?: 'outline' | 'outline_dark' | 'filled_blue' | 'filled_black';
			size?: 'small' | 'medium' | 'large';
			text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
			shape?: 'rectangular' | 'pill' | 'circle' | 'square';
			logo_alignment?: 'left' | 'center';
		}
	): void;
};

type GoogleButtonOptions = {
	colorScheme: 'light' | 'dark';
};

declare global {
	interface Window {
		google?: { accounts?: { id?: GoogleAccountsId } };
	}
}

const GIS_SRC = 'https://accounts.google.com/gsi/client';

let scriptPromise: Promise<GoogleAccountsId> | null = null;
let initializedClientId: string | null = null;
let credentialHandler: ((credential: string) => void) | null = null;

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

export async function renderGoogleSignInButton(
	container: HTMLElement,
	onCredential: (credential: string) => void,
	options: GoogleButtonOptions
): Promise<void> {
	const clientId = env.PUBLIC_GOOGLE_CLIENT_ID;

	if (!clientId) throw new Error('Authentication is not configured');

	const gis = await loadGis();
	credentialHandler = onCredential;

	if (initializedClientId !== clientId) {
		gis.initialize({
			client_id: clientId,
			callback: ({ credential }) => credentialHandler?.(credential)
		});
		initializedClientId = clientId;
	}

	gis.renderButton(container, {
		type: 'standard',
		theme: options.colorScheme === 'dark' ? 'outline_dark' : 'outline',
		size: 'large',
		text: 'continue_with',
		shape: 'pill',
		logo_alignment: 'left'
	});
}
