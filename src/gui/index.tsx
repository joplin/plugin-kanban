import React from "react";
import { render } from "react-dom";
import styled from "styled-components";
import { DragDropContext, OnDragEndResponder } from "react-beautiful-dnd";
import { IoMdSettings } from "react-icons/io"

import type { Message } from "../board";
import { capitalize } from "../utils"
import { useRemoteBoard, useTempBoard } from "./hooks";
import Column from "./Column";

function MessageBox({
  message,
  onMsgAction,
}: {
  message: Message;
  onMsgAction: (action: string) => void;
}) {
  const { title, actions, severity, details } = message;
  const btns = actions.map((action) => (
    <button key={action} onClick={() => onMsgAction(action)}>
      {capitalize(action)}
    </button>
  ));
  const summary = (
    <>
      <MessageTitle>{title}</MessageTitle>
      {btns}
    </>
  );

  return (
    <MessageBoxContainer severity={severity}>
      {details ? (
        <MessageDetailsWrapper>
          <MessageSummary>{summary}</MessageSummary>
          <MessageDetail>{details}</MessageDetail>
        </MessageDetailsWrapper>
      ) : (
        summary
      )}
    </MessageBoxContainer>
  );
}

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

      <MessagesCont>
        {board.messages.map((msg, idx) => (
          <MessageBox
            key={idx}
            message={msg}
            onMsgAction={(action) =>
              dispatch({
                type: "messageAction",
                payload: { actionName: action, messageId: msg.id },
              })
            }
          />
        ))}
      </MessagesCont>

      {board.columns && 
        <ColumnsCont>
          <DragDropContext onDragEnd={onDragEnd}>
            {board.columns.map(({ name, notes }) => {
              const tempCol = tempBoard?.columns?.find(
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
      }
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

const MessagesCont = styled("div")({
  padding: "0 15px",
  marginBottom: "30px",
})

const messageColors: { [k in Message["severity"]]: [string, string, string] } = {
  info: ["#cfe2ff", "#b6d4fe", "#084298"],
  warning: ["#fff3cd", "#ffecb5", "#664d03"],
  error: ["#f8d7da", "#f5c2c7", "#842029"],
};

const MessageBoxContainer = styled("div")<{ severity: Message["severity"] }>(
  ({ severity }) => ({
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    padding: "15px",
    borderRadius: "7px",
    border: `1px solid ${messageColors[severity][1]}`,
    color: messageColors[severity][2],
    backgroundColor: messageColors[severity][0],
    fontSize: "1.1em",
    "& + &": {
      marginBottom: "10px",
    },
  })
);

const MessageTitle = styled("div")({
  flexGrow: 1
})

const MessageDetailsWrapper = styled("details")({
  width: "100%"
})

const MessageSummary = styled("summary")({
  display: "flex",
  alignItems: "center"
})

const MessageDetail = styled("code")({
  display: "block",
  paddingTop: "15px",
  whiteSpace: "pre-wrap",
})
