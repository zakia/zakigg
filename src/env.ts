import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
	ADMIN_PASSWORD: { schema: (input) => input ?? '' },
	AUTH_SESSION_SECRET: { schema: (input) => input ?? '' },
	GCS_BUCKET: { schema: (input) => input ?? '' },
	GCP_PROJECT_ID: { schema: (input) => input ?? '' }
});
