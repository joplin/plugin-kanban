import joplin from "api";

import { log } from "./index"

export interface UpdateQuery {
  type: "post" | "delete" | "put";
  path: string[];
  body?: object;
}

export interface ConfigNote {
  id: string;
  title: string;
  parent_id: string;
  body: string;
}

export interface NoteData {
  id: string;
  title: string;
  tags: string[];
  notebookId: string;
  isTodo: boolean;
  isCompleted: boolean;
  due: number; 
}

async function search(query: string): Promise<NoteData[]> {
  const fields = ["id", "title", "parent_id", "is_todo", "todo_completed", "todo_due"];

  type RawNote = {
    id: string;
    title: string;
    parent_id: string;
    is_todo: 0 | 1;
    todo_completed: 0 | 1;
    todo_due: number;
  };

  type Response = {
    items: RawNote[];
    has_more: boolean;
  };

  const result: NoteData[] = [];
  let page = 1;
  while (true) {
    const { items: notes, has_more: hasMore }: Response = await joplin.data.get(
      ["search"],
      { query, page, fields }
    );

    for (const { id, title, parent_id, is_todo, todo_completed, todo_due } of notes) {
      const tags = (await joplin.data.get(["notes", id, "tags"])).items.map(
        ({ title }: { title: string }) => title
      );
      result.push({
        id,
        title,
        tags,
        isTodo: !!is_todo,
        isCompleted: !!todo_completed,
        notebookId: parent_id,
        due: todo_due
      });
    }

    if (!hasMore) break;
    else page++;
  }

  return result;
}

export async function searchNotes(
  rootNotebookName: string
): Promise<NoteData[]> {
  const query = `notebook:"${rootNotebookName}"`;
  return search(query);
}

export async function getNoteById(id: string): Promise<NoteData> {
  const query = `id:${id}`;
  return (await search(query))[0];
}

export async function executeUpdateQuery(updateQuery: UpdateQuery) {
  const { type, path, body = null } = updateQuery;
  await joplin.data[type](path, null, body);
}

export function getConfigNote(noteId: string): Promise<ConfigNote> {
  const fields = ["id", "title", "parent_id", "body"];
  return joplin.data.get(["notes", noteId], { fields });
}

export async function setConfigNoteBody(noteId: string, newBody: string) {
  const { id: selectedNoteId } = await joplin.workspace.selectedNote()
  if (selectedNoteId === noteId) {
    await joplin.commands.execute("editor.setText", newBody)
  }

  await joplin.data.put(["notes", noteId], null, { body: newBody });
}

export async function getTagId(tagName: string): Promise<string | undefined> {
  const { items: [{ id = undefined } = {}] } = await joplin.data.get(["search"], { query: tagName, type: "tag" });
  log(`Found tag id for ${tagName}: ${id}`)
  return id
}

export async function getAllTags(): Promise<string[]> {
  let tags: string[] = [];
  let page = 1;
  while (true) {
    const { items: newTags, has_more: hasMore }: { items: { title: string }[], has_more: boolean } = await joplin.data.get([
      "tags",
    ], {page});
    tags = [...tags, ...newTags.map((t) => t.title)]

    if (!hasMore) break;
    else page++;
  }

  return tags;
}

export async function createTag(tagName: string): Promise<string> {
  log(`Creating new tag ${tagName}`)
  const result = await joplin.data.post(["tags"], null, { title: tagName });
  log(`Created new tag ${tagName}, result: ${JSON.stringify(result, null, 4)}\n`)
  return result.id;
}

export async function createNotebook(notebookPath: string): Promise<string> {
  const parts = notebookPath.split("/");
  let parentId = "";
  for (let i = 0; i < parts.length; i++) {
    const currentPath = "/" + parts.slice(0, i + 1);
    const id =
      (await resolveNotebookPath(currentPath)) ||
      (
        await joplin.data.post(["folders"], null, {
          title: parts[i],
          parent_id: parentId,
        })
      ).id;
    parentId = id;
  }

  return parentId;
}

export async function resolveNotebookPath(
  notebookPath: string
): Promise<string | null> {
  const { items: foldersData } = await joplin.data.get(["folders"]);
  const parts = notebookPath.split("/");

  let parentId = "";
  do {
    const currentPart = parts.shift();
    if (currentPart === "") continue;

    const currentFolder = foldersData.find(
      ({ title, parent_id }: { title: string; parent_id: string }) =>
        title === currentPart && parent_id === parentId
    );
    if (!currentFolder) return null;

    parentId = currentFolder.id;
  } while (parts.length);

  return parentId;
}

export async function findAllChildrenNotebook(
  parentId: string
): Promise<string[]> {
  const { items: foldersData } = await joplin.data.get(["folders"]);

  let children: string[] = [];
  const recurse = (id: string) => {
    const newChildren = foldersData
      .filter(({ parent_id }: { parent_id: string }) => parent_id === id)
      .map(({ id }: { id: string }) => id);
    newChildren.forEach((id: string) => recurse(id));
    children = [...children, ...newChildren];
  };

  recurse(parentId);
  return children;
}

type Folder = {
  id: string;
  title: string;
  parent_id: string;
};

export async function getAllNotebooks(): Promise<Folder[]> {
  let folders: Folder[] = [];
  let page = 1;
  while (true) {
    const { items: newFolders, has_more: hasMore }: { items: Folder[], has_more: boolean } = await joplin.data.get([
      "folders",
    ], {page});
    folders = [...folders, ...newFolders]

    if (!hasMore) break;
    else page++;
  }

  return folders;
}

export async function getNotebookPath(searchId: string): Promise<string> {
  const foldersData = await getAllNotebooks();

  const recurse = (parentId: string, currentPath: string): string | null => {
    const children = foldersData.filter(
      ({ parent_id }) => parent_id === parentId
    );
    if (children.length === 0) return null;

    const match = children.find(({ id }) => id === searchId);
    if (match) return currentPath + "/" + match.title;

    for (const child of children) {
      const res = recurse(child.id, currentPath + "/" + child.title);
      if (res) return res;
    }

    return null;
  };

  return recurse("", "") as string;
}
