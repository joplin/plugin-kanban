import * as yaml from "js-yaml";
import rules from "./rules";
import { Config, Message } from "./types";

const configRegex = /([\s\S]*?)```kanban([\s\S]*?)```([\s\S]*)/;

/**
 * Updates the current body of the config note with a new config and/or after text.
 *
 * @param config Make sure to pass in the config **without** the ```kanban fence.
 */
export const getUpdatedConfigNote = (
  oldBody: string,
  config: string | null,
  after: string | null
) => {
  let repl = "$1```kanban";
  if (config) repl += "\n" + config;
  else repl += "$2";
  repl += "```";
  if (after) repl += "\n" + after;
  else repl += "$3";
  return oldBody.replace(configRegex, repl);
};

/**
 * Extract the yaml config from the note body, without the ```kanban fence,
 */
export const getYamlConfig = (boardNoteBody: string): string | null => {
  const match = boardNoteBody.match(configRegex);
  if (!match || match.length < 3) return null;
  return match[2];
};

const configErr = (title: string, details?: string): Message => ({
  id: "configError",
  severity: "error",
  title,
  details,
  actions: [],
});

/**
 * Validate a config object parsed from yaml, ensuring it will result in a valid board.
 */
export const validateConfig = (config: Config | {} | null): Message | null => {
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

  if ("sort" in config) {
    if (typeof config.sort !== "object" || config.sort.by === undefined)
      return configErr("Sort must be a dictionary with a single 'by' field");
    let cs = config.sort.by;
    if (cs.startsWith('-')) cs = cs.substring(1);
    if (['createdTime', 'title'].indexOf(cs) === -1)
      return configErr("Sort must be one of 'createdTime', 'title'; optionally prefix by '-' for descending order");
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

/**
 * Parse a string of yaml and validate it.
 */
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
        details: (e as Error).message,
        actions: [],
      },
    };
  }
};
