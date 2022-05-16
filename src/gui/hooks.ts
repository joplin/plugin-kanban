import { useEffect, useState, useRef, useCallback } from "react";

import type { NoteData, Message, BoardState } from "../types";
import type { Action } from "../actions";

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
