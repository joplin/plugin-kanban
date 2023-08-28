import { Action } from "./actions";

// UI Types

/**
 * Message data displayed above the board in an alertbox.
 */
export interface Message {
  id: string;
  title: string;
  severity: "info" | "warning" | "error";
  details?: string;
  actions: string[];
}

// Config Types

/**
 * Union of all types a rule can accept in the config.
 */
export type RuleValue = string | string[] | boolean | undefined;

export interface Config {
  filters: {
    [ruleName: string]: RuleValue;
    rootNotebookPath?: string;
  };
  sort: {
    by?: string;
  };
  columns: {
    [ruleName: string]: RuleValue;
    name: string;
    backlog?: boolean;
  }[];
  display: {
    markdown: string;
  };
}

// Board types

export interface BoardBase {
  isValid: boolean;
  configNoteId: string;
  boardName: string;
  configYaml: string;
}

export interface ValidBoard extends BoardBase {
  isValid: true;
  parsedConfig: Config;
  columnNames: string[];
  rootNotebookName: string;
  hiddenTags: string[];
  sortNoteIntoColumn(note: NoteData): string | null;
  actionToQuery(action: Action, boardState: BoardState): UpdateQuery[];
  getBoardState(): Promise<BoardState>;
  isNoteIdOnBoard(id: string, board: Board | undefined): Promise<boolean>;
}

export interface InvalidBoard extends BoardBase {
  isValid: false;
  errorMessages: Message[];
}

export type Board = ValidBoard | InvalidBoard;

export interface Rule {
  name: string;
  filterNote: (note: NoteData) => boolean;
  set(noteId: string): UpdateQuery[];
  unset(noteId: string): UpdateQuery[];
  editorType: string;
}

export interface BoardState {
  name: string;
  columns?: {
    name: string;
    notes: NoteData[];
  }[];
  hiddenTags: string[];
  messages: Message[];
}

// Joplin API related types

export interface UpdateQuery {
  type: "post" | "delete" | "put";
  path: string[];
  body?: object;
}

export interface ConfigNote {
  id: string;
  title: string;
  parent_id: string;
  body: string;
}

export interface NoteData {
  id: string;
  title: string;
  tags: string[];
  notebookId: string;
  isTodo: boolean;
  isCompleted: boolean;
  due: number;
  order: number;
  createdTime: number;
}
