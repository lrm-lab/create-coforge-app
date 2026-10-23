const escapeHtml = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

/**
 * One server-rendered page. Every value from CoForge goes through escapeHtml.
 * @param {{ profile: Record<string, unknown> } | undefined} session
 * @param {string} [notice]
 */
export function page(session, notice) {
  const profile = session?.profile;
  const body = profile
    ? `<h1>Hello, ${escapeHtml(profile.name ?? profile.preferred_username ?? profile.sub)}</h1>
       <dl>
         <dt>User id</dt><dd>${escapeHtml(profile.sub)}</dd>
         ${profile.email ? `<dt>Email</dt><dd>${escapeHtml(profile.email)}</dd>` : ""}
         ${profile.workspace_slug ? `<dt>Workspace</dt><dd>${escapeHtml(profile.workspace_slug)} (${escapeHtml(profile.workspace_role)})</dd>` : ""}
       </dl>
       <form method="post" action="/auth/logout"><button>Sign out</button></form>`
    : `<h1>__APP_NAME__</h1><p><a href="/auth/login">Sign in with CoForge</a></p>`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>__APP_NAME__</title></head>
<body>${notice ? `<p role="alert">${escapeHtml(notice)}</p>` : ""}${body}</body></html>`;
}
