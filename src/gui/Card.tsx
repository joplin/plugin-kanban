import React from "react";
import styled from "styled-components";
import { Draggable } from "react-beautiful-dnd";

import type { NoteData } from "../noteData";

export default function ({ note, index, onOpenNote }: { note: NoteData; index: number; onOpenNote: (noteId: string) => void }) {
  return (
    <Draggable draggableId={note.id} index={index}>
      {(provided, snapshot) => (
        <Card
          ref={provided.innerRef}
          dragged={snapshot.isDragging}
          {...provided.dragHandleProps}
          {...provided.draggableProps}
          onClick={() => onOpenNote(note.id)}
        >
          {note.title}
        </Card>
      )}
    </Draggable>
  );
}

const Card = styled.div<{ dragged: boolean }>(({ dragged }) => ({
  boxSizing: "border-box",
  padding: "15px",
  marginTop: "20px",
  fontSize: "20px",
  borderRadius: "5px",
  border: "2px #DDDDDD solid",
  backgroundColor: "var(--joplin-background-color)",
  cursor: "pointer !important",
  overflow: "hidden",
  overflowWrap: "anywhere",

  boxShadow: dragged ? "8px 9px 47px 12px rgba(0, 0, 0, 0.41)" : "unset",
  transition: "box-shadow linear 0.2s",

  "&:first-child": {
    marginTop: "0",
  },
  "&:hover": {
    filter: "brightness(0.95)"
  }
}));
