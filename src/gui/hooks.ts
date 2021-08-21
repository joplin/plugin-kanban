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
  messages: Message[];
}

interface State {
  board?: BoardState;
}

export type DispatchFn = (action: Action) => Promise<void>

export function useRemoteBoard(): [
  BoardState | undefined,
  DispatchFn
] {
  const [state, setState] = useState<State>({});

  const dispatch: DispatchFn = useCallback(async (action: Action) => {
    const newBoard: BoardState = await webviewApi.postMessage(action)
    setState({ board: newBoard });
  }, []);

  const shouldPoll = useRef(true);
  const poll = () => {
    webviewApi.postMessage({ type: "poll" }).then((newBoard: BoardState) => {
      if (!newBoard) {
        shouldPoll.current = false
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

export function useTempBoard(
  board: BoardState | undefined,
  waitingForUpdate: boolean
): [
  BoardState | undefined,
  (noteId: string, oldCol: string, newCol: string) => void
] {
  const tempState = useRef<{
    movedNote?: NoteData;
    oldCol?: string;
    newCol?: string;
  }>({});

  useEffect(() => {
    if (!waitingForUpdate) tempState.current = {}
  }, [waitingForUpdate])

  const moveNote = (noteId: string, oldCol: string, newCol: string) => {
    if (!board || !board.columns || oldCol === newCol) return;

    const note = (
      board.columns.find(({ name }) => name === oldCol)?.notes as NoteData[]
    ).find(({ id }) => id === noteId) as NoteData;
    tempState.current = {
      movedNote: note,
      oldCol,
      newCol,
    };
  };

  if (board && board.columns && tempState.current.movedNote) {
    const tempBoardCols = board.columns.map(({ name, notes }) => {
      let newNotes = notes;
      if (tempState.current.newCol === name)
        newNotes = [...notes, tempState.current.movedNote as NoteData];
      if (tempState.current.oldCol === name) {
        const noteIdx = notes.indexOf(tempState.current.movedNote as NoteData);
        newNotes = [...notes.slice(0, noteIdx), ...notes.slice(noteIdx + 1)];
      }

      return { name, notes: newNotes };
    });

    const tempBoard = {
      name: board.name,
      columns: tempBoardCols,
      messages: board.messages
    };

    return [tempBoard, moveNote];
  }

  return [board, moveNote];
}
