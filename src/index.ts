import joplin from "api";

import createBoard, { Board } from "./board";
import {
  getConfigNote,
  getNoteById,
  searchNotes,
  executeUpdateQuery,
  NoteData,
} from "./noteData";
import { Action } from "./actions";
import type { BoardState } from "./gui/hooks";

let openBoard: Board | undefined;
let view: string | undefined;
let pollCb: () => void | undefined;

const fs = window.require("fs")
const path = window.require("path")
let logFilePath: string;
joplin.settings.globalValue("profileDir").then((v) => logFilePath = path.join(v, "kanban-logs.txt"))
export function log(msg: string) {
  fs.appendFile(logFilePath, `[${new Date().toISOString()}]: ${msg}\n`, () => {})
}

async function showError(err: string) {
  log(`Showing error: ${err}`)
  if (!view) view = await joplin.views.panels.create("kanban");
  await joplin.views.panels.setHtml(view, err);
  await joplin.views.panels.show(view);
}

async function showBoard() {
  log(`Displaying board`)
  if (!view) {
    log(`Opening board for the first time, creating`)
    view = await joplin.views.panels.create("kanban");
    await joplin.views.panels.setHtml(view, '<div id="root"></div>');
    await joplin.views.panels.addScript(view, "gui/main.css");
    await joplin.views.panels.addScript(view, "gui/index.js");
    joplin.views.panels.onMessage(view, async (msg: Action) => {
      log(`Got message from webview:\n${JSON.stringify(msg, null, 4)}\n`)
      if (!openBoard) return;
      if (msg.type === "poll") {
        await new Promise((res) => (pollCb = res));
      } else if (msg.type !== "load") {
        for (const query of openBoard.actionToQuery(msg)) {
          log(`Executing update: \n${JSON.stringify(query, null, 4)}\n`)
          await executeUpdateQuery(query);
        }
      }

      const newState = { name: openBoard.boardName, columns: await getSortedNotes() };
      log(`Sending back update to webview: \n${JSON.stringify(newState, null, 4)}\n`)
      return newState;
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
  openBoard.columnNames.forEach((n) => (sortedNotes[n] = []));
  allNotes.forEach((note) => {
    const colName = openBoard?.sortNoteIntoColumn(note);
    if (colName) sortedNotes[colName].push(note);
  });

  const sortedColumns: BoardState["columns"] = Object.entries(sortedNotes).map(
    ([name, notes]) => ({ name, notes })
  );
  return sortedColumns;
}

async function isNoteIdOnBoard(id: string): Promise<boolean> {
  if (!openBoard) return false;
  const note = await getNoteById(id);
  if (!note) return true;
  return openBoard.sortNoteIntoColumn(note) !== null;
}

async function handleNewlyOpenedNote(newNoteId: string) {
  log(`Opened new note, id: ${newNoteId}`)
  if (openBoard) {
    if (openBoard.configNoteId === newNoteId) return;
    if (await isNoteIdOnBoard(newNoteId)) return;
    else {
      log(`Opened note not on the board, closing`)
      hideBoard();
      openBoard = undefined;
    }
  }

  if (!openBoard || (openBoard as Board).configNoteId !== newNoteId) {
    const note = await getConfigNote(newNoteId);
    try {
      const board = await createBoard(note);
      if (board) {
        log(`Created new board: \n${JSON.stringify(board, null, 4)}\n`)
        openBoard = board;
        showBoard();
      }
    } catch (e) {
      if (e.message) showError(e.message);
    }
  }
}

joplin.plugins.register({
  onStart: async function () {
    log("\nKANBAN PLUGIN STARTED\n")

    joplin.workspace.onNoteSelectionChange(
      ({ value }: { value: [string?] }) => {
        const newNoteId = value?.[0];
        if (pollCb) pollCb();
        if (newNoteId) handleNewlyOpenedNote(newNoteId);
      }
    );

    joplin.workspace.onNoteChange(async ({ id }) => {
      log(`Note ${id} changed`);
      if (!openBoard) return;
      if (openBoard.configNoteId === id && pollCb) {
        const note = await getConfigNote(id);
        const board = await createBoard(note);
        if (board) {
          log(`Updated board config: \n${JSON.stringify(board, null, 4)}\n`)
          openBoard = board;
          if (pollCb) pollCb();
        } else {
          hideBoard();
        }
      } else if (await isNoteIdOnBoard(id)) {
        log("Changed note was on the board, updating");
        if (pollCb) pollCb();
      }
    });
  },
});
