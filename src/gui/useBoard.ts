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

export default function () {
  const [board, setBoard] = useState<BoardState | null>();

  useEffect(() => {
    webviewApi.postMessage({ type: "load" }).then(setBoard);
  }, []);

  const dispatch = (action: Action) =>
    webviewApi.postMessage(action).then(setBoard);

  return [board, dispatch];
}
