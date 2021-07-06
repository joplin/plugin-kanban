import React from 'react'
import styled from 'styled-components'
import { Draggable } from 'react-beautiful-dnd'

import type { NoteData } from '../noteData'

export default function({ note, index }: { note: NoteData, index: number; }) {
  return (
    <Draggable draggableId={note.id} index={index}>
      {(provided) =>
        <Card
          ref={provided.innerRef}
          {...provided.dragHandleProps}
          {...provided.draggableProps}
        >
          {note.title}
        </Card>

      }
    </Draggable>
  )
}

const Card = styled.div({
  maxHeight: "50px",
  padding: "15px",
  fontSize: "20px",
  borderRadius: "5px",
  border: "2px #DDDDDD solid",
  "& + &": {
    marginTop: "20px"
  }
})
