import { useEffect, useState } from "react";

import type { NoteData } from "../noteData";
import type { Action } from "../actions";

export interface BoardState {
  name: string;
  columns: {
    name: string;
    notes: NoteData[];
  }[];
}

interface State {
  board?: BoardState;
  waitingForUpdate: boolean;
}

export default function(): [BoardState | undefined, boolean, (action: Action) => void] {
  const [state, setState] = useState<State>({ waitingForUpdate: false });

  const dispatch = (action: Action) => {
    setState({ ...state, waitingForUpdate: true })
    webviewApi.postMessage(action).then((newBoard: BoardState) => {
      setState({ board: newBoard, waitingForUpdate: false })
    });
  }

  useEffect(() => {
    dispatch({ type: "load" })
  }, []);

  return [state.board, state.waitingForUpdate, dispatch];
}
