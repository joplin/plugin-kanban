import * as yaml from "js-yaml";

import rules, { Rule } from "./rules";
import {
  resolveNotebookPath,
  ApiQuery,
  ConfigNote,
  SearchQuery,
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
  boardName: string;
  checkIfHasNoteQuery(noteId: string): ApiQuery;
  columnQueries: {
    [colName: string]: ApiQuery;
  };
  actionToQuery(action: Action): ApiQuery[];
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

  const filters: Rule[] = [];
  for (const key in configObj.filters) {
    if (key !== "rootNotebookPath" && key in rules) {
      const val = configObj.filters[key];
      const rule = await rules[key](val, configObj);
      filters.push(rule);
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
    let query = createQueryFromRules(filters, false) + " ";
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

  const allNotesQueryStr = (
    Object.values(columnQueries) as SearchQuery[]
  ).reduce((acc, { query }) => `${acc} ${query}`, "");

  const board: Board = {
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

    checkIfHasNoteQuery: (noteId: string) => ({
      type: "search",
      query: `id:${noteId} ${allNotesQueryStr}`,
    }),
  };

  return board;
}
