import joplin from "api";

import createBoard, { Board } from "./board";
import { getConfigNote, searchNotes, executeUpdateQuery } from "./noteData";
import { Action } from "./actions";

let openBoard: Board | undefined;

async function showBoard() {}

function hideBoard() {}

function getNotesForEachColumn() {
  if (!openBoard) return;

  return Promise.all(
    openBoard.columnQueries.map(async ({ colName, query }) => ({
      name: colName,
      notes: await searchNotes(query),
    }))
  );
}

async function handleNewlyOpenedNote(newNoteId: string) {
  if (openBoard) {
    const allNotesOnBoard = await searchNotes(openBoard.allNotesQuery);
    const containsOpenedNote = !!allNotesOnBoard.find(
      ({ id }) => id === newNoteId
    );

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
  onStart: async function () {
    joplin.workspace.onNoteSelectionChange(
      async ({ value }: { value: [string?] }) => {
        const newNoteId = value?.[0];
        if (newNoteId) handleNewlyOpenedNote(newNoteId);
      }
    );

    const view = await joplin.views.panels.create("kanban");
    await joplin.views.panels.setHtml(view, '<div id="root"></div>');
    await joplin.views.panels.addScript(view, "gui/main.css")
    await joplin.views.panels.addScript(view, "gui/index.js");
    joplin.views.panels.onMessage(view, async (msg: Action) => {
      if (!openBoard) return;
      if (msg.type !== "load")
        await Promise.all(openBoard.actionToQuery(msg).map(executeUpdateQuery));
      return { name: openBoard.boardName, columns: await getNotesForEachColumn() };
    });
  },
});
