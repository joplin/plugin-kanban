export interface MoveNoteAction {
  type: "moveNote";
  payload: {
    noteId: string;
    oldColumnName: string;
    newColumnName: string;
    newIndex: number;
  };
}

export interface LoadAction {
  type: "load";
}

export interface PollAction {
  type: "poll";
}

export interface SettingsAction {
  type: "settings";
  payload: {
    target: string;
  };
}

export interface MessageAction {
  type: "messageAction";
  payload: {
    messageId: string;
    actionName: string;
  };
}

export interface OpenNoteAction {
  type: "openNote";
  payload: {
    noteId: string;
  };
}

export interface AddColumnAction {
  type: "addColumn";
}

export interface DeleteColAction {
  type: "deleteCol";
  payload: {
    colName: string;
  };
}

export interface NewNoteAction {
  type: "newNote";
  payload: {
    colName: string;
    noteId?: string;
  };
}

export interface CloseAction {
  type: "close";
}

export type Action =
  | MoveNoteAction
  | LoadAction
  | PollAction
  | SettingsAction
  | MessageAction
  | OpenNoteAction
  | AddColumnAction
  | DeleteColAction
  | NewNoteAction
  | CloseAction;
