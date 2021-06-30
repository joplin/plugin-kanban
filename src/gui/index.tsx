import React, { useState } from 'react'
import { render } from 'react-dom'
import styled from 'styled-components'
import { DragDropContext, OnDragEndResponder, OnDragStartResponder } from 'react-beautiful-dnd'

import type { NoteData } from '../noteData'
import useBoard from './useBoard'
import Column from './Column'

function App() {
  const [board, waitingForUpdate, dispatch] = useBoard();
  const [currentDragSource, setDragSource] = useState<string | null>(null);
  const [appendedNote, setAppendedNote] = useState<{ col: string; note: NoteData } | null>(null)

  const onDragStart: OnDragStartResponder = (start) => {
    setDragSource(start.source.droppableId)
  }
  const onDragEnd: OnDragEndResponder = (drop) => {
    if (!drop.destination || !board) return

    dispatch({ type: "moveNote", payload: { noteId: drop.draggableId, oldColumnName: drop.source.droppableId, newColumnName: drop.destination.droppableId } })
    setAppendedNote({
      col: drop.destination.droppableId,
      note: (board.columns.find(({ name }) => name === drop.source.droppableId)?.notes as NoteData[]).find(({ id }) => id === drop.draggableId) as NoteData
    })
  }

  return board ?
    <Container>
      <Header>{board.name}</Header>
      <ColumnsCont>
        <DragDropContext
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        >
          {board.columns.map(({ name, notes }) => {
            let notesToRender = notes;
            if (waitingForUpdate) {
              if (appendedNote?.col === name) notesToRender = [...notes, appendedNote.note]
              else {
                const noteIdx = notes.indexOf(appendedNote?.note as NoteData)
                if (noteIdx !== -1) notesToRender = [...notes.slice(0, noteIdx), ...notes.slice(noteIdx + 1)]
              }
            }

            return <Column
              key={name}
              name={name}
              notes={notesToRender}
              draggedFromHere={name === currentDragSource}
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
  width: "100%",
  height: "100%"
})

const Header = styled("div")({
  height: "50px",
  fontSize: "28px",
  paddingLeft: "10px"
})

const ColumnsCont = styled("div")({
  display: "flex",
  alignItems: "stretch",
  flexGrow: 1
})

