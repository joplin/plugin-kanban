import { getBoardNote, resolveNotebookPath, searchNotes } from "./noteData";
import parseConfigNote from "./parseConfigNote";
import {
  Rule,
  BoardConfig,
  ColumnConfig,
  BoardState,
  SortedColumn,
} from "./types";

const createQueryFromRules = (rules: Rule[], negate: boolean) =>
  rules
    .map(({ searchQueries }) =>
      searchQueries.map((s) => (negate ? "-" + s : s)).join(" ")
    )
    .join("	");

function buildSearchQuery(board: BoardConfig, colIdx: number) {
  const col = board.columns[colIdx];
  const filterQuery = createQueryFromRules(board.filters, false) + " ";
  if (!col.backlog) {
    return filterQuery + createQueryFromRules(col.rules, false);
  } else {
    return (
      filterQuery +
      board.columns
        .filter((c) => c !== col)
        .map((c) => createQueryFromRules(c.rules, true))
        .join(" ")
    );
  }
}

async function fetchBoardState(board: BoardConfig): Promise<BoardState> {
  const sortedColumns: SortedColumn[] = [];
  for (let colIdx = 0; colIdx < board.columns.length; colIdx++) {
    const { name } = board.columns[colIdx];
    sortedColumns.push({
      name,
      notes: await searchNotes(buildSearchQuery(board, colIdx)),
    });
  }

  return {
    boardName: board.boardName,
    sortedColumns,
  };
}

export default async function (boardNoteId: string) {
  const boardNote = await getBoardNote(boardNoteId);
  const config = await parseConfigNote(boardNote);
  if (!config) return;

  console.log("parsedConfig", config);
  console.log("sortedColumns", await fetchBoardState(config));
}
