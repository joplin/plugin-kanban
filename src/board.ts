import * as yaml from "js-yaml";
import {
  getNotebookPath,
  getNoteById,
  searchNotes,
  NoteData,
} from "./noteData";

import rules, { Rule } from "./rules";
import { ConfigNote, UpdateQuery } from "./noteData";
import type { Action } from "./actions";
import type { BoardState } from "./gui/hooks";

export interface Message {
  id: string;
  title: string;
  severity: "info" | "warning" | "error";
  details?: string;
  actions: string[];
}

export type RuleValue = string | string[] | boolean | undefined;
export interface Config {
  filters: {
    [ruleName: string]: RuleValue;
    rootNotebookPath?: string;
  };
  columns: {
    [ruleName: string]: RuleValue;
    name: string;
    backlog?: boolean;
  }[];
  display: {
    markdown: string;
  };
}

interface Column {
  name: string;
  rules: Rule[];
}

interface BoardBase {
  isValid: boolean;
  configNoteId: string;
  boardName: string;
  configYaml: string;
}

interface ValidBoard extends BoardBase {
  isValid: true;
  parsedConfig: Config;
  columnNames: string[];
  rootNotebookName: string;
  hiddenTags: string[];
  sortNoteIntoColumn(note: NoteData): string | null;
  actionToQuery(action: Action, boardState: BoardState): UpdateQuery[];
}

interface InvalidBoard extends BoardBase {
  isValid: false;
  errorMessages: Message[];
}

export type Board = ValidBoard | InvalidBoard;

export const getYamlConfig = (boardNoteBody: string): string | null => {
  const configRegex = /^```kanban(.*)```/ms;
  const match = boardNoteBody.match(configRegex);
  if (!match || match.length < 2) return null;
  return match[1];
};

export function getMdTable(boardState: BoardState): string {
  if (!boardState.columns) return "";

  const separator = "---";
  const colNames = boardState.columns.map((col) => col.name);

  const header = colNames.join(" | ") + "\n";
  const headerSep = colNames.map(() => separator).join(" | ") + "\n";

  const rows: string[][] = [];
  const numRows = Math.max(...boardState.columns.map((c) => c.notes.length));
  for (let i = 0; i < numRows; i++) {
    rows[i] = boardState.columns.map((col) => getMdLink(col.notes[i]));
  }

  const body = rows.map((r) => "| " + r.join(" | ") + " |").join("\n") + "\n";
  const timestamp = `_Last updated at ${new Date().toLocaleString()} by Kanban plugin_`;

  return header + headerSep + body + timestamp;
}

export function getMdList(boardState: BoardState): string {
  if (!boardState.columns) return "";

  const numCols = boardState.columns.length;
  const cols: string[] = [];
  for (let i = 0; i < numCols; i++) {
    cols[i] = ("## " + boardState.columns[i].name + "\n" +
      boardState.columns[i].notes.map((note) => "- " + getMdLink(note)).join("\n"));
  }

  const body = cols.join("\n\n")
  const timestamp = `\n\n_Last updated at ${new Date().toLocaleString()} by Kanban plugin_`;

  return body + timestamp;
}

export function getMdLink(note: NoteData): string {
  if ((note?.title !== undefined) && (note?.id !== undefined)) {
    return "[" + note.title + "](:/" + note.id + ")";
  } else return "";
}

export async function getBoardState(board?: Board): Promise<BoardState> {
  if (!board) throw new Error("No open board");

  const state: BoardState = {
    name: board.boardName,
    messages: [],
    hiddenTags: [],
  };

  if (board.isValid) {
    const allNotes = await searchNotes(board.rootNotebookName);
    const sortedNotes: { [col: string]: NoteData[] } = {};
    board.columnNames.forEach((n) => (sortedNotes[n] = []));
    for (const note of allNotes) {
      const colName = board.sortNoteIntoColumn(note);
      if (colName) sortedNotes[colName].push(note);
    }

    const sortedColumns: BoardState["columns"] = Object.entries(
      sortedNotes
    ).map(([name, notes]) => ({ name, notes }));

    Object.values(sortedColumns).forEach((col) =>
      col.notes.sort((a, b) => {
        if (a.order < b.order) return +1;
        if (a.order > b.order) return -1;
        return a.createdTime < b.createdTime ? +1 : -1;
      })
    );
    state.columns = sortedColumns;
    state.hiddenTags = board.hiddenTags;
  } else {
    state.messages = board.errorMessages;
  }

  return state;
}

