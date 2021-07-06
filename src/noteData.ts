import joplin from "api";

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
}

async function search(query: string): Promise<NoteData[]> {
  const fields = ["id", "title", "parent_id", "is_todo", "todo_completed"];

  type RawNote = {
    id: string;
    title: string;
    parent_id: string;
    is_todo: 0 | 1;
    todo_completed: 0 | 1;
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

    for (const {
      id,
      title,
      parent_id,
      is_todo,
      todo_completed,
    } of notes) {
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
      });
    }

    if (!hasMore) break;
    else page++;
  }

  return result;
}

export async function searchNotes(rootNotebookName: string): Promise<NoteData[]> {
  const query = `notebook:${rootNotebookName}`
  return search(query);
}

export async function getNoteById(id: string): Promise<NoteData> {
  const query = `id:${id}`
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

export async function getTagId(tagName: string): Promise<string> {
  const { items: allTags } = await joplin.data.get(["tags"]);
  return allTags.find(({ title }: { title: string }) => title === tagName)?.id;
}

export async function resolveNotebookPath(
  notebookPath: string,
  rootNotebookPath = "/"
): Promise<string | null> {
  if (notebookPath !== rootNotebookPath) {
    if (notebookPath.startsWith("/")) notebookPath = notebookPath.slice(1);
    if (!rootNotebookPath.endsWith("/"))
      rootNotebookPath = rootNotebookPath + "/";
    notebookPath = rootNotebookPath + notebookPath;
  }

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

export async function findAllChildrenNotebook(parentId: string): Promise<string[]> {
  const { items: foldersData } = await joplin.data.get(["folders"]);

  const children: string[] = [];
  const recurse = (id: string) => {
    const newChildren = foldersData.filter(
      ({ parent_id }: { parent_id: string }) => parent_id === id
    ).map(({ id }: { id: string }) => id);
    newChildren.forEach((id: string) => recurse(id))
    children.concat(newChildren)
  }

  recurse(parentId);
  return children;
}

export async function getNotebookName(id: string): Promise<string> {
  const { items } = await joplin.data.get(["search"], { "query": "test", "type": "folder" })
  return items[0]?.title as string
}
