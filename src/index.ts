import joplin from "api";

import createBoard, { Board } from "./board";
import { getConfigNote, searchNotes } from "./noteData";

let openBoard: Board | undefined;

function showBoard() {}

function hideBoard() {}

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
  },
});
