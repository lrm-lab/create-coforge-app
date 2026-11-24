const escapeHtml = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`);

export function page(session, notice, notes) {
  const profile = session?.profile;
  const workspaceId = profile?.type === "user" ? profile.workspace_id : undefined;
  const workspaceNotes = typeof workspaceId === "string" ? notes.list(workspaceId) : [];
  const items = workspaceNotes.map(({ title, body }) =>
    `<li><h3>${escapeHtml(title)}</h3><p>${escapeHtml(body)}</p></li>`).join("");
  const workspace = typeof workspaceId === "string"
    ? `<h2>Workspace notes</h2>${items ? `<ul>${items}</ul>` : "<p>No workspace notes yet.</p>"}`
    : "<p>Sign in with the identity scope to see workspace notes.</p>";
  const content = profile
    ? `<p>Signed in as ${escapeHtml(profile.name ?? profile.preferred_username ?? profile.sub)}</p>
       ${workspace}<form method="post" action="/auth/logout"><button>Sign out</button></form>`
    : '<p><a href="/auth/login">Sign in with CoForge</a></p>';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>__APP_NAME__</title></head><body>
<h1>__APP_NAME__</h1>${notice ? `<p role="alert">${escapeHtml(notice)}</p>` : ""}${content}</body></html>`;
}
