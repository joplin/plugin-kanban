import React, { useState, useEffect, useCallback, useRef } from "react";
import styled from "styled-components";

const CLOSE_EVENTS = ["click", "contextmenu", "wheel", "blur"]
export default function ({
  options,
  onSelect,
  children,
}: {
  options: string[];
  onSelect: (selected: string) => void;
  children: React.ReactElement;
}) {
  const [{ posX, posY }, setPos] = useState<{
    posX: number | null;
    posY: number | null;
  }>({ posX: null, posY: null });
  const isOpen = posX !== null && posY !== null

  useEffect(() => {
    if (isOpen) {
      const close = () => setPos({ posX: null, posY: null })
      CLOSE_EVENTS.forEach(ev => window.addEventListener(ev, close))
      return () => CLOSE_EVENTS.forEach(ev => window.removeEventListener(ev, close))
    }
  }, [isOpen]);

  const handleMenu = (ev: React.MouseEvent) => {
    ev.preventDefault();
    setPos({ posX: ev.clientX, posY: ev.clientY });
  };

  return (
    <>
      {React.cloneElement(children, { onContextMenu: handleMenu })}
      <FloatingMenu posX={posX} posY={posY}>
        {options.map((opt, idx) => (
          <MenuItem key={idx} onClick={() => onSelect(opt)}>
            {opt}
          </MenuItem>
        ))}
      </FloatingMenu>
    </>
  );
}

const FloatingMenu = styled.div<{ posX: number | null; posY: number | null }>(
  ({ posX, posY }) => ({
    position: "absolute",
    top: posY || "0",
    left: posX || "0",
    display: posX === null ? "none" : "block",
    width: "150px",
    backgroundColor: "var(--joplin-background-color)",
    border: "1px solid var(--joplin-divider-color)",
    padding: "2px 0"
  })
);

const MenuItem = styled.div({
  padding: "7px 14px",
  userSelect: "none",
  "&:hover": {
    backgroundColor: "var(--joplin-background-color-hover3)",
  },
});
