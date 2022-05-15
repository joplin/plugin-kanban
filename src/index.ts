import joplin from "api";
import * as yaml from "js-yaml";

import Board from "./board";
import { getYamlConfig, parseConfigNote } from "./parser";
import {
  getConfigNote,
  setConfigNote,
  executeUpdateQuery,
  getAllTags,
  getAllNotebooks,
  getNoteById,
  searchNotes,
} from "./noteData";
import { getRuleEditorTypes } from "./rules";
import { getMdList, getMdTable } from "./markdown";

import type { Action } from "./actions";
import type { ConfigUIData } from "./configui";
import type { Config, BoardState } from "./types";

let openBoard: Board | undefined;
let pollCb: (() => void) | undefined;
let newNoteChangedCb: ((noteId: string) => void) | undefined;

// UI VIEWS

let dialogView: string | undefined;
/**
 * Constructs and shows the UI configurator.
 * @returns The newly generated YAML, without ```kanban fence.
 */
async function showConfigUI(targetPath: string) {
  if (!openBoard || !openBoard.parsedConfig) return;

  if (!dialogView) {
    dialogView = await joplin.views.dialogs.create("kanban-config-ui");
    await joplin.views.dialogs.addScript(dialogView, "configui/main.css");
    await joplin.views.dialogs.addScript(dialogView, "configui/index.js");
  }

  const config: Config =
    targetPath === "columnnew"
      ? {
          ...openBoard.parsedConfig,
          columns: [...openBoard.parsedConfig.columns, { name: "New Column" }],
        }
      : openBoard.parsedConfig;

  if (targetPath.startsWith("columns.")) {
    const [, colName] = targetPath.split(".", 2);
    const colIdx = openBoard.parsedConfig.columns.findIndex(
      ({ name }) => name === colName
    );
    targetPath = `columns.${colIdx}`;
  }
  if (targetPath === "columnnew")
    targetPath = `columns.${config.columns.length - 1}`;

  const data: ConfigUIData = {
    config,
    targetPath,
    ruleEditorTypes: getRuleEditorTypes(targetPath),
    allTags: await getAllTags(),
    allNotebooks: (await getAllNotebooks()).map((n) => n.title),
  };

  const html = `
    <template id="data">
      ${JSON.stringify(data)}
    </template>
    <div id="root"></div>
  `;
  await joplin.views.dialogs.setHtml(dialogView, html);
  const result = await joplin.views.dialogs.open(dialogView);
  if (result.id === "ok" && result.formData) {
    const newYaml = result.formData.config.yaml;
    return newYaml;
  }
}

let boardView: string | undefined;
/**
 * Constructs and shows the main kanban panel.
 */
async function showBoard() {
  if (!boardView) {
    boardView = await joplin.views.panels.create("kanban");
    // Template tags seem to be the easiest way to pass static data to a view
    // If a better way is found, this should be changed
    const html = `
      <template id="date-fmt">${await joplin.settings.globalValue(
        "dateFormat"
      )}</template>
      <div id="root"></div>
      <div id="menu-root"></div>
    `;
    await joplin.views.panels.setHtml(boardView, html);
    await joplin.views.panels.addScript(boardView, "gui/main.css");
    await joplin.views.panels.addScript(boardView, "gui/index.js");
    joplin.views.panels.onMessage(boardView, handleKanbanMessage);
  } else if (!(await joplin.views.panels.visible(boardView))) {
    await joplin.views.panels.show(boardView);
  }
}

/**
 * Hides the active kanban panel.
 */
function hideBoard() {
  if (boardView) joplin.views.panels.hide(boardView);
}

// CONFIG HANDLING

/**
 * Try loading a config from noteId. If succesful, replace the current board,
 * if not destroy it (because we are assuming the config became invalid).
 */
async function reloadConfig(noteId: string) {
  const note = await getConfigNote(noteId);
  const board =
    noteId === openBoard?.configNoteId
      ? openBoard
      : new Board(noteId, note.parent_id, note.title);
  const ymlConfig = getYamlConfig(note.body);
  const valid = ymlConfig !== null && (await board.loadConfig(ymlConfig));
  if (valid) {
    openBoard = board;
  } else {
    openBoard = undefined;
    hideBoard();
  }
}

// EVENT HANDLERS

/**
 * Handle messages coming from the webview.
 *
 * Almost all changes to the state occur in this method.
 */
