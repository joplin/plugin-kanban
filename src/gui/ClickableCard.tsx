import React, { useContext } from "react";

import { DispatchContext } from "./index";
import Card from "./Card";
import type { NoteData } from "../types";

export default React.forwardRef<HTMLDivElement, { note: NoteData }>(
  ({ note }, ref) => {
    const dispatch = useContext(DispatchContext);
    const handleClick = () => {
      dispatch({
        type: "openNote",
        payload: { noteId: note.id },
      });
    };

    return (
      <div ref={ref} onClick={handleClick}>
        <Card note={note} />
      </div>
    );
  }
);
