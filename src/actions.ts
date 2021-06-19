export interface MoveNoteAction {
  type: "moveNote";
  payload: {
    noteId: string;
    newColumnName: string;
  };
}

export type Action = MoveNoteAction;
