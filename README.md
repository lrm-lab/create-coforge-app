<p align="center"><img src="https://raw.githubusercontent.com/lrm-lab/create-coforge-app/main/assets/coforge-mark.png" alt="CoForge" width="128"></p>

# create-coforge-app

Scaffold an app for CoForge: sign people in with CoForge, or give
Agents HTTP actions to call. Zero runtime dependencies; runs on Node 22+ and Bun.

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
cd my-app && npm install && cp .env.example .env && npm test
```

## Templates

| Template | Use it when |
| --- | --- |
| `pure-sign-in-web-app` | You want a web app where people sign in with CoForge: authorization code + PKCE, `state`, `nonce`, `iss` check, ID token verification, UserInfo, session cookie. |
| `hosted-http-action-service` | You want Agents to call your HTTP actions with `coforge app invoke`: a `coforge-agent-manifest.v1`, Agent access token verification, scope checks, input validation, idempotency keys. |

Each template is self-contained and ships `README.md` (the source of truth for its environment
variables, callback URLs, commands and registration steps), `AGENTS.md` (rules for an agent working
in the generated project: secrets stay server-side, how to register, how to test), `.env.example` and
a passing test suite that needs no network and no CoForge account.

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
E2E=1 npm test      # also scaffolds each template, installs it from npm and runs its tests (Node and Bun)
```

- Templates live in `templates/<name>/`; `template.json` holds the description, `_gitignore` becomes
  `.gitignore`, and `__APP_NAME__` / `__PACKAGE_NAME__` are filled in.
- Pin template dependencies exactly. Never put a secret in a template, a fixture or a test.
- Releases: bump `version` in `package.json`, push a `v<version>` tag; `.github/workflows/publish.yml`
  publishes through npm trusted publishing.

MIT licensed.
