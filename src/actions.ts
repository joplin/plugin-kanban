export interface MoveNoteAction {
  type: "moveNote";
  payload: {
    noteId: string;
    oldColumnName: string;
    newColumnName: string;
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
  }
}

export type Action = MoveNoteAction | LoadAction | PollAction | SettingsAction;