export async function isNoteIdOnBoard(
  id: string,
  board: Board | undefined
): Promise<boolean> {
  if (!board || !board.isValid) return false;
  const note = await getNoteById(id);
  if (!note) return true;
  return board.sortNoteIntoColumn(note) !== null;
}

export const parseConfigNote = (
  yamlConfig: string
): { config?: Config; error?: Message } => {
  try {
    const fixedYaml = yamlConfig.replace(/\t/g, "  ");
    const configObj = yaml.load(fixedYaml) as Config;
    const configError = validateConfig(configObj);
    if (configError) return { error: configError };
    return { config: configObj };
  } catch (e) {
    return {
      error: {
        id: "parseError",
        severity: "error",
        title: "YAML Parse error",
        details: e.message,
        actions: [],
      },
    };
  }
};

const configErr = (title: string, details?: string): Message => ({
  id: "configError",
  severity: "error",
  title,
  details,
  actions: [],
});

const validateConfig = (config: Config | {} | null): Message | null => {
  if (!config || typeof config !== "object")
    return configErr("Configuration is empty");
  if (!("columns" in config)) return configErr("There are no columns defined!");
  if (!Array.isArray(config.columns))
    return configErr("Columns has to be a list");
  if (config.columns.length === 0)
    return configErr("You have to define at least one column");

  if ("filters" in config) {
    if (typeof config.filters !== "object" || Array.isArray(config.filters))
      return configErr("Filters has to contain a dictionary of rules");
    for (const key in config.filters) {
      if (!(key in rules) && key !== "rootNotebookPath")
        return configErr(`Invalid rule type "${key}" in filters`);
    }
  }

  for (const col of config.columns) {
    if (typeof col !== "object" || Array.isArray(col))
      return configErr(
        `Column #${config.columns.indexOf(col) + 1} is not a dictionary`
      );
    if (!("name" in col) || typeof col.name !== "string" || col.name === "")
      return configErr(
        `Column #${config.columns.indexOf(col) + 1} has no name!`
      );

    const isBacklog = "backlog" in col && col.backlog;
    for (const key in col) {
      if (!(key in rules) && key !== "backlog" && key !== "name")
        return configErr(`Invalid rule type "${key}" in column "${col.name}"`);
      if (isBacklog && key !== "backlog" && key !== "name")
        return configErr(
          `If a column is marked as backlog, it cannot have any other rules specified. Remove ${key} rule from ${col.name}!`
        );
    }
  }

  return null;
};

