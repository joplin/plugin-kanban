import React from 'react'
import { render } from 'react-dom'
import styled from 'styled-components'
import { DragDropContext, OnDragEndResponder } from 'react-beautiful-dnd'

import { useRemoteBoard, useTempBoard } from './hooks'
import Column from './Column'

function App() {
  const [board, waitingForUpdate, dispatch] = useRemoteBoard();
  const [tempBoard, tempMoveNote] = useTempBoard(board);

  const onDragEnd: OnDragEndResponder = (drop) => {
    if (!drop.destination || !board) return

    const noteId = drop.draggableId;
    const oldColumnName = drop.source.droppableId;
    const newColumnName = drop.destination.droppableId;
    dispatch({ type: "moveNote", payload: { noteId, oldColumnName, newColumnName } })
    tempMoveNote(noteId, oldColumnName, newColumnName)
  }

  return board ?
    <Container>
      <Header>{board.name}</Header>
      <ColumnsCont>
        <DragDropContext
          onDragEnd={onDragEnd}
        >
          {board.columns.map(({ name, notes }) => {
            const tempCol = tempBoard?.columns.find(({ name: n }) => n === name)

            return <Column
              key={name}
              name={name}
              notes={waitingForUpdate && tempCol ? tempCol.notes : notes}
            />
          }
          )}
        </DragDropContext>
      </ColumnsCont>
    </Container>
    : <div></div>
}

render(<App />, document.getElementById('root'))

const Container = styled("div")({
  display: "flex",
  flexDirection: "column",
  alignItems: "stretch",
  minWidth: "100%",
  height: "100%"
})

const Header = styled("div")({
  height: "50px",
  fontSize: "28px",
  padding: "10px",
  paddingLeft: "20px",
  marginBottom: "10px"
})

const ColumnsCont = styled("div")({
  display: "flex",
  alignItems: "stretch",
  flexGrow: 1,
  overflowY: "auto"
})

