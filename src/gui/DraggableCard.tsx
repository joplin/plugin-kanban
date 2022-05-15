import React, { useRef } from "react";

import ClickableCard from "./ClickableCard";
import { useDraggableCard, useDroppableCard } from "./DragDrop";
import type { NoteData } from "../types";

interface DraggableCardProps {
  note: NoteData;
  colName: string;
  index: number;
}

export default function ({ note, colName, index }: DraggableCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const { handlerId, withPlaceholder } = useDroppableCard({
    ref,
    contentRef: cardRef,
    colName,
    noteId: note.id,
    index,
  });

  const { display } = useDraggableCard({ colName, index, note, ref });

  return (
    <div
      ref={ref}
      style={{ display, overflow: "auto" }}
      data-handler-id={handlerId}
    >
      {withPlaceholder(<ClickableCard ref={cardRef} note={note} />)}
    </div>
  );
}
