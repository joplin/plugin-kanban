import { Config } from "./board";
import {
  getTagId,
  UpdateQuery,
  NoteData,
  resolveNotebookPath,
  findAllChildrenNotebook,
  createTag,
  createNotebook,
} from "./noteData";

export interface Rule {
  filterNote: (note: NoteData) => boolean;
  set(noteId: string): UpdateQuery[];
  unset(noteId: string): UpdateQuery[];
}

export type RuleFactory = (
  ruleValue: string | string[],
  config: Config
) => Promise<Rule>;

type Rules = { [ruleName: string]: RuleFactory };

const rules: Rules = {
  async tag(arg: string | string[]) {
    const tagName = Array.isArray(arg) ? arg[0] : arg;
    const tagID = (await getTagId(tagName)) || (await createTag(tagName));
    return {
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
    };
  },

  async tags(tagNames: string | string[], config: Config) {
    if (!Array.isArray(tagNames)) tagNames = [tagNames];
    const tagRules = await Promise.all(
      tagNames.map((t) => rules.tag(t, config))
    );
    return {
      filterNote: (note: NoteData) =>
        tagRules.some(({ filterNote }) => filterNote(note)),
      set: (noteId: string) => tagRules.flatMap(({ set }) => set(noteId)),
      unset: (noteId: string) => tagRules.flatMap(({ unset }) => unset(noteId)),
    };
  },

  async notebookPath(path: string | string[], config: Config) {
    if (Array.isArray(path)) path = path[0];

    let { filters: { rootNotebookPath } } = config
    if (path.startsWith("/")) path = path.slice(1);
    if (rootNotebookPath.startsWith("/")) rootNotebookPath = rootNotebookPath.slice(1);
    if (!rootNotebookPath.endsWith("/"))
      rootNotebookPath = rootNotebookPath + "/";
    path = rootNotebookPath + path;

    const notebookId =
      (await resolveNotebookPath(path)) ||
      (await createNotebook(path));

    const childrenNotebookIds = await findAllChildrenNotebook(notebookId);
    const notebookIdsToSearch = [notebookId, ...childrenNotebookIds];

    console.log(
      "notebookpath rule",
      path,
      "\n notebookIdsToSearch",
      notebookIdsToSearch
    );

    return {
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
      unset: () => [],
    };
  },

  async completed(val: string | string[]) {
    if (Array.isArray(val)) val = val[0];
    const shouldBeCompeted = val.toLowerCase() === "true";
    return {
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
    };
  },

  async excludeNoteId(id: string | string[]) {
    return {
      filterNote: (note: NoteData) => note.id !== id,
      set: () => [],
      unset: () => [],
    };
  },
};

export default rules;
