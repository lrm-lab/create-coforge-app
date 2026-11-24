# Agent instructions for __APP_NAME__

- Use refreshed CoForge UserInfo to select the browser's workspace. Use the verified Agent access
  token to select the actions' workspace. Do not accept either workspace from request parameters.
- Keep the browser session cookie separate from Agent API authentication. Keep secrets and
  tokens server-side and out of logs.
- Escape data rendered in the browser. Keep manifest scopes and the API's input checks in sync.
- Run `npm test`. Changes to workspace visibility need both same-workspace and cross-workspace tests.
