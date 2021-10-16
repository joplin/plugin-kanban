import React from "react";
import { render } from "react-dom";
import styled from "styled-components";
import { IoMdSettings, IoMdAdd } from "react-icons/io";

import { capitalize } from "../utils";
import { DispatchFn, useRemoteBoard } from "./hooks";
import { DragDropContext } from "./DragDrop";
import Column from "./Column";
import type { Message } from "../board";

export const DispatchContext = React.createContext<DispatchFn>(async () => {});
export const IsWaitingContext = React.createContext<boolean>(false);

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
  const [board, dispatch] = useRemoteBoard();
  const notesToShow = board?.columns?.map((col) => ({
    ...col,
    notes: col.notes.map((note) => ({
      ...note,
      tags: note.tags.filter((tag) => !board.hiddenTags.includes(tag)),
    })),
  }));

  const cont = board ? (
    <Container>
      <Header>
        {board.name}
        <IconCont
          onClick={() =>
            dispatch({ type: "settings", payload: { target: "filters" } })
          }
        >
          <IoMdSettings size="25px" />
        </IconCont>

        <IconCont
          onClick={() =>
            dispatch({ type: "settings", payload: { target: "columnnew" } })
          }
        >
          <IoMdAdd size="25px" />
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

      {board.columns && (
        <ColumnsCont>
          {notesToShow?.map(({ name, notes }) => (
            <Column key={name} name={name} notes={notes} />
          ))}
        </ColumnsCont>
      )}
    </Container>
  ) : (
    <div></div>
  );

  return (
    <DispatchContext.Provider value={dispatch}>
      <DragDropContext>{cont}</DragDropContext>
    </DispatchContext.Provider>
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
  fontSize: "1.2rem",
  fontWeight: "bold",
  padding: "0.3em",
  marginBottom: "0.5em",
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
});

const ColumnsCont = styled("div")({
  display: "flex",
  alignItems: "stretch",
  flexGrow: 1,
  overflowY: "auto",
  marginBottom: "20px",
});

const IconCont = styled("div")({
  margin: "auto 0.1em",
  padding: "0.1em",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  borderRadius: "5px",

  "&:first-child": {
    marginLeft: "auto",
  },
  "&:hover": {
    backgroundColor: "var(--joplin-background-color-hover3)",
  },
  "& > svg": {
    width: "1.3em",
    height: "1.3em",
    color: "var(--joplin-color3)",
  },
});

const MessagesCont = styled("div")({
  padding: "0 15px",
});

const messageColors: { [k in Message["severity"]]: [string, string, string] } =
  {
    info: ["#cfe2ff", "#b6d4fe", "#084298"],
    warning: ["#fff3cd", "#ffecb5", "#664d03"],
    error: ["#f8d7da", "#f5c2c7", "#842029"],
  };

const MessageBoxContainer = styled("div")<{ severity: Message["severity"] }>(
  ({ severity }) => ({
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    padding: "0.8em",
    // fontSize: "1.1rem",
    borderRadius: "7px",
    border: `1px solid ${messageColors[severity][1]}`,
    color: messageColors[severity][2],
    backgroundColor: messageColors[severity][0],
    marginBottom: "0.7em",
    "&:last-child": {
      marginBottom: "1em",
    },
  })
);

const MessageTitle = styled("div")({
  flexGrow: 1,
});

const MessageDetailsWrapper = styled("details")({
  width: "100%",
});

const MessageSummary = styled("summary")({
  display: "flex",
  alignItems: "center",
});

const MessageDetail = styled("code")({
  display: "block",
  paddingTop: "15px",
  whiteSpace: "pre-wrap",
});
