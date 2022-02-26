import joplin from "api";
import * as yaml from "js-yaml";

import createBoard, {
  Board,
  Config,
  isNoteIdOnBoard,
  getYamlConfig,
  getBoardState,
  parseConfigNote,
  getMdTable,
  getMdList,
} from "./board";
import {
  getConfigNote,
  setConfig,
  executeUpdateQuery,
  getAllTags,
  getAllNotebooks,
  getNoteById,
  setAfterConfig,
} from "./noteData";
import { Action, MoveNoteAction } from "./actions";
import { getRuleEditorTypes } from "./rules";
import type { BoardState } from "./gui/hooks";
import type { ConfigUIData } from "./configui";

let openBoard: Board | undefined;
let view: string | undefined;
let pollCb: (() => void) | undefined;
let newNoteChangedCb: ((noteId: string) => void) | undefined;

const fs = window.require("fs");
const path = window.require("path");
let logFilePath: string;
joplin.settings
  .globalValue("profileDir")
  .then((v) => (logFilePath = path.join(v, "kanban-logs.txt")));
export function log(msg: string) {
  console.log(msg);
  fs.appendFile(
    logFilePath,
    `[${new Date().toISOString()}]: ${msg}\n`,
    () => {}
  );
}

let dialogView: string | undefined;
async function showConfigUI(targetPath: string) {
  if (!openBoard || !("parsedConfig" in openBoard)) return;
  log(`Displaying config UI for ${targetPath}`);

  if (!dialogView) {
    log(`Opening config UI for the first time, creating view`);
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
    log(`Received new YAML from config dialog:\n${newYaml}`);

    const wrappedConf = "```kanban\n" + newYaml + "\n```";
    return wrappedConf;
  } else {
    log("Dialog cancelled");
  }
}

async function reloadConfig(noteId: string) {
  const note = await getConfigNote(noteId);
  const board = await createBoard(note);
  if (board) {
    log(`Updated board config: \n${JSON.stringify(board, null, 4)}\n`);
    openBoard = board;
  } else {
    hideBoard();
  }
}

async function showBoard() {
  log(`Displaying board`);
  if (!view) {
    log(`Opening board for the first time, creating`);
    view = await joplin.views.panels.create("kanban");
    await joplin.views.panels.setHtml(
      view,
      '<div id="root"></div><div id="menu-root"></div>'
    );
    await joplin.views.panels.addScript(view, "gui/main.css");
    await joplin.views.panels.addScript(view, "gui/index.js");
    joplin.views.panels.onMessage(view, async (msg: Action) => {
      log(`Got message from webview:\n${JSON.stringify(msg, null, 4)}\n`);
      if (!openBoard) return;

      const oldState: BoardState = await getBoardState(openBoard);
      if (msg.type === "poll") {
        await new Promise((res) => (pollCb = res));
      } else if (msg.type === "settings") {
        const { target } = msg.payload;
        const newConf = await showConfigUI(target);
        if (newConf) {
          await setConfig(openBoard.configNoteId, newConf);
          await reloadConfig(openBoard.configNoteId);
        }
      } else if (msg.type === "deleteCol") {
        if (openBoard.isValid) {
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
          const wrappedConf = "```kanban\n" + yaml.dump(newConf) + "\n```";
          await setConfig(openBoard.configNoteId, wrappedConf);
          await reloadConfig(openBoard.configNoteId);
        }
      } else if (msg.type === "messageAction") {
        const { messageId, actionName } = msg.payload;
        if (messageId === "reload" && actionName === "reload") {
          await reloadConfig(openBoard.configNoteId);
        }
      } else if (msg.type === "addColumn") {
        const newConf = await showConfigUI("columnnew");
        if (newConf) {
          await setConfig(openBoard.configNoteId, newConf);
          await reloadConfig(openBoard.configNoteId);
        }
      } else if (msg.type === "openNote") {
        await joplin.commands.execute("openNote", msg.payload.noteId);
      } else if (msg.type === "newNote") {
        await joplin.commands.execute("newNote");
        newNoteChangedCb = async (noteId: string) => {
          if (!openBoard || !("actionToQuery" in openBoard)) return;
          msg.payload.noteId = noteId;
          for (const query of openBoard.actionToQuery(msg, oldState)) {
            log(`Executing update: \n${JSON.stringify(query, null, 4)}\n`);
            await executeUpdateQuery(query);
          }
        };
      } else if (msg.type !== "load" && "actionToQuery" in openBoard) {
        for (const query of openBoard.actionToQuery(msg, oldState)) {
          log(`Executing update: \n${JSON.stringify(query, null, 4)}\n`);
          await executeUpdateQuery(query);
        }
      }

      const newState: BoardState = await getBoardState(openBoard);
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
          openBoard.parsedConfig.display?.markdown == "list"
        )
          setAfterConfig(openBoard.configNoteId, getMdList(newState));
        else if (
          openBoard.isValid &&
          (openBoard.parsedConfig.display?.markdown == "table" ||
            openBoard.parsedConfig.display?.markdown == undefined)
        )
          setAfterConfig(openBoard.configNoteId, getMdTable(newState));
      }

      log(
        `Sending back update to webview: \n${JSON.stringify(
          newState,
          null,
          4
        )}\n`
      );
      return newState;
    });
  } else if (!(await joplin.views.panels.visible(view))) {
    await joplin.views.panels.show(view);
  }
}

function hideBoard() {
  if (view) joplin.views.panels.hide(view);
}

async function handleNewlyOpenedNote(newNoteId: string) {
  log(`Opened new note, id: ${newNoteId}`);
  if (openBoard) {
    if (openBoard.configNoteId === newNoteId) return;
    if (await isNoteIdOnBoard(newNoteId, openBoard)) return;
    else {
      log(`Opened note not on the board, closing`);
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
    log("\nKANBAN PLUGIN STARTED\n");

    // Have to call this on start otherwise layout from prevoius session is lost
    showBoard().then(hideBoard);

    let startedHandlingNewNote = false;
    joplin.workspace.onNoteSelectionChange(
      async ({ value }: { value: [string?] }) => {
        log(`Note selection changed`);
        const newNoteId = value?.[0] as string;
        if (newNoteChangedCb && (await getNoteById(newNoteId)))
          newNoteChangedCb = undefined;
        if (newNoteId) handleNewlyOpenedNote(newNoteId);
      }
    );

    joplin.workspace.onNoteChange(async ({ id }) => {
      log(`Note ${id} changed`);
      if (!openBoard) return;
      if (openBoard.configNoteId === id) {
        if (!openBoard.isValid) await reloadConfig(id);
        if (pollCb) pollCb();
      } else if ((await isNoteIdOnBoard(id, openBoard)) || newNoteChangedCb) {
        log("Changed note was on the board, updating");
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