export default async function ({
  id: configNoteId,
  title: boardName,
  body: configBody,
  parent_id: boardNotebookId,
}: ConfigNote): Promise<Board | null> {
  const configYaml = getYamlConfig(configBody);
  if (!configYaml) return null;

  const boardBase: BoardBase = {
    boardName,
    configNoteId,
    configYaml,
    isValid: false,
  };

  const { config: configObj, error } = parseConfigNote(configYaml);
  if (!configObj) {
    return { ...boardBase, isValid: false, errorMessages: [error as Message] };
  }

  const { rootNotebookPath = await getNotebookPath(boardNotebookId) } =
    configObj.filters || {};
  const rootNotebookName = rootNotebookPath.split("/").pop() as string;

  const baseFilters: Rule["filterNote"][] = [
    (await rules.excludeNoteId(configNoteId, rootNotebookPath, configObj))
      .filterNote,
  ];

  if (rootNotebookPath !== "/") {
    baseFilters.push(
      (await rules.notebookPath(rootNotebookPath, "", configObj)).filterNote
    );
  }

  let hiddenTags: string[] = [];
  for (const key in configObj.filters) {
    let val = configObj.filters[key];
    if (typeof val === "boolean") val = `${val}`;
    if (val && key in rules) {
      const rule = await rules[key](val, rootNotebookPath, configObj);
      baseFilters.push(rule.filterNote);
      if (key === "tag") hiddenTags.push(val as string);
      else if (key === "tags")
        hiddenTags = [...hiddenTags, ...(val as string[])];
    }
  }

  let backlogCol: Column | undefined;
  const regularColumns: Column[] = [];
  const allColumns: Column[] = [];
  for (const col of configObj.columns) {
    const newCol: Column = {
      name: col.name,
      rules: [],
    };
    allColumns.push(newCol);

    if (col.backlog) {
      backlogCol = newCol;
    } else {
      for (const key in col) {
        let val = col[key];
        if (typeof val === "boolean") val = `${val}`;
        if (val && key in rules) {
          const rule = await rules[key](val, rootNotebookPath, configObj);
          newCol.rules.push(rule);
          if (key === "tag") hiddenTags.push(val as string);
          else if (key === "tags")
            hiddenTags = [...hiddenTags, ...(val as string[])];
        }
      }
      regularColumns.push(newCol);
    }
  }

  const board: Board = {
    ...boardBase,
    isValid: true,
    rootNotebookName,
    parsedConfig: configObj,
    hiddenTags,
    columnNames: configObj.columns.map(({ name }) => name),

    sortNoteIntoColumn(note: NoteData) {
      const matchesBaseFilters = baseFilters.every((f) => f(note));
      if (matchesBaseFilters) {
        const foundCol = regularColumns.find(({ rules }) =>
          rules.some(({ filterNote }) => filterNote(note))
        );
        if (foundCol) return foundCol.name;
        if (backlogCol) return backlogCol.name;
      }

      return null;
    },

    actionToQuery(action: Action, boardState: BoardState) {
      switch (action.type) {
        case "newNote":
          const col = allColumns.find(
            ({ name }) => name === action.payload.colName
          ) as Column;
          return col.rules.flatMap((r) => r.set(action.payload.noteId || ""));

        case "moveNote":
          const { noteId, newColumnName, oldColumnName, newIndex } =
            action.payload;
          const newCol = allColumns.find(
            ({ name }) => name === newColumnName
          ) as Column;
          const oldCol = allColumns.find(
            ({ name }) => name === oldColumnName
          ) as Column;

          const unsetQueries = oldCol.rules.flatMap((r) => r.unset(noteId));
          const setQueries = newCol.rules.flatMap((r) => r.set(noteId));
          const queries: UpdateQuery[] = [...unsetQueries, ...setQueries];

          const setOrder = (note: string, order: number) =>
            queries.push({
              type: "put",
              path: ["notes", note],
              body: { order },
            });
          const notesInCol = boardState.columns?.find(
            (col) => col.name === newColumnName
          )?.notes as NoteData[];
          const notes = notesInCol.filter((note) => note.id !== noteId);
          if (notes.length > 0) {
            if (newIndex === 0) {
              setOrder(noteId, notes[0].order + 1);
            } else if (newIndex >= notes.length) {
              setOrder(noteId, notes[notes.length - 1].order - 1);
            } else {
              const newOrder = notes[newIndex - 1].order - 1;
              setOrder(noteId, newOrder);
              const notesAfter = notesInCol.slice(newIndex);
              notesAfter.forEach(
                (note, idx) =>
                  note.id !== noteId && setOrder(note.id, newOrder - 1 - idx)
              );
            }
          }

          return queries;
        default:
          throw new Error("Unknown action " + action.type);
      }
    },
  };

  return board;
}
