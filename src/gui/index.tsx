import React from "react";
import { render } from "react-dom";
import styled from "styled-components";
import { DragDropContext, OnDragEndResponder } from "react-beautiful-dnd";
import { IoMdSettings } from "react-icons/io"

import { useRemoteBoard, useTempBoard } from "./hooks";
import Column from "./Column";

function App() {
  const [board, waitingForUpdate, dispatch] = useRemoteBoard();
  const [tempBoard, tempMoveNote] = useTempBoard(board);

  const onDragEnd: OnDragEndResponder = (drop) => {
    if (!drop.destination || !board) return;

    const noteId = drop.draggableId;
    const oldColumnName = drop.source.droppableId;
    const newColumnName = drop.destination.droppableId;
    dispatch({
      type: "moveNote",
      payload: { noteId, oldColumnName, newColumnName },
    });
    tempMoveNote(noteId, oldColumnName, newColumnName);
  };

  return board ? (
    <Container>
      <Header>
        {board.name}
        <IconCont onClick={() => dispatch({ type: "settings", payload: { target: "filters" } })}>
          <IoMdSettings size="25px"/>
        </IconCont>
      </Header>

      <ColumnsCont>
        <DragDropContext onDragEnd={onDragEnd}>
          {board.columns.map(({ name, notes }) => {
            const tempCol = tempBoard?.columns.find(
              ({ name: n }) => n === name
            );

            return (
              <Column
                key={name}
                name={name}
                notes={waitingForUpdate && tempCol ? tempCol.notes : notes}
                onOpenConfig={() => dispatch({ type: "settings", payload: { target: `columns.${name}` } })}
              />
            );
          })}
        </DragDropContext>
      </ColumnsCont>
    </Container>
  ) : (
    <div></div>
  );
}

render(<App />, document.getElementById("root"));

const Container = styled("div")({
  display: "flex",
  flexDirection: "column",
  alignItems: "stretch",
  minWidth: "100%",
  height: "100%",
});

const Header = styled("div")({
  height: "50px",
  fontSize: "28px",
  padding: "10px",
  paddingLeft: "20px",
  marginBottom: "10px",
  display: "flex",
  flexDirection: "row",
  alignItems: "center"
});

const ColumnsCont = styled("div")({
  display: "flex",
  alignItems: "stretch",
  flexGrow: 1,
  overflowY: "auto",
});

const IconCont = styled("div")({
  width: "33px",
  height: "33px",
  border: "1px solid black",
  borderRadius: "5px",
  marginLeft: "20px",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  cursor: "pointer"
})
