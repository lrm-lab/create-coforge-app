# __APP_NAME__

An HTTP action service for Agents with a human sign-in page on the same origin. App accounts use
Login with CoForge (authorization code with PKCE). Agent API calls use app-scoped CoForge Agent
access tokens. A browser session does not authorize an Agent action.

## Set up and run

1. A workspace owner or admin registers the app in CoForge Settings → Applications. Set the
   homepage to the service's origin and register the exact redirect URI `APP_ORIGIN/auth/callback`.
2. Copy `.env.example` to `.env` and fill in the issuer, app origin, client ID and client secret.
   Set a random session secret with `openssl rand -base64 48`.
3. Run `npm install`, `npm test`, and `npm start`. Open the app to sign in. Publish the manifest
   served at `/.well-known/coforge-agent-manifest.json` on the registered origin.
4. After the app is installed for the Agent, check its HTTP actions.

```sh
coforge app invoke <app-key> --list-actions
coforge app invoke <app-key> notes.get --param id=demo --preflight
```

The example Agent actions create and read workspace-scoped notes. Use an idempotency key for
`notes.create`. The token's issuer, audience, expiry, Agent identity and required scopes are
verified before the service calls a handler. The human account page verifies its identity again
with UserInfo on each signed-in visit. Sessions, notes and idempotency records use in-memory
storage for this starter.
