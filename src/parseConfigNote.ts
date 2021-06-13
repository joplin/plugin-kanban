import * as yaml from "js-yaml";

import rules from "./rules";
import { BoardConfig, ColumnConfig, BoardNoteData, RawConfig } from "./types";
import { resolveNotebookPath } from "./noteData";

/**
 * Attempts to parse a configuration note. Returns null if it does not contain a valid config.
 * TODO: return error messages on invalid configs
 */
export default async function (
  boardNote: BoardNoteData
): Promise<BoardConfig | null> {
  const configRegex = /^```kanban(.*)```/ms;
  const match = boardNote.body.match(configRegex);
  if (!match || match.length < 2) return null;

  const configStr = match[1];
  const configObj = yaml.load(configStr) as RawConfig;

  const { rootNotebookPath = "." } = configObj.filters;
  const rootNotebookId =
    rootNotebookPath === "."
      ? boardNote.parent_id
      : (await resolveNotebookPath(rootNotebookPath))?.id;
  if (!rootNotebookId) return null;

  const config: BoardConfig = {
    boardName: boardNote.title,
    rootNotebook: { id: rootNotebookId },
    filters: [],
    columns: [],
  };

  for (const key in configObj.filters) {
    if (key !== "rootNotebookPath" && key in rules) {
      const val = configObj.filters[key];
      const rule = await rules[key](val, configObj);
      config.filters.push(rule);
    }
  }

  for (const col of configObj.columns) {
    const newCol: ColumnConfig = {
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

    config.columns.push(newCol);
  }

  return config;
}
