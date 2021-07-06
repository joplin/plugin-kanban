import * as yaml from "js-yaml";
import { getNotebookName, NoteData } from './noteData'

import rules, { Rule } from "./rules";
import {
  resolveNotebookPath,
  ConfigNote,
  UpdateQuery,
} from "./noteData";
import type { Action } from "./actions";

export interface Config {
  filters: {
    [ruleName: string]: string | string[];
    rootNotebookPath: string;
  };
  columns: {
    [ruleName: string]: string | string[] | boolean | undefined;
    name: string;
    backlog?: boolean;
  }[];
}

interface Column {
  name: string;
  rules: Rule[];
}

export interface Board {
  configNoteId: string;
  boardName: string;
  columnNames: string[];
  rootNotebookName: string;
  sortNoteIntoColumn(note: NoteData): string | null;
  actionToQuery(action: Action): UpdateQuery[];
}

const parseConfigNote = (boardNoteBody: string): Config | null | {} => {
  const configRegex = /^```kanban(.*)```/ms;
  const match = boardNoteBody.match(configRegex);
  if (!match || match.length < 2) return null;

  const configStr = match[1];
  const configObj = yaml.load(configStr) as Config | {};

  // TODO: return error messages on invalid configs
  return configObj;
};

export default async function({
  id: configNoteId,
  title: boardName,
  body: configBody,
  parent_id: boardNotebookId,
}: ConfigNote): Promise<Board | null> {
  const configObj = parseConfigNote(configBody);
  if (!configObj || !("filters" in configObj) || !("columns" in configObj))
    return null;

  const { rootNotebookPath = "." } = configObj.filters;
  const rootNotebookId =
    rootNotebookPath === "."
      ? boardNotebookId
      : await resolveNotebookPath(rootNotebookPath);
  if (!rootNotebookId) return null;
  const rootNotebookName = await getNotebookName(rootNotebookId);

  const baseFilters: Rule["filterNote"][] = [];
  for (const key in configObj.filters) {
    const val = configObj.filters[key];
    if (key in rules) {
      const rule = await rules[key](val, configObj);
      baseFilters.push(rule.filterNote)
    } else if (key === 'rootNotebookPath') {
      const rule = await rules.notebookPath(val, configObj);
      baseFilters.push(rule.filterNote)
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
          const rule = await rules[key](val, configObj);
          newCol.rules.push(rule);
        }
      }
      regularColumns.push(newCol);
    }
  }


  const board: Board = {
    configNoteId,
    boardName,
    rootNotebookName,
    columnNames: configObj.columns.map(({ name }) => name),

    sortNoteIntoColumn(note: NoteData) {
      const matchesBaseFilters = baseFilters.every(f => f(note))
      if (matchesBaseFilters) {
        const foundCol = regularColumns.find(({ rules }) => rules.some(({ filterNote }) => filterNote(note)))
        if (foundCol) return foundCol.name
        if (backlogCol) return backlogCol.name
      }

      return null;
    },

    actionToQuery(action: Action) {
      switch (action.type) {
        case "moveNote":
          const { noteId, newColumnName, oldColumnName } = action.payload;
          const newCol = allColumns.find(
            ({ name }) => name === newColumnName
          ) as Column;
          const oldCol = allColumns.find(
            ({ name }) => name === oldColumnName
          ) as Column;

          const unsetQueries = oldCol.rules.flatMap((r) => r.unset(noteId));
          const setQueries = newCol.rules.flatMap((r) => r.set(noteId));

          return [...unsetQueries, ...setQueries];
        default:
          throw new Error("Unknown action " + action.type);
      }
    },
  };

  return board;
}
