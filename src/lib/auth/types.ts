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
