export type ExternalIdentity = {
	provider: string;
	subject: string;
	email: string | null;
	emailVerified: boolean;
	name: string | null;
	image: string | null;
};

export interface AuthProvider<Credential> {
	verify(credential: Credential): Promise<ExternalIdentity>;
}
