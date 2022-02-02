import React from "react";
import styled from "styled-components";
import { IoMdPricetag } from "react-icons/io";
import { IoCalendarOutline } from "react-icons/io5";

import type { NoteData } from "../noteData";

export default React.forwardRef<HTMLDivElement, { note: NoteData }>(
  ({ note }, ref) => {
    const { title, tags, due } = note;

    const renderExtra = (
      key: number,
      icon: React.ReactNode,
      text: string,
      color: string = "#666666"
    ) => (
      <ExtraItem key={key} color={color}>
        <IconCont>{icon}</IconCont>
        {text}
      </ExtraItem>
    );
    const extras: [React.ReactNode, string, string?][] = tags.map((tag) => [
      <IoMdPricetag size="1rem" />,
      tag,
    ]);
    if (due > 0) {
      const dueDate = new Date(due);
      const dateStr = dueDate.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' });
      const daysLeft = (due - Date.now()) / (1000 * 60 * 60 * 24);
      const color = daysLeft < 3 ? "red" : undefined;
      extras.push([<IoCalendarOutline size="1rem" />, dateStr, color]);
    }

    return (
      <CardDiv ref={ref}>
        {title}
        <ExtrasContainer>
          {extras.map((e, idx) => renderExtra(idx, ...e))}
        </ExtrasContainer>
      </CardDiv>
    );
  }
);

const CardDiv = styled.div({
  boxSizing: "border-box",
  padding: "0.8em",
  paddingBottom: "0.5em",
  marginBottom: "0.8em",
  borderRadius: "5px",
  border: "2px #DDDDDD solid",
  backgroundColor: "var(--joplin-background-color)",
  cursor: "grab !important",
  overflow: "hidden",
  overflowWrap: "anywhere",

  transition: "box-shadow linear 0.2s",

  "&:hover": {
    filter: "brightness(0.95)",
  },
});

const ExtrasContainer = styled.div({
  display: "flex",
  marginTop: "7px",
  flexDirection: "row",
  flexWrap: "wrap",
});

const ExtraItem = styled.div<{ color: string }>(({ color }) => ({
  fontSize: "0.8rem",
  color,
  display: "flex",
  alignItems: "center",
  marginRight: "10px",
}));

const IconCont = styled.span({
  marginRight: "4px",
});
