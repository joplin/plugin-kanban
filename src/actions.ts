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
  payload: never;
}

export type Action = MoveNoteAction | LoadAction;
