export type User = {
	id: string;
	email: string | null;
	name: string | null;
	image: string | null;
};

export type Session = {
	user: User;
	expires: number;
};

export type AuthProviderCredentials = {
	google: { credential: string };
};

export type AuthProviderId = keyof AuthProviderCredentials;
