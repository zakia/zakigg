import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';

const service = process.env.CLOUD_RUN_SERVICE || 'zakigg';
const region = process.env.GCP_REGION || 'northamerica-northeast2';

function gcloud(args) {
	const result = spawnSync('gcloud', args, {
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'inherit']
	});

	if (result.error) {
		if (result.error.code === 'ENOENT') {
			throw new Error('gcloud is required. Install the Google Cloud CLI before running dev.');
		}
		throw result.error;
	}

	if (result.status !== 0) {
		throw new Error(`gcloud exited with status ${result.status}`);
	}

	return result.stdout.trim();
}

function cloudRunEnvironment(serviceConfig) {
	const entries = serviceConfig.spec?.template?.spec?.containers?.[0]?.env ?? [];
	return Object.fromEntries(
		entries
			.filter((entry) => typeof entry.value === 'string')
			.map((entry) => [entry.name, entry.value])
	);
}

try {
	const project =
		process.env.GCP_PROJECT_ID || gcloud(['config', 'get-value', 'project', '--quiet']);

	if (!project || project === '(unset)') {
		throw new Error('No GCP project is configured. Run: gcloud config set project PROJECT_ID');
	}

	const serviceConfig = JSON.parse(
		gcloud([
			'run',
			'services',
			'describe',
			service,
			'--region',
			region,
			'--project',
			project,
			'--format=json'
		])
	);
	const cloudEnv = cloudRunEnvironment(serviceConfig);
	const devEnv = {
		...process.env,
		GCP_PROJECT_ID: cloudEnv.GCP_PROJECT_ID || project,
		NOTES_GCS_BUCKET: cloudEnv.NOTES_GCS_BUCKET,
		AUTH_ALLOWED_EMAIL: cloudEnv.AUTH_ALLOWED_EMAIL || cloudEnv.NOTES_SYNC_ALLOWED_EMAIL,
		PUBLIC_GOOGLE_CLIENT_ID: cloudEnv.PUBLIC_GOOGLE_CLIENT_ID,
		AUTH_SESSION_SECRET: randomBytes(32).toString('base64url')
	};
	const missing = [
		'GCP_PROJECT_ID',
		'NOTES_GCS_BUCKET',
		'AUTH_ALLOWED_EMAIL',
		'PUBLIC_GOOGLE_CLIENT_ID'
	].filter((name) => !devEnv[name]);

	if (missing.length > 0) {
		throw new Error(`Cloud Run is missing required configuration: ${missing.join(', ')}`);
	}

	console.log(`Loaded development configuration from Cloud Run service ${service}.`);
	console.log('Using an isolated, in-memory session signing key for this dev server.');

	const vite = spawn(
		'bun',
		['x', 'vite', 'dev', '--open', '--host', 'localhost', '--strictPort', ...process.argv.slice(2)],
		{
			env: devEnv,
			stdio: 'inherit'
		}
	);

	vite.on('error', (error) => {
		console.error(error.message);
		process.exitCode = 1;
	});
	vite.on('exit', (code, signal) => {
		if (signal) process.kill(process.pid, signal);
		else process.exitCode = code ?? 1;
	});
} catch (error) {
	console.error(error instanceof Error ? error.message : error);
	process.exitCode = 1;
}
