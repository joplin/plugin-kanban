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

export interface newTodoAction {
  type: "newTodo";
  payload: {
    colName: string;
    noteId?: string;
  };
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
  | newTodoAction;
