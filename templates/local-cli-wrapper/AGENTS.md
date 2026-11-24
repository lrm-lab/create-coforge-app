# Agent instructions for __APP_NAME__

- The manifest command and npm bin name must stay the same. A local CLI manifest has no HTTP actions.
- Require dedicated storage for each Agent. Never fall back to the Computer user's home.
- Launch a known executable with validated arguments and an explicit environment, without shell expansion.
- Run `npm test` to verify the manifest and launch boundary after changing the command.
