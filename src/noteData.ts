import joplin from "api";
import { getUpdatedConfigNote } from "./parser";
import {
  NoteData,
  ConfigNote,
  UpdateQuery,
  SearchFilter,
  SearchQuery,
} from "./types";
import { quote } from "./utils";

/**
 * Common fields required for `LazyNodeData` container.
 */
const searchFields = [
  "id",
  "title",
  "parent_id",
  "is_todo",
  "todo_completed",
  "todo_due",
  "order",
  "created_time",
];

/**
 * Note data returned by the Data API, using the `searchFields` fields.
 */
interface RawNote {
  id: string;
  title: string;
  parent_id: string;
  is_todo: 0 | 1;
  todo_completed: 0 | 1;
  todo_due: number;
  order: number;
  created_time: number;
}

/**
 * `/search` endpoint response format.
 */
interface SearchResponse {
  items: RawNote[];
  has_more: boolean;
}

/**
 * Container for notes in kanban format. Data which would require extra requests
 * (eg. tags), is fetched on-demand, unless cached.
 *
 * Tags can be cached with `addKnownTags`, eg. if the note was obtained from
 * a search with tag filters, we know for sure that the note has the given tag,
 * no need for additional requests.
 */
export class LazyNoteData {
  private _tags: string[] | null = null;

  constructor(
    public data: Omit<NoteData, "tags">,
    public readonly knownTags: string[] = []
  ) {}

  static fromRawNote(note: RawNote, knownTags: string[] = []) {
    return new LazyNoteData(
      {
        id: note.id,
        title: note.title,
        notebookId: note.parent_id,
        isTodo: !!note.is_todo,
        isCompleted: !!note.todo_completed,
        due: note.todo_due,
        order: note.order === 0 ? note.created_time : note.order,
        createdTime: note.created_time,
      },
      knownTags
    );
  }

  private loadTags = async () =>
    this._tags === null &&
    (console.log("data call get", ["notes", this.data.id, "tags"]),
    (this._tags = (
      await joplin.data.get(["notes", this.data.id, "tags"])
    ).items.map((t: any) => t.title as string)));

  hasTag = async (tag: string) => {
    if (this.knownTags.includes(tag)) return true;
    await this.loadTags();
    return this._tags?.includes(tag) ?? false;
  };

  fullyLoadData = async (): Promise<NoteData> => {
    await this.loadTags();
    return {
      ...this.data,
      tags: this._tags as string[],
    };
  };
}

/**
 * Run a search with the given filters, store them in `LazyNodeData`
 * objects and return results.
 *
 * We save the tags used in the filter to avoid having to fetch them later, but only
 * if the query contains no `any:1` filter.
 *
 * @see https://joplinapp.org/help/#searching
 */
export async function search(filters: SearchFilter[]): Promise<LazyNoteData[]> {
  const query = filters
    .map(([filter, value]) => `${filter}:${quote(value)}`)
    .join(" ");

  // If there is an "any:1" filter, we won't know which tags apply to a note
  // so we don't cache any.
  const isAny = !!filters.find(([f]) => f === "any");
  const knownTags = isAny
    ? []
    : filters.filter(([filter]) => filter === "tag").map(([_, v]) => v);

  let results: RawNote[] = [];
  let page = 1;
  while (true) {
    console.log("data call get", query === "" ? ["notes"] : ["search"], {
      query,
      page,
      fields: searchFields,
    });
    const { items, has_more }: SearchResponse = await joplin.data.get(
      query === "" ? ["notes"] : ["search"],
      {
        query,
        page,
        fields: searchFields,
      }
    );
    results = results.concat(items);

    if (!has_more) break;
    else page++;
  }

  return results.map((note) => LazyNoteData.fromRawNote(note, knownTags));
}

/**
 * Get a specific note by id in `LazyNodeData` format.
 */
export async function getNoteById(id: string): Promise<LazyNoteData> {
  return LazyNoteData.fromRawNote(
    (await joplin.data.get(["notes", id], { fields: searchFields })) as RawNote
  );
}

/**
 * Execute an update query, produced by rules.
 */
