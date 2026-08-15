# Better Auth Proposal

**Status:** Deferred / backburner  
**Decision date:** August 14, 2026  
**Current decision:** Keep the existing single-admin Google account gate for now. Do not add public registration or email/password authentication until this proposal is resumed.

## Summary

When the product needs general user accounts, adopt [Better Auth](https://better-auth.com/) inside the existing SvelteKit application and store authentication data in Cloud SQL for PostgreSQL. Continue using Firestore for notes and product metadata, and Cloud Storage for large content and assets.

This approach keeps the initial implementation small while avoiding dependence on a proprietary identity database. Better Auth is MIT licensed, PostgreSQL is portable, and application code will depend on a small internal authentication interface rather than Better Auth-specific types.

## Why This Direction

The main requirement is portability. We should be able to move away from GCP or replace the authentication library without rewriting the rest of the product.

Firebase Authentication and Identity Platform provide a strong managed experience, but credentials, sessions, and provider identities live behind Google-specific APIs. A self-built password system gives maximum control but makes us responsible for every security-sensitive authentication behavior.

Better Auth with PostgreSQL provides a useful middle ground:

- Open-source authentication implementation under the MIT license.
- First-party SvelteKit and PostgreSQL support.
- Email/password, Google OAuth, account linking, session management, verification, and recovery flows.
- Authentication records stored in a database we control.
- Standard PostgreSQL export and restore tools for migrations between providers.
- No separate authentication microservice required initially.

## Proposed Architecture

```text
Browser / PWA
    |
    v
SvelteKit application on Cloud Run
    |-- Better Auth
    |      `-- Cloud SQL for PostgreSQL
    |          users, identities, credentials, sessions, verification tokens
    |
    |-- Firestore
    |      notes and application metadata
    |
    `-- Cloud Storage
           note bodies, uploads, and other large objects
```

Better Auth should run in the existing SvelteKit service. A separate Go or authentication service would add another deployment, network boundary, and operational surface without improving portability at the current scale.

## Ownership Boundaries

### Better Auth and PostgreSQL

- Users and normalized email addresses.
- Password credentials and social-provider identities.
- Session records and revocation.
- Email verification and password-reset tokens.
- Account linking.

### Application

- Login, signup, recovery, and profile UI.
- Registration policy and authorization decisions.
- Stable application user IDs.
- Notes, publishing permissions, and product behavior.
- Email delivery integration.

### Firestore and Cloud Storage

- Existing note metadata remains in Firestore.
- Existing document bodies and assets remain in Cloud Storage.
- Neither store should contain plaintext passwords, password hashes, or raw session tokens.

## Portability Boundary

Application code should not use Better Auth user and session types outside the authentication adapter. Define stable application-owned types and functions, for example:

```ts
type AppUser = {
	id: string;
	email: string;
	name: string | null;
};

interface AuthService {
	getSession(request: Request): Promise<AppSession | null>;
	requireUser(request: Request): Promise<AppUser>;
	signOut(request: Request): Promise<Response>;
}
```

Routes, note services, and UI should depend on this boundary. If Better Auth is replaced later, only the adapter and authentication routes should need substantial changes.

The PostgreSQL schema must be managed through checked-in migrations. Regular backups and a tested `pg_dump`/restore procedure are part of the production design.

## Identity Model and Existing Data

The application must own a stable user ID that is independent of Google, Better Auth, or any other provider.

The current admin's notes are keyed using the Google subject identifier. Before enabling the new system:

1. Create a permanent internal user ID for the existing admin.
2. Associate the existing Google identity with that internal user.
3. Associate the future email/password credential with the same user.
4. Migrate existing note ownership, or introduce an explicit legacy-to-internal ID mapping.
5. Verify that both sign-in methods resolve to the same notes and permissions.

New accounts should receive random, provider-independent IDs from the start.

## Password and Session Security

- Configure Better Auth to use Argon2id from the beginning rather than relying on its default scrypt implementation.
- Store only standard encoded password hashes containing the algorithm, parameters, salt, and derived hash.
- Never log, encrypt for later recovery, or otherwise retain plaintext passwords.
- Benchmark Argon2id parameters against the Cloud Run instance size before launch.
- Store Better Auth and OAuth secrets in Secret Manager with versioned rotation.
- Use opaque, database-backed session tokens in `HttpOnly`, `Secure`, `SameSite=Lax` cookies.
- Store only a hash of each session token in PostgreSQL when supported by the selected session configuration.
- Revoke other sessions after password resets and security-sensitive account changes.
- Enable enumeration-resistant responses and persistent rate limiting.
- Require recent authentication for password, email, and provider-linking changes.

## Email

Email delivery is deliberately deferred with the rest of this proposal. When implemented, Better Auth callbacks should send verification and password-reset messages through an application-owned mail adapter.

That adapter should initially support one SMTP or transactional-email provider, while keeping provider-specific code outside the authentication layer. Public registration should not launch until email ownership verification and password recovery are working.

## GCP Deployment

The initial production deployment would add:

- A small Cloud SQL for PostgreSQL instance in the same region as Cloud Run.
- A dedicated database and least-privileged database user for authentication.
- Cloud Run's supported Cloud SQL connection mechanism and a bounded connection pool.
- Secret Manager entries for the Better Auth secret, database credentials where required, Google OAuth credentials, and email credentials.
- Automated PostgreSQL backups and point-in-time recovery appropriate to production.
- Monitoring for authentication failures, unusual signup activity, database saturation, and email-delivery failures.

Cloud SQL is the recommended starting database. AlloyDB and Spanner are unnecessary at the current scale. Firestore has a community Better Auth adapter, but using a first-party PostgreSQL integration is preferable for the security-critical authentication store.

## Implementation Phases

### Phase 0: Current State

- Retain the existing Google allowlist and single-admin account.
- Do not expose signup, password login, or account recovery.
- Continue protecting editing and publishing server-side.

### Phase 1: Foundation

- Provision Cloud SQL PostgreSQL and secrets.
- Install and configure Better Auth in SvelteKit.
- Add checked-in database migrations.
- Implement the application-owned auth adapter and session types.
- Add Google as the first provider and migrate the existing admin identity safely.

### Phase 2: Email and Password

- Add Argon2id hashing.
- Add minimalist login, signup, password-change, and sign-out UI.
- Add rate limiting, audit events, and session management.
- Add email verification and password recovery through the mail adapter.
- Link Google and password credentials to the same internal account.

### Phase 3: Production Hardening

- Test concurrent signup and unique-email enforcement.
- Test account linking and takeover protections.
- Test session expiration, revocation, cookie policy, and CSRF handling.
- Test backup restoration and migration to a non-GCP PostgreSQL instance.
- Add operational dashboards and alerts.
- Document account recovery and incident-response procedures.

## Alternatives Considered

### Better Auth with Firestore

Lower infrastructure cost, but the adapter is community-maintained and Firestore makes relational identity constraints less natural. It also retains more GCP database lock-in.

### SuperTokens with PostgreSQL

A credible open-source, language-independent authentication service. It requires a separate core service and adds operational complexity. Reconsider if several applications need to share one authentication platform.

### Ory Kratos with PostgreSQL

Powerful and portable, but substantially heavier than the product currently needs. Better suited to a dedicated identity platform serving multiple applications.

### Custom Go Authentication Service

Technically straightforward to deploy on Cloud Run, but it would make us responsible for the full credential, recovery, linking, rate-limiting, session, and incident-response lifecycle. Go does not itself reduce that security scope.

### Firebase Authentication / Identity Platform

The simplest managed option, but rejected as the preferred long-term direction because migrating credentials and authentication behavior away from Google would be more difficult.

## Resume Criteria

Resume this proposal when at least one of the following becomes true:

- People other than the current administrator need accounts.
- Email/password sign-in becomes a product requirement.
- Notes or drafts need per-user ownership and sharing.
- Account recovery and verified user identity become necessary.
- Multiple applications need to share the same user base.

Before implementation begins, revalidate Better Auth's current release, security guidance, PostgreSQL schema, license, and migration tooling.