async function handleKanbanMessage(msg: Action) {
  if (!openBoard) return;

  const allNotesOld = await searchNotes(openBoard.rootNotebookName);
  const oldState: BoardState = await openBoard.getBoardState(allNotesOld);

  switch (msg.type) {
    case "poll": {
      await new Promise((res) => (pollCb = res));
      break;
    }

    case "settings": {
      const { target } = msg.payload;
      const newConf = await showConfigUI(target);
      if (newConf) {
        await setConfigNote(openBoard.configNoteId, newConf);
        await reloadConfig(openBoard.configNoteId);
      }
      break;
    }

    case "deleteCol": {
      if (!openBoard.parsedConfig) break;
      const colIdx = openBoard.parsedConfig.columns.findIndex(
        ({ name }) => name === msg.payload.colName
      );
      const newConf: Config = {
        ...openBoard.parsedConfig,
        columns: [
          ...openBoard.parsedConfig.columns.slice(0, colIdx),
          ...openBoard.parsedConfig.columns.slice(colIdx + 1),
        ],
      };
      await setConfigNote(openBoard.configNoteId, yaml.dump(newConf));
      await reloadConfig(openBoard.configNoteId);
      break;
    }

    case "addColumn": {
      const newConf = await showConfigUI("columnnew");
      if (newConf) {
        await setConfigNote(openBoard.configNoteId, newConf);
        await reloadConfig(openBoard.configNoteId);
      }
      break;
    }

    case "messageAction": {
      const { messageId, actionName } = msg.payload;
      if (messageId === "reload" && actionName === "reload") {
        await reloadConfig(openBoard.configNoteId);
      }
      // New message action add here
      break;
    }

    case "openNote": {
      await joplin.commands.execute("openNote", msg.payload.noteId);
      break;
    }

    case "newNote": {
      await joplin.commands.execute("newNote");
      // TODO: this one's buggy
      newNoteChangedCb = async (noteId: string) => {
        if (!openBoard || !openBoard.isValid) return;
        msg.payload.noteId = noteId;
        for (const query of openBoard.getBoardUpdate(msg, oldState)) {
          await executeUpdateQuery(query);
        }
      };
      break;
    }

    // New state is sent in any case, so load is a no-op
    case "load":
      break;

    // Propagete action to the active board
    default: {
      if (!openBoard.isValid) break;
      const updates = openBoard.getBoardUpdate(msg, oldState);
      for (const query of updates) {
        await executeUpdateQuery(query);
      }
    }
  }

  const allNotesNew = await searchNotes(openBoard.rootNotebookName);
  const newState: BoardState = await openBoard.getBoardState(allNotesNew);
  const currentYaml = getYamlConfig(
    (await getConfigNote(openBoard.configNoteId)).body
  );
  if (currentYaml !== openBoard.configYaml) {
    if (!currentYaml) return hideBoard();
    const { error } = parseConfigNote(currentYaml);
    newState.messages.push(
      error || {
        id: "reload",
        severity: "warning",
        title:
          "The configuration has changed, would you like to reload the board?",
        actions: ["reload"],
      }
    );
  }

  if (msg.type !== "poll") {
    if (
      openBoard.isValid &&
      openBoard.parsedConfig?.display?.markdown == "list"
    )
      setConfigNote(openBoard.configNoteId, null, getMdList(newState));
    else if (
      openBoard.isValid &&
      (openBoard.parsedConfig?.display?.markdown == "table" ||
        openBoard.parsedConfig?.display?.markdown == undefined)
    )
      setConfigNote(openBoard.configNoteId, null, getMdTable(newState));
  }

  return newState;
}

/**
 * Handle note selection change, check if a new board has been opened, or if we left
 * the domain of the current board.
 */
async function handleNewlyOpenedNote(newNoteId: string) {
  if (openBoard) {
    if (openBoard.configNoteId === newNoteId) return;
    if (await openBoard.isNoteIdOnBoard(newNoteId)) return;
    else {
      hideBoard();
      openBoard = undefined;
    }
  }

  if (!openBoard || (openBoard as Board).configNoteId !== newNoteId) {
    await reloadConfig(newNoteId);
    if (openBoard) {
      showBoard();
    }
  }
}

joplin.plugins.register({
  onStart: async function () {
    // Have to call this on start otherwise layout from prevoius session is lost
    showBoard().then(hideBoard);

    let startedHandlingNewNote = false;
    joplin.workspace.onNoteSelectionChange(
      async ({ value }: { value: [string?] }) => {
        const newNoteId = value?.[0] as string;
        if (newNoteChangedCb && (await getNoteById(newNoteId)))
          newNoteChangedCb = undefined;
        if (newNoteId) handleNewlyOpenedNote(newNoteId);
      }
    );

    joplin.workspace.onNoteChange(async ({ id }) => {
      if (!openBoard) return;
      if (openBoard.configNoteId === id) {
        if (!openBoard.isValid) await reloadConfig(id);
        if (pollCb) pollCb();
      } else if ((await openBoard.isNoteIdOnBoard(id)) || newNoteChangedCb) {
        if (newNoteChangedCb && !startedHandlingNewNote) {
          startedHandlingNewNote = true;
          const note = await getNoteById(id);
          if (note) {
            setTimeout(() => {
              (newNoteChangedCb as (id: string) => void)(id);
              newNoteChangedCb = undefined;
              startedHandlingNewNote = false;
              if (pollCb) pollCb();
            }, 100); // For some reason this delay is required to make adding new notes reliable
          } else startedHandlingNewNote = false;
        }
        if (pollCb) pollCb();
      }
    });
  },
});
