# __APP_NAME__

This package installs the `__COMMAND_NAME__` command on the Computer where the Agent runs. It
wraps a bundled example tool that counts words. The CoForge manifest advertises the installed
command. It declares no HTTP actions.

## Try it locally

```sh
npm install
npm test
npm link
```

Set `COFORGE_LOCAL_CLI_HOME` in the Agent's environment to an absolute, private directory dedicated
to that Agent. Use different directories for different Agents. On macOS or Linux, create the
directory with permission `0700`.

```sh
__COMMAND_NAME__ --help
__COMMAND_NAME__ summarize "Three sample words"
```

Register the app in CoForge and serve `manifest.example.json` at
`/.well-known/coforge-agent-manifest.json` on its HTTPS homepage, or register its exact HTTPS URL
as the Agent manifest. Install the package on each Computer where an Agent should use it. Agents
run the command from their local shell. Use `coforge app invoke <app-key> --list-actions` to
inspect discovery. The manifest has no `actions` to invoke over HTTP.

## Wrap your tool

In `src/cli.js`, replace the bundled tool with a known executable and map only the arguments you
intend to expose. Keep shell expansion disabled. The child starts in the tool's dedicated storage
with isolated home and XDG directories, and does not inherit the Agent's environment. Choose a
tool that honors those directories. The wrapper sets process configuration. OS access controls
are still needed if the tool can read arbitrary paths or start untrusted programs.
