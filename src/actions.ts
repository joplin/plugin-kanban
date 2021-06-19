export interface MoveNoteAction {
  type: "moveNote";
  payload: {
    noteId: string;
    oldColumnName: string;
    newColumnName: string;
  };
}

export type Action = MoveNoteAction;
