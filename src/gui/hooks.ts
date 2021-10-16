import { useEffect, useState, useRef, useCallback } from "react";

import type { NoteData } from "../noteData";
import type { Action } from "../actions";
import type { Message } from "../board";

export interface BoardState {
  name: string;
  columns?: {
    name: string;
    notes: NoteData[];
  }[];
  hiddenTags: string[];
  messages: Message[];
}

interface State {
  board?: BoardState;
}

export type DispatchFn = (action: Action) => Promise<void>;

export function useRemoteBoard(): [BoardState | undefined, DispatchFn] {
  const [state, setState] = useState<State>({});

  const dispatch: DispatchFn = useCallback(async (action: Action) => {
    const newBoard: BoardState = await webviewApi.postMessage(action);
    setState({ board: newBoard });
  }, []);

  const shouldPoll = useRef(true);
  const poll = () => {
    webviewApi.postMessage({ type: "poll" }).then((newBoard: BoardState) => {
      if (!newBoard) {
        shouldPoll.current = false;
      } else {
        setState({ board: newBoard });
        if (shouldPoll.current === true) poll();
      }
    });
  };

  useEffect(() => {
    dispatch({ type: "load" });
    poll();
    return () => {
      shouldPoll.current = false;
    };
  }, []);

  return [state.board, dispatch];
}
