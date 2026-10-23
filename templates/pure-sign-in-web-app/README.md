# __APP_NAME__

A small server-rendered web app with **Sign in with CoForge**: OpenID Connect authorization code
flow with PKCE (S256), `state`, `nonce`, the RFC 9207 `iss` check, ES256 ID token verification
against CoForge's JWKS, UserInfo, and a server-side session. Built on [Hono](https://hono.dev) and
[jose](https://github.com/panva/jose); it runs on Node 22+ and Bun.

## Register the app in CoForge

1. In your Workspace, open Settings -> Applications (owners and admins) and register the app.
   Only the name is required.
2. Add this exact redirect URI: `APP_ORIGIN` + `/auth/callback`
   (locally `http://localhost:3000/auth/callback`). CoForge compares redirect URIs as exact strings.
3. Copy the client ID and the client secret. The secret is shown once; regenerating it stops the old one.

## Environment variables

Copy `.env.example` to `.env`. Never commit `.env`. The secrets in `.env.example` are empty and the other values are placeholders: replace them.

| Variable | Meaning |
| --- | --- |
| `COFORGE_ISSUER` | `<your CoForge origin>/oidc`, no trailing slash. https only (http for localhost). |
| `COFORGE_CLIENT_ID` | The app's client ID. |
| `COFORGE_CLIENT_SECRET` | The client secret. Server only. |
| `COFORGE_SCOPES` | Default `openid profile identity`. Add `email` only if the Workspace allowed it. |
| `APP_ORIGIN` | Where this app is served, e.g. `http://localhost:3000`. |
| `PORT` | Listen port, default 3000. |
| `SESSION_SECRET` | 32+ random characters (`openssl rand -base64 48`). It signs only the short-lived login cookie; sessions themselves are server-side. The app refuses to start with it empty or a placeholder. |

## Run

```bash
npm install            # or: bun install
cp .env.example .env   # then fill it in
npm start              # or: npm run dev to restart on change
npm test
```

## How it works

| Route | Does |
| --- | --- |
| `GET /` | Shows the signed-in person's name, email (if granted) and Workspace claims. |
| `GET /auth/login` | Reads discovery, makes `state`, `nonce` and a PKCE verifier, keeps them in a signed httpOnly cookie, redirects to `/oidc/auth`. |
| `GET /auth/callback` | Checks `iss`, `state`, `error`; exchanges the code at `/oidc/token` with the secret (HTTP Basic); verifies the ID token (signature, `iss`, `aud`, `exp`, `nonce`, `at_hash`); reads `/oidc/me`; checks its `sub` equals the ID token's; starts a session. |
| `POST /auth/logout` | Ends the session and clears the cookie. |

Good to know:

- The ID token carries only who signed in. Name, email and Workspace claims (`workspace_id`,
  `workspace_slug`, `workspace_role`) come from UserInfo, per granted scope.
- CoForge issues no refresh token. Access and ID tokens last an hour, so the session does too.
- A new sign-in ends the previous session of that browser; expired sessions are swept every five minutes.
- Sessions are held in memory. To run more than one instance, move them to a shared store
  (`src/app.js`, the `sessions` map).
- The session cookie is `HttpOnly`, `SameSite=Lax`, and `Secure` whenever `APP_ORIGIN` is https.

See CoForge's [authorization server documentation](https://github.com/lrm-lab/coforge/blob/4b81763cc5b2fe699c7eb5abd0d67e18815ef5cc/docs/authorization-server/README.md) for the full contract: discovery at
`<issuer>/.well-known/openid-configuration`, endpoints `/oidc/auth`, `/oidc/token`, `/oidc/me`, `/oidc/jwks`.