export async function executeUpdateQuery(updateQuery: UpdateQuery) {
  const { type, path, body = null } = updateQuery;
  if (type === "put" && path[0] === "notes") {
    // need to save updated_time
    console.log("data call get", path, {
      fields: ["updated_time", "user_updated_time"],
    });
    const { updated_time, user_updated_time } = await joplin.data.get(path, {
      fields: ["updated_time", "user_updated_time"],
    });
    const patchedBody = { ...body, updated_time, user_updated_time };
    console.log("data call put", path, null, patchedBody);
    await joplin.data.put(path, null, patchedBody);
  } else {
    console.log("data call", type, path, null, body);
    await joplin.data[type](path, null, body);
  }
}

/**
 * Get the title, parent_id, body of the given note.
 *
 * Used for the config note, because that's the only note whose body we're interested in.
 */
export function getConfigNote(noteId: string): Promise<ConfigNote> {
  const fields = ["id", "title", "parent_id", "body"];
  console.log("data call get", ["notes", noteId], { fields });
  return joplin.data.get(["notes", noteId], { fields });
}

/**
 * Update the config note with the given yaml and after text.
 *
 * @param config Make sure to pass in the yaml **without** ```kanban fence.
 */
export async function setConfigNote(
  noteId: string,
  config: string | null = null,
  after: string | null = null
) {
  const { body: oldBody } = await getConfigNote(noteId);
  const newBody = getUpdatedConfigNote(oldBody, config, after);
  const { id: selectedNoteId } = await joplin.workspace.selectedNote();
  if (selectedNoteId === noteId) {
    await joplin.commands.execute("editor.setText", newBody);
  }
  console.log("data call put", ["notes", noteId], null, { body: newBody });
  await joplin.data.put(["notes", noteId], null, { body: newBody });
}

/**
 * Get the id of a tag by name.
 */
export async function getTagId(tagName: string): Promise<string | undefined> {
  console.log("data call get", ["search"], { query: tagName, type: "tag" });
  const {
    items: [{ id = undefined } = {}],
  } = await joplin.data.get(["search"], { query: tagName, type: "tag" });
  return id;
}

/**
 * Get a list of all tags.
 */
export async function getAllTags(): Promise<string[]> {
  let tags: string[] = [];
  let page = 1;
  while (true) {
    console.log("data call get", ["tags"], { page });
    const {
      items: newTags,
      has_more: hasMore,
    }: { items: { title: string }[]; has_more: boolean } =
      await joplin.data.get(["tags"], { page });
    tags = [...tags, ...newTags.map((t) => t.title)];

    if (!hasMore) break;
    else page++;
  }

  return tags;
}

/**
 * Create a new tag by name.
 */
export async function createTag(tagName: string): Promise<string> {
  console.log("data call post", ["tags"], null, { title: tagName });
  const result = await joplin.data.post(["tags"], null, { title: tagName });
  return result.id;
}

/**
 * Create a new notebook by path. Creates all missing parents.
 *
 * Think `mkdir -p`
 *
 * @see https://github.com/joplin/plugin-kanban#filters
 */
export async function createNotebook(notebookPath: string): Promise<string> {
  const parts = notebookPath.split("/");
  let parentId = "";
  for (let i = 0; i < parts.length; i++) {
    const currentPath = "/" + parts.slice(0, i + 1);
    console.log("data call post", ["folders"], null, {
      title: parts[i],
      parent_id: parentId,
    });
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

/**
 * Resolve a notebook by path.
 *
 * @see https://github.com/joplin/plugin-kanban#filters
 */
export async function resolveNotebookPath(
  notebookPath: string
): Promise<string | null> {
  const foldersData = await getAllNotebooks();
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

/**
 * Recusively find all notebooks within the given notebook.
 */
export async function findAllChildrenNotebook(
  parentId: string
): Promise<string[]> {
  const foldersData = await getAllNotebooks();

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

/**
 * Get a list of all notebooks, with id, title, and parent_id.
 */
export async function getAllNotebooks(): Promise<Folder[]> {
  let folders: Folder[] = [];
  let page = 1;
  while (true) {
    console.log("data call get", ["folders"], { page });

    const {
      items: newFolders,
      has_more: hasMore,
    }: { items: Folder[]; has_more: boolean } = await joplin.data.get(
      ["folders"],
      { page }
    );
    folders = [...folders, ...newFolders];

    if (!hasMore) break;
    else page++;
  }

  return folders;
}

/**
 * Get the path associated with the notebook id.
 */
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
