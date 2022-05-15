import React, { useContext } from "react";
import styled from "styled-components";
import { IoMdAdd } from "react-icons/io";

import type { NoteData } from "../types";
import { DispatchContext } from "./index";
import ContextMenu from "./ContextMenu";
import DraggableCard from "./DraggableCard";
import { useDroppableArea } from "./DragDrop";

export default function ({ name, notes }: { name: string; notes: NoteData[] }) {
  const dispatch = useContext(DispatchContext);
  const { dropRef, handlerId, isOver } = useDroppableArea({
    colName: name,
    notesLength: notes.length,
  });

  const handleMenu = (selected: string) => {
    if (selected === "Edit")
      dispatch({ type: "settings", payload: { target: `columns.${name}` } });
    else if (selected === "Delete")
      dispatch({ type: "deleteCol", payload: { colName: name } });
  };

  const handleNewNote = () =>
    dispatch({
      type: "newNote",
      payload: {
        colName: name,
      },
    });

  return (
    <Column>
      <ContextMenu options={["Edit", "Delete"]} onSelect={handleMenu}>
        <ColumnHeader>
          {name}{" "}
          <AddIconCont onClick={handleNewNote}>
            <IoMdAdd size="25px" />
          </AddIconCont>{" "}
        </ColumnHeader>
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
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  fontSize: "1.1rem",
  fontWeight: "bold",
  marginBottom: "20px",
  userSelect: "none",
});

const AddIconCont = styled("span")({
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  marginLeft: "auto",
  borderRadius: "5px",

  "&:hover": {
    backgroundColor: "var(--joplin-background-color-hover3)",
  },
  "& > svg": {
    width: "1.5em",
    height: "1.5em",
    color: "var(--joplin-color3)",
  },
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
