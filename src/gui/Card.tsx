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
  height: "50px",
  padding: "10px",
  fontSize: "16px",
  borderRadius: "5px",
  border: "1px #DDDDDD solid",
  "& + &": {
    marginTop: "20px"
  }
})
