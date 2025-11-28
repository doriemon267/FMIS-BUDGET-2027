// src/components/FloatingAppWindow.jsx
import { useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import Draggable from "react-draggable";
import { Paper, IconButton, Box, Typography } from "@mui/material";
import { MdClose, MdRemove } from "react-icons/md";

const FloatingAppWindow = ({
  title,
  children,
  onClose,
  defaultPosition = { x: 0, y: 0 },
  zIndex,
  onActivate,
  onPositionChange,
  onMinimize,
  active = false,
}) => {
  const nodeRef = useRef(null);
  const focusRef = useRef(null);

  console.log('[FloatingAppWindow] render content for', title, defaultPosition, 'zIndex', zIndex);
  const content = (
    <Draggable
      handle=".window-handle"
      nodeRef={nodeRef}
      defaultPosition={defaultPosition}
      onStop={(e, data) => {
        console.debug('[FloatingAppWindow] onStop: position', data);
        onPositionChange?.({ x: data.x, y: data.y });
      }}
      // Leave 'position' undefined so Draggable works in uncontrolled mode
    >
      <Box
        ref={nodeRef}
        className="floating-app-window"
        sx={{
          position: "fixed",
          zIndex: zIndex ?? 1400,
          // NO top/left/transform → Draggable fully controls position
        }}
        style={{ left: defaultPosition?.x ?? undefined, top: defaultPosition?.y ?? undefined }}
        onMouseDown={() => {
          console.debug('[FloatingAppWindow] onMouseDown - activate window', title);
          onActivate?.();
        }}
      >
        <Paper
          ref={focusRef}
          tabIndex={-1}
          role="dialog"
          aria-label={title}
          elevation={12}
          sx={{
            minWidth: 300,
            maxWidth: 500,
            borderRadius: 2,
            overflow: "hidden",
            userSelect: "none",
            boxShadow: "0 8px 40px rgba(0,0,0,0.35)",
            background: "rgba(255,255,255,0.95)",
            border: "1px solid rgba(0,0,0,0.08)",
          }}
        >
          {/* Drag Handle */}
          <Box
            className="window-handle"
            sx={{
              bgcolor: "rgba(15,15,15,0.95)",
              color: "white",
              px: 2,
              py: 0.5,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              cursor: "move",
              backdropFilter: "blur(10px)",
            }}
          >
            <Typography variant="subtitle1" fontWeight="bold">
              {title}
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center'}}>
              <IconButton size="small" onClick={() => onMinimize?.(true)} sx={{ color: "white" }}>
                <MdRemove />
              </IconButton>
              <IconButton size="small" onClick={onClose} sx={{ color: "white" }}>
                <MdClose />
              </IconButton>
            </Box>
          </Box>

          {/* Content */}
          <Box
            sx={{ maxHeight: "80vh", overflow: "auto", bgcolor: "transparent" }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                onClose?.();
              }
            }}
          >
            {children}
          </Box>

          {/* Footer */}
          <Box
            className="window-handle"
            sx={{
              bgcolor: "rgba(0,0,0,.8)",
              color: "white",
              p: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
              cursor: "move",
            }}
          />
        </Paper>
      </Box>
    </Draggable>
  );

  useEffect(() => {
    if (!active) return undefined;
    const id = setTimeout(() => focusRef.current?.focus(), 30);
    return () => clearTimeout(id);
  }, [active]);

  if (typeof document !== 'undefined' && document.body) {
    return createPortal(content, document.body);
  }
  return content;
};

export default FloatingAppWindow;
