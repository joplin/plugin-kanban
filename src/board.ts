import * as yaml from "js-yaml";

import rules, { Rule } from "./rules";
import {
  resolveNotebookPath,
  ConfigNote,
  SearchQuery,
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
  backlog: boolean;
}

export interface Board {
  configNoteId: string;
  boardName: string;
  allNotesQuery: SearchQuery;
  columnQueries: {
    [colName: string]: SearchQuery;
  };
  actionToQuery(action: Action): UpdateQuery[];
}

const parseConfigNote = (boardNoteBody: string): Config | null => {
  const configRegex = /^```kanban(.*)```/ms;
  const match = boardNoteBody.match(configRegex);
  if (!match || match.length < 2) return null;

  const configStr = match[1];
  const configObj = yaml.load(configStr) as Config;

  // TODO: return error messages on invalid configs
  return configObj;
};

const createQueryFromRules = (rules: Rule[], negate: boolean) =>
  rules
    .map(({ searchQueries }) =>
      searchQueries.map((s: string) => (negate ? `-${s}` : s)).join(" ")
    )
    .join("	");

export default async function ({
  id: configNoteId,
  title: boardName,
  body: configBody,
  parent_id: boardNotebookId,
}: ConfigNote): Promise<Board | null> {
  const configObj = parseConfigNote(configBody);
  if (!configObj) return null;

  const { rootNotebookPath = "." } = configObj.filters;
  const rootNotebookId =
    rootNotebookPath === "."
      ? boardNotebookId
      : await resolveNotebookPath(rootNotebookPath);
  if (!rootNotebookId) return null;

  let filterQuery: string = "";
  for (const key in configObj.filters) {
    if (key === "rootNotebookPath") {
      filterQuery += ` notebookid:${rootNotebookId}`
    } else if (key in rules) {
      const val = configObj.filters[key];
      const rule = await rules[key](val, configObj);
      filterQuery += " " + createQueryFromRules([rule], false);
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
      const val = col[key];
      if (val && key in rules && typeof val !== "boolean") {
        const rule = await rules[key](val, configObj);
        newCol.rules.push(rule);
      }
    }

    columns.push(newCol);
  }

  const columnQueries: Board["columnQueries"] = {};
  columns.forEach((col) => {
    let query = filterQuery + " ";
    if (!col.backlog) {
      query += createQueryFromRules(col.rules, false);
    } else {
      const allOtherCols = columns.filter((c: Column) => c !== col);
      query += allOtherCols
        .map((c: Column) => createQueryFromRules(c.rules, true))
        .join(" ");
    }

    columnQueries[col.name] = {
      type: "search",
      query,
    };
  });

  const board: Board = {
    configNoteId,
    boardName,
    columnQueries,

    actionToQuery({ type, payload }: Action) {
      switch (type) {
        case "moveNote":
          const { noteId, newColumnName, oldColumnName } = payload;
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
          throw new Error("Unknown action " + type);
      }
    },

    allNotesQuery: {
      type: "search",
      query: filterQuery,
    },
  };

  return board;
}
