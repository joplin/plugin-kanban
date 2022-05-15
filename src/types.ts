import { Action } from "./actions";
import { LazyNoteData } from "./noteData";

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

export type SearchFilter = [string, string];

export interface SearchQuery {
  all: SearchFilter[];
  any: SearchFilter[];
}

export interface Rule {
  name: string;
  searchFilters?: SearchFilter[];
  filterNote: (note: LazyNoteData) => Promise<boolean>;
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
