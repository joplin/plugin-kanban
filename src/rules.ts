import {
  getTagId,
  resolveNotebookPath,
  findAllChildrenNotebook,
  createTag,
  createNotebook,
} from "./noteData";
import type { Config, Rule, NoteData, UpdateQuery } from "./types";

type RuleFactory = (
  ruleValue: string | string[],
  rootNotebookPath: string,
  config: Config
) => Promise<Rule>;

/**
 * This map contains all supported rules.
 */
export const rules: Record<string, RuleFactory> = {
  async tag(arg: string | string[]) {
    const tagName = Array.isArray(arg) ? arg[0] : arg;
    const tagID = (await getTagId(tagName)) || (await createTag(tagName));
    return {
      name: "tag",
      filterNote: (note: NoteData) => note.tags.includes(tagName),
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
      filterNote: (note: NoteData) =>
        tagRules.some(({ filterNote }) => filterNote(note)),
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
      filterNote: (note: NoteData) =>
        notebookIdsToSearch.includes(note.notebookId),
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
      filterNote: (note: NoteData) =>
        note.isTodo && note.isCompleted === shouldBeCompeted,
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
      filterNote: (note: NoteData) => note.id !== id,
      set: () => [],
      unset: () => [],
      editorType: "",
    };
  },
};

const _filtersRules : Record<string, RuleFactory> = {
  "-tag": async (arg: string | string[]) => {
    const tagName = Array.isArray(arg) ? arg[0] : arg;

    const ruleObj = await rules.tag(arg, "", {} as Config);
    ruleObj.name = "-tag";
    ruleObj.filterNote = (note: NoteData) => !note.tags.includes(tagName);
    return ruleObj;
  },

  "-tags": async (tagNames: string | string[], rootNbPath: string, config: Config) => {
    if (!Array.isArray(tagNames)) tagNames = [tagNames];
    const tagRules = await Promise.all(
      tagNames.map((t) => filtersRules["-tag"](t, rootNbPath, config))
    );
    return {
      name: "-tags",
      filterNote: (note: NoteData) =>
        tagRules.every(({ filterNote }) => filterNote(note)),
      set: (noteId: string) => tagRules.flatMap(({ set }) => set(noteId)),
      unset: (noteId: string) => tagRules.flatMap(({ unset }) => unset(noteId)),
      editorType: "text",
    };
  },
}
export const filtersRules: Record<string, RuleFactory> = Object.assign({},rules,_filtersRules);

const editorTypes = {
  filters: {
    tags: "tags",
    "-tags": "tags",
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
