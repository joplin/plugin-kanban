import joplin from "api";

export interface ConfigNote {
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

export async function searchNotes(query: string): Promise<NoteData[]> {
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

    for (const { id, title, parent_id, is_todo, todo_completed } of notes) {
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
  rootNotebookId = ""
): Promise<string | null> {
  const { items: foldersData } = await joplin.data.get(["folders"]);
  const parts = notebookPath.split("/");

  let parentId = rootNotebookId;
  do {
    const currentPart = parts.shift();
    const currentFolder = foldersData.find(
      ({ title, parent_id }: { title: string; parent_id: string }) =>
        title === currentPart && parent_id === parentId
    );
    if (!currentFolder) return null;

    parentId = currentFolder.id;
  } while (parts.length);

  return parentId;
}
