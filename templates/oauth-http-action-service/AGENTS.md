# Agent instructions for __APP_NAME__

- Browser sign-in and Agent API tokens are independent. Do not accept session cookies on Agent actions.
- Keep the client secret, session secret and any access tokens server-side. Never log them.
- Update the action manifest and handler together. Keep signature, issuer, audience, expiry,
  Agent identity, scope, payload and workspace checks in place.
- Run `npm test` and verify the registered redirect URI, manifest and actions before publishing.
