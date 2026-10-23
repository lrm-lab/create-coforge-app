# Agent instructions for __APP_NAME__

## Secrets

- `COFORGE_CLIENT_SECRET` and `SESSION_SECRET` live only in the server's environment (`.env`, which
  is git-ignored). Never put them in source, the repo, browser JavaScript, logs, screenshots, commit
  messages or chat. Do not print `process.env`.
- If the human must supply the client secret, ask them to put it in `.env` themselves.
- Never log authorization codes, access tokens or ID tokens.

- Values in `.env.example` are placeholders, never real credentials. Do not invent a secret and do not
  commit one; the app refuses to start on an empty or placeholder secret, and that is correct.

## Contract version

Checked against CoForge commit [`4b81763c`](https://github.com/lrm-lab/coforge/blob/4b81763cc5b2fe699c7eb5abd0d67e18815ef5cc/docs/authorization-server/README.md)
(`docs/authorization-server/`, `apps/web/src/server/authorization-server/`). To re-check, diff those paths
between that commit and the current `main` of lrm-lab/coforge, and update the code, tests and this line
together.

## Register and configure

1. The human (a Workspace owner or admin) registers the app in Settings -> Applications with the
   redirect URI `APP_ORIGIN/auth/callback`, exactly.
2. Copy `.env.example` to `.env` and fill it from README.md.

## Run and test

- `npm install` (or `bun install`), `npm start`, `npm test`. Tests need no network or CoForge account:
  they run a stand-in authorization server on loopback.
- Keep the security checks in `src/oidc.js`: PKCE S256, `state`, `nonce`, `iss` parameter, ID token
  signature/`iss`/`aud`/`at_hash`, and the UserInfo `sub` match. A change that weakens one needs a test
  that proves the attack is still refused.
- Escape every CoForge-supplied value in `src/views.js`.
- Pin dependency versions exactly; add dependencies with the package manager, never by hand-editing
  `package.json`.
