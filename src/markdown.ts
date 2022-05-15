import { BoardState, NoteData } from "./types";

/**
 * Get a markdown table representation of the board as a string.
 *
 * @see https://joplinapp.org/markdown/#tables
 */
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

/**
 * Get a markdown list representation of the board as a string.
 *
 * @see https://github.com/joplin/plugin-kanban/pull/19
 */
export function getMdList(boardState: BoardState): string {
  if (!boardState.columns) return "";

  const numCols = boardState.columns.length;
  const cols: string[] = [];
  for (let i = 0; i < numCols; i++) {
    cols[i] =
      "## " +
      boardState.columns[i].name +
      "\n" +
      boardState.columns[i].notes
        .map((note) => "- " + getMdLink(note))
        .join("\n");
  }

  const body = cols.join("\n\n");
  const timestamp = `\n\n_Last updated at ${new Date().toLocaleString()} by Kanban plugin_`;

  return body + timestamp;
}

/**
 * Get a markdown link to the given note as a string.
 *
 * @see https://github.com/joplin/plugin-kanban/pull/19
 */
export function getMdLink(note: NoteData): string {
  if (note?.title !== undefined && note?.id !== undefined) {
    return "[" + note.title + "](:/" + note.id + ")";
  } else return "";
}
