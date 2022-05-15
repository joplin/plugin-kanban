import {
  getTagId,
  resolveNotebookPath,
  findAllChildrenNotebook,
  createTag,
  createNotebook,
  LazyNoteData,
} from "./noteData";
import type { Config, Rule, SearchFilter } from "./types";

type RuleFactory = (
  ruleValue: string | string[],
  rootNotebookPath: string,
  config: Config
) => Promise<Rule>;

/**
 * This map contains all supported rules.
 */
const rules: Record<string, RuleFactory> = {
  async tag(arg: string | string[]) {
    const tagName = Array.isArray(arg) ? arg[0] : arg;
    const tagID = (await getTagId(tagName)) || (await createTag(tagName));
    return {
      name: "tag",
      searchFilters: [["tag", tagName]],
      filterNote: async (note: LazyNoteData) => await note.hasTag(tagName),
      set: (noteId: string) => [
        {
          type: "post",
          path: ["tags", tagID, "notes"],
          body: { id: noteId },
        },
      ],
      unset: (noteId: string) => [
        {
          type: "delete",
          path: ["tags", tagID, "notes", noteId],
        },
      ],
      editorType: "text",
    };
  },

  async tags(tagNames: string | string[], rootNbPath: string, config: Config) {
    if (!Array.isArray(tagNames)) tagNames = [tagNames];
    const tagRules = await Promise.all(
      tagNames.map((t) => rules.tag(t, rootNbPath, config))
    );
    return {
      name: "tags",
      searchFilters: tagRules.map(
        (tag) => (tag.searchFilters as SearchFilter[])[0]
      ),
      filterNote: async (note: LazyNoteData) =>
        Promise.all(tagRules.map((rule) => rule.filterNote(note))).then((res) =>
          res.includes(true)
        ),
      set: (noteId: string) => tagRules.flatMap(({ set }) => set(noteId)),
      unset: (noteId: string) => tagRules.flatMap(({ unset }) => unset(noteId)),
      editorType: "text",
    };
  },

  async notebookPath(path: string | string[], rootNotebookPath: string) {
    if (Array.isArray(path)) path = path[0];

    // Normalize path
    if (path.startsWith("/")) path = path.slice(1);
    if (path.endsWith("/")) path = path.slice(0, -1);
    if (rootNotebookPath.startsWith("/"))
      rootNotebookPath = rootNotebookPath.slice(1);
    if (!rootNotebookPath.endsWith("/") && rootNotebookPath.length > 0)
      path = rootNotebookPath + "/" + path;
    else path = rootNotebookPath + path;

    const rootNotebookId = await resolveNotebookPath(rootNotebookPath);
    const notebookId =
      (await resolveNotebookPath(path)) || (await createNotebook(path));
    const childrenNotebookIds = await findAllChildrenNotebook(notebookId);
    const notebookIdsToSearch = [notebookId, ...childrenNotebookIds];

    return {
      name: "notebookPath",
      filterNote: async (note: LazyNoteData) =>
        notebookIdsToSearch.includes(note.data.notebookId),
      set: (noteId: string) => [
        {
          type: "put",
          path: ["notes", noteId],
          body: {
            parent_id: notebookId,
          },
        },
      ],
      unset: (noteId: string) => [
        {
          type: "put",
          path: ["notes", noteId],
          body: {
            parent_id: rootNotebookId,
          },
        },
      ],
      editorType: "text",
    };
  },

  async completed(val: string | string[]) {
    if (Array.isArray(val)) val = val[0];
    const shouldBeCompeted = val.toLowerCase() === "true";
    return {
      name: "completed",
      filterNote: async (note: LazyNoteData) =>
        note.data.isTodo && note.data.isCompleted === shouldBeCompeted,
      set: (noteId: string) => [
        {
          type: "put",
          path: ["notes", noteId],
          body: {
            todo_completed: shouldBeCompeted ? Date.now() : 0,
          },
        },
      ],
      unset: (noteId: string) => [
        {
          type: "put",
          path: ["notes", noteId],
          body: {
            todo_completed: 0,
          },
        },
      ],
      editorType: "checkbox",
    };
  },

  async excludeNoteId(id: string | string[]) {
    return {
      name: "excludeNoteId",
      filterNote: async (note: LazyNoteData) => note.data.id !== id,
      set: () => [],
      unset: () => [],
      editorType: "",
    };
  },
};

const editorTypes = {
  filters: {
    tags: "tags",
    rootNotebookPath: "notebook",
    completed: "checkbox",
  },
  columns: {
    tags: "tags",
    notebookPath: "notebook",
    completed: "checkbox",
    backlog: "checkbox",
  },
};

export const getRuleEditorTypes = (targetPath: string) => {
  if (targetPath === "filters") return editorTypes.filters;
  if (targetPath.startsWith("column")) return editorTypes.columns;
  throw new Error(`Unkown target path ${targetPath}`);
};

export default rules;
