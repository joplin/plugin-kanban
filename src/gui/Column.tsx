import React from "react";
import styled from "styled-components";
import { Droppable } from "react-beautiful-dnd";

import type { NoteData } from "../noteData";
import Card from "./Card";

export default function ({ name, notes }: { name: string; notes: NoteData[] }) {
  const sortedNotes = [...notes].sort((a, b) => (a.title < b.title ? -1 : 1));
  return (
    <Column>
      <ColumnHeader>{name}</ColumnHeader>

      <Droppable droppableId={name}>
        {(provided, snapshot) => (
          <DroppableArea
            draggingOver={snapshot.isDraggingOver}
            ref={provided.innerRef}
            {...provided.droppableProps}
          >
            {sortedNotes.map((note, idx) => (
              <Card key={note.id} note={note} index={idx} />
            ))}
            {provided.placeholder}
          </DroppableArea>
        )}
      </Droppable>
    </Column>
  );
}

const Column = styled("div")({
  display: "flex",
  flexDirection: "column",
  alignItems: "stretch",
  width: "300px",
  minWidth: "200px",
  padding: "0 20px",
  "& + &": {
    borderLeft: "1px #DDDDDD solid",
  },
});

const ColumnHeader = styled("div")({
  fontSize: "18px",
  fontWeight: "bold",
  marginBottom: "20px",
});

const DroppableArea = styled("div")<{ draggingOver: boolean }>(
  ({ draggingOver }) => ({
    minHeight: "200px",
    padding: "5px",
    borderRadius: "5px",
    // border: draggingOver ? "royalblue solid 1px" : "unset"
    boxShadow: draggingOver
      ? "0px 0px 6px 3px rgba(4, 164, 255, 0.41) inset"
      : "unset",
    transition: "box-shadow linear 0.2s",
  })
);
