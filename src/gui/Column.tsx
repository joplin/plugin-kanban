import React, { useContext } from "react";
import styled from "styled-components";

import type { NoteData } from "../noteData";
import { DispatchContext } from "./index";
import ContextMenu from "./ContextMenu";
import DraggableCard from "./DraggableCard";
import { useDroppableArea } from "./DragDrop";

export default function ({ name, notes }: { name: string; notes: NoteData[] }) {
  const dispatch = useContext(DispatchContext);
  const { dropRef, handlerId, isOver } = useDroppableArea({ colName: name, notesLength: notes.length })

  // const sortedNotes = [...notes].sort((a, b) => (a.title < b.title ? -1 : 1));

  const handleMenu = (selected: string) => {
    if (selected === "Edit")
      dispatch({ type: "settings", payload: { target: `columns.${name}` } });
    else if (selected === "Delete") dispatch({ type: "deleteCol", payload: { colName: name } })
  };
  return (
    <Column>
      <ContextMenu options={["Edit", "Delete"]} onSelect={handleMenu}>
        <ColumnHeader>{name}</ColumnHeader>
      </ContextMenu>

      <DroppableArea
        draggingOver={isOver}
        ref={dropRef}
        data-handler-id={handlerId}
      >
        {notes.map((note, idx) => (
          <DraggableCard key={note.id} colName={name} note={note} index={idx} />
        ))}
      </DroppableArea>
    </Column>
  );
}

const Column = styled("div")({
  display: "flex",
  flexDirection: "column",
  alignItems: "stretch",
  width: "300px",
  minWidth: "200px",
  padding: "0 15px",
  "& + &": {
    borderLeft: "1px #DDDDDD solid",
  },
});

const ColumnHeader = styled("div")({
  fontSize: "18px",
  fontWeight: "bold",
  marginBottom: "20px",
  userSelect: "none",
});

const DroppableArea = styled("div")<{ draggingOver: boolean }>(
  ({ draggingOver }) => ({
    minHeight: "200px",
    height: "100%",
    borderRadius: "5px",
    overflowY: "auto",
    // border: draggingOver ? "royalblue solid 1px" : "unset"
    boxShadow: draggingOver
      ? "0px 0px 6px 3px rgba(4, 164, 255, 0.41) inset"
      : "unset",
    transition: "box-shadow linear 0.2s",
  })
);
