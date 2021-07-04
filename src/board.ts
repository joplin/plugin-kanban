import * as yaml from "js-yaml";

import rules, { Rule } from "./rules";
import {
  resolveNotebookPath,
  ConfigNote,
  SearchQuery,
  UpdateQuery,
} from "./noteData";
import { createFilter, SearchFilter } from "./noteData"
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
  backlog: boolean;
}

export interface Board {
  configNoteId: string;
  boardName: string;
  allNotesQuery: SearchQuery;
  columnQueries: {
    colName: string;
    query: SearchQuery;
  }[];
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

const negateRule = (rule: Rule): Rule => ({
  ...rule,
  searchFilters: rule.searchFilters.map((f) => ({ ...f, negated: true }))
})

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

  let baseFilters: SearchFilter[] = [];
  for (const key in configObj.filters) {
    if (key === "rootNotebookPath") {
      baseFilters.push(createFilter("notebookid", rootNotebookId))
    } else if (key in rules) {
      const val = configObj.filters[key];
      const rule = await rules[key](val, configObj);
      baseFilters = baseFilters.concat(rule.searchFilters)
    }
  }

  const columns: Column[] = [];
  for (const col of configObj.columns) {
    const newCol: Column = {
      name: col.name,
      backlog: col.backlog === true,
      rules: [],
    };

    for (const key in col) {
      let val = col[key];
      if (typeof val === "boolean") val = `${val}`;
      if (val && key in rules) {
        const rule = await rules[key](val, configObj);
        newCol.rules.push(rule);
      }
    }

    columns.push(newCol);
  }

  const columnQueries: Board["columnQueries"] = [];
  columns.forEach((col) => {
    let filters = [...baseFilters];
    if (!col.backlog) {
      filters = filters.concat(col.rules.flatMap(r => r.searchFilters))
    } else {
      const allOtherCols = columns.filter((c: Column) => c !== col);
      filters = filters.concat(allOtherCols.flatMap(c => c.rules.flatMap(r => negateRule(r).searchFilters)))
    }

    columnQueries.push({
      colName: col.name,
      query: {
        type: "search",
        filters,
      },
    });
  });

  const board: Board = {
    configNoteId,
    boardName,
    columnQueries,

    actionToQuery(action: Action) {
      switch (action.type) {
        case "moveNote":
          const { noteId, newColumnName, oldColumnName } = action.payload;
          const newCol = columns.find(
            ({ name }) => name === newColumnName
          ) as Column;
          const oldCol = columns.find(
            ({ name }) => name === oldColumnName
          ) as Column;

          const unsetQueries = oldCol.rules.flatMap((r) => r.unset(noteId));
          const setQueries = newCol.rules.flatMap((r) => r.set(noteId));

          return [...unsetQueries, ...setQueries];
        default:
          throw new Error("Unknown action " + action.type);
      }
    },

    allNotesQuery: {
      type: "search",
      filters: baseFilters,
    },
  };

  return board;
}
