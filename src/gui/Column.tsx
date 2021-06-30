import React from 'react'
import styled from 'styled-components'
import { Droppable } from 'react-beautiful-dnd'

import type { NoteData } from '../noteData'
import Card from './Card'

export default function({ name, notes, draggedFromHere }: { name: string; notes: NoteData[]; draggedFromHere: boolean; }) {
  const sortedNotes = [...notes].sort((a, b) => a.title < b.title ? -1 : 1)
  return (
    <Column>
      <ColumnHeader>{name}</ColumnHeader>

      <Droppable droppableId={name} isDropDisabled={draggedFromHere}>
        {(provided) => (
          <div ref={provided.innerRef} {...provided.droppableProps}>
            {sortedNotes.map((note, idx) => <Card key={note.id} note={note} index={idx}/>)}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </Column>
  )
}

const Column = styled("div")({
  display: "flex",
  flexDirection: "column",
  alignItems: "stretch",
  width: "200px",
  padding: "0 20px",
  "& + &": {
    borderLeft: "1px #DDDDDD solid"
  }
})

const ColumnHeader = styled("div")({
  fontSize: "18px",
  fontWeight: "bold",
  marginBottom: "20px"
})

