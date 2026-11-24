import { randomUUID } from "node:crypto";

export function createNotes() {
  const workspaces = new Map();
  return {
    get(workspaceId, id) {
      return workspaces.get(workspaceId)?.get(id);
    },
    list(workspaceId) {
      return [...(workspaces.get(workspaceId)?.values() ?? [])];
    },
    create(workspaceId, { title, body }) {
      const note = { id: randomUUID(), title, body };
      const notes = workspaces.get(workspaceId) ?? new Map();
      notes.set(note.id, note);
      workspaces.set(workspaceId, notes);
      return note;
    },
  };
}
