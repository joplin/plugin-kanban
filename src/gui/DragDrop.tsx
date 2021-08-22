import React, { useState, useContext, useEffect, useMemo } from "react";
import { useDrag, useDrop, DndProvider, DropTargetMonitor } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import type { XYCoord } from "dnd-core";

import Card from "./Card";
import { DispatchContext } from "./index";
import type { NoteData } from "../noteData";

export interface DragItem {
  index: number;
  oldColName: string;
  noteData: NoteData;
}

enum PhPos {
  ABOVE,
  BELOW,
}

interface PlaceholderData {
  pos: PhPos;
  noteData: NoteData;
}

type DragWaitingContextValue = [boolean, (v: boolean) => void];
const IsDragWaitingContext = React.createContext<DragWaitingContextValue>([
  false,
  (_: boolean) => {},
]);

export function DragDropContext({ children }: React.PropsWithChildren<{}>) {
  const [isDragWaiting, setDragWaiting] = useState(false);
  const contextVal = useMemo<DragWaitingContextValue>(
    () => [isDragWaiting, setDragWaiting],
    [isDragWaiting]
  );
  return (
    <DndProvider backend={HTML5Backend}>
      <IsDragWaitingContext.Provider value={contextVal}>
        {children}
      </IsDragWaitingContext.Provider>
    </DndProvider>
  );
}

export function useDroppableArea({ colName, notesLength }: { colName: string; notesLength: number }) {
  const dispatch = useContext(DispatchContext);
  const [, setDragWaiting] = useContext(IsDragWaitingContext);

  const [{ handlerId, isOver }, dropRef] = useDrop({
    accept: "card",
    collect: (monitor) => ({
      handlerId: monitor.getHandlerId(),
      isOver: monitor.isOver(),
    }),
    drop(item: DragItem, monitor: DropTargetMonitor) {
      if (monitor.didDrop()) return
      setDragWaiting(true);
      dispatch({
        type: "moveNote",
        payload: {
          noteId: item.noteData.id,
          oldColumnName: item.oldColName,
          newColumnName: colName,
          newIndex: notesLength,
        },
      }).then(() => setDragWaiting(false));
    },
  });

  return { handlerId, isOver, dropRef };
}

export function useDroppableCard({
  noteId,
  colName,
  contentRef,
  ref,
  index,
}: {
  noteId: string;
  colName: string;
  ref: React.RefObject<HTMLDivElement>;
  contentRef: React.RefObject<HTMLDivElement>;
  index: number;
}) {
  const dispatch = useContext(DispatchContext);
  const [placeholder, setPlaceholder] = useState<PlaceholderData | null>(null);
  const [isDragWaiting, setDragWaiting] = useContext(IsDragWaitingContext);

  const [{ handlerId, isOver }, drop] = useDrop({
    accept: "card",
    collect(monitor) {
      return {
        handlerId: monitor.getHandlerId(),
        isOver: monitor.isOver(),
      };
    },
    hover(item: DragItem, monitor: DropTargetMonitor) {
      if (!ref.current || !contentRef.current || item.noteData.id === noteId) {
        return;
      }

      const hoverBoundingRect = contentRef.current?.getBoundingClientRect();
      const hoverMiddleY =
        (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
      const clientOffset = monitor.getClientOffset() as XYCoord;
      const hoverClientY = clientOffset.y - hoverBoundingRect.top;
      const pos = hoverClientY < hoverMiddleY ? PhPos.ABOVE : PhPos.BELOW;

      setPlaceholder({
        noteData: item.noteData,
        pos,
      });
    },

    drop(item: DragItem) {
      const pos = (placeholder as PlaceholderData).pos
      const newIndex = pos === PhPos.ABOVE ? index : index + 1
      setDragWaiting(true);
      dispatch({
        type: "moveNote",
        payload: {
          noteId: item.noteData.id,
          oldColumnName: item.oldColName,
          newColumnName: colName,
          newIndex
        },
      }).then(() => setDragWaiting(false));
    },
  });
  drop(ref);

  useEffect(() => {
    if (!isDragWaiting && !isOver) setPlaceholder(null);
  }, [isDragWaiting, isOver]);

  const placeholderBelow = placeholder && placeholder.pos === PhPos.BELOW;
  const placeholderAbove = placeholder && placeholder.pos === PhPos.ABOVE;
  const placeholderCard = placeholder && (
    <div style={{ opacity: 0 }}>
      <Card note={placeholder.noteData} />
    </div>
  );

  const withPlaceholder = (card: React.ReactNode) => (
    <>
      {placeholderAbove && placeholderCard}
      {card}
      {placeholderBelow && placeholderCard}
    </>
  );

  return { handlerId, withPlaceholder };
}

export function useDraggableCard({
  index,
  colName,
  note,
  ref,
}: {
  index: number;
  colName: string;
  note: NoteData;
  ref: React.RefObject<HTMLDivElement>;
}) {
  const [hidden, setHidden] = useState(false);
  const [isDragWaiting] = useContext(IsDragWaitingContext);

  const [{ isDragging }, drag] = useDrag(
    {
      type: "card",
      item: () => ({
        index,
        oldColName: colName,
        noteData: note,
      }),
      collect: (monitor: any) => ({
        isDragging: monitor.isDragging(),
      }),
      end(_, monitor) {
        if (!monitor.didDrop()) setHidden(false);
      },
    },
    [note, colName]
  );
  drag(ref);

  useEffect(() => {
    if (isDragging && !hidden) setHidden(true);
  }, [isDragging]);

  useEffect(() => {
    if (!isDragWaiting && hidden) setHidden(false);
  }, [isDragWaiting]);

  const display = hidden ? "none" : "block";
  return { display };
}
