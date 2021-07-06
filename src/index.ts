import joplin from "api";

import createBoard, { Board } from "./board";
import { getConfigNote, getNoteById, searchNotes, executeUpdateQuery, NoteData } from "./noteData";
import { Action } from "./actions";
import type { BoardState } from "./gui/hooks";

let openBoard: Board | undefined;
let view: string | undefined;

async function showBoard() {
  if (!view) {
    view = await joplin.views.panels.create("kanban");
    await joplin.views.panels.setHtml(view, '<div id="root"></div>');
    await joplin.views.panels.addScript(view, "gui/main.css")
    await joplin.views.panels.addScript(view, "gui/index.js");
    joplin.views.panels.onMessage(view, async (msg: Action) => {
      if (!openBoard) return;
      if (msg.type !== "load")
        await Promise.all(openBoard.actionToQuery(msg).map(executeUpdateQuery));
      return { name: openBoard.boardName, columns: await getSortedNotes() };
    });
  } else {
    await joplin.views.panels.show(view);
  }
}

function hideBoard() {
  if (view) joplin.views.panels.hide(view);
}

async function getSortedNotes() {
  if (!openBoard) return;

  const allNotes = await searchNotes(openBoard.rootNotebookName);
  const sortedNotes: { [col: string]: NoteData[] } = {};
  openBoard.columnNames.forEach((n) => sortedNotes[n] = [])
  allNotes.forEach((note) => {
    const colName = openBoard?.sortNoteIntoColumn(note)
    if (colName) sortedNotes[colName].push(note)
  })

  const sortedColumns: BoardState["columns"] = Object.entries(sortedNotes).map(([name, notes]) => ({ name, notes }))
  return sortedColumns;
}

async function handleNewlyOpenedNote(newNoteId: string) {
  if (openBoard) {
    if (openBoard.configNoteId === newNoteId) return;

    const note = await getNoteById(newNoteId);
    const containsOpenedNote = openBoard.sortNoteIntoColumn(note) !== null;
    if (containsOpenedNote) return;
    else {
      hideBoard();
      openBoard = undefined;
    }
  }

  if (!openBoard || (openBoard as Board).configNoteId !== newNoteId) {
    const note = await getConfigNote(newNoteId);
    const board = await createBoard(note);
    if (board) {
      openBoard = board;
      showBoard();
    }
  }
}

joplin.plugins.register({
  onStart: async function() {
    joplin.workspace.onNoteSelectionChange(
      ({ value }: { value: [string?] }) => {
        const newNoteId = value?.[0];
        if (newNoteId) handleNewlyOpenedNote(newNoteId);
      }
    );
  },
});
