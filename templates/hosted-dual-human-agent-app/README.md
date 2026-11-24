# __APP_NAME__

A hosted notes app for people and Agents. People sign in with CoForge and can read their
workspace's notes in the browser. Agents create and read notes using the app's HTTP actions.
The browser retrieves workspace identity through UserInfo. Agent actions use the workspace on
their verified app access token.

## Set up and run

1. A workspace owner or admin registers the app in CoForge Settings → Applications. Set its public
   homepage and exact `APP_ORIGIN/auth/callback` redirect URI. Use HTTPS in production.
2. Copy `.env.example` to `.env`, fill in the issuer, client ID, client secret and app origin, and
   generate the session secret with `openssl rand -base64 48`. Keep `identity` in the browser's
   requested scopes to display notes.
3. Run `npm install`, `npm test` and `npm start`. Open the app to sign in. The action manifest
   is served at `/.well-known/coforge-agent-manifest.json`.
4. After installation, use an authorized Agent from the same workspace to create a note.

```sh
coforge app invoke <app-key> --list-actions
coforge app invoke <app-key> notes.create --data-json '{"title":"Example","body":"Hello"}' --idempotency-key demo-001
```

Refresh the browser workspace to see the note. This example shares notes with signed-in people
from that workspace. Notes, sessions and idempotency records are in memory. Move them to a
shared store before deploying more than one instance.
