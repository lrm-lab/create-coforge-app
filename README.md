<p align="center"><picture><source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/lrm-lab/create-coforge-app/main/assets/coforge-logo-dark.svg"><img src="https://raw.githubusercontent.com/lrm-lab/create-coforge-app/main/assets/coforge-logo-light.svg" alt="CoForge" width="128"></picture></p>

# create-coforge-app

Build a CoForge app with browser sign-in, Agent-callable HTTP actions, or a command that runs on
the Agent's Computer. The scaffolder has zero runtime dependencies and runs on Node 22+ and Bun.

```bash
npm create coforge-app@latest my-app
# or
bun create coforge-app my-app
```

Pick a template when prompted, or pass one. Note the `--` that npm needs before options:

```bash
npm create coforge-app@latest my-app -- --template hosted-http-action-service
bun create coforge-app my-app --template hosted-http-action-service
npm create coforge-app@latest -- --list-templates
```

Options: `[dir]`, `-t, --template <name>`, `--list-templates`, `-y, --yes` (accept the defaults:
directory `my-coforge-app`, template `pure-sign-in-web-app`), `-h`, `-v`. The target directory must be
new or empty. Then:

```bash
cd my-app && npm install && npm test
```

## Templates

| Template | Use it when |
| --- | --- |
| `pure-sign-in-web-app` | You want a web app where people sign in with CoForge: authorization code + PKCE, `state`, `nonce`, `iss` check, ID token verification, UserInfo, session cookie. |
| `hosted-http-action-service` | You want Agents to call your HTTP actions with `coforge app invoke`: a `coforge-agent-manifest.v1`, Agent access token verification, scope checks, input validation, idempotency keys. |
| `oauth-http-action-service` | You want HTTP actions for Agents and a CoForge OAuth sign-in page for human users on the same service. |
| `hosted-dual-human-agent-app` | You want a browser app and Agent actions to work with the same workspace data. |
| `local-cli-wrapper` | You want Agents to run an installed command with dedicated local storage per Agent. |

Each generated project ships a `README.md` with its environment variables, commands, and
registration steps, an `AGENTS.md` with instructions for coding Agents, and a test suite that needs
no CoForge account. Hosted templates also include `.env.example`.

## How the templates relate to CoForge

The templates implement CoForge's published contracts; they are not a CoForge SDK. The [authorization
server](https://github.com/lrm-lab/coforge/blob/4b81763cc5b2fe699c7eb5abd0d67e18815ef5cc/docs/authorization-server/README.md) (issuer `<origin>/oidc`, discovery, `/oidc/auth`, `/oidc/token`, `/oidc/me`, `/oidc/jwks`), the
Agent access token claims and the [Agent manifest](https://github.com/lrm-lab/coforge/blob/4b81763cc5b2fe699c7eb5abd0d67e18815ef5cc/docs/agent-manifest/README.md) are described in the public [CoForge repository](https://github.com/lrm-lab/coforge). The
manifest JSON Schema is vendored into `hosted-http-action-service/test/fixtures/` with its source
pinned to a CoForge commit in `SOURCE.md`; refresh it when CoForge publishes a new one.

## Contributing

Development uses Bun 1.4 and Node 24 (`mise install`; see `mise.toml`). The CLI is plain ES modules
with JSDoc types: no build step, so what is tested is what is published.

```bash
npm test            # scaffolder tests
E2E=1 npm test      # installs the npm tarball, generates every template and runs its tests (Node and Bun)
```

- Templates live in `templates/<name>/`. A `template.json` can declare a base template and
  individual files to copy before the selected template's files. The generated project owns all
  its files. The CLI fills in project and command name placeholders and renames `_gitignore`.
- Pin template dependencies exactly. Never put a secret in a template, a fixture or a test.
- Releases: bump `version` in `package.json`, push a `v<version>` tag; `.github/workflows/publish.yml`
  publishes through npm trusted publishing.

MIT licensed.
