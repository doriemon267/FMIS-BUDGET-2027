// src/components/apps/ChatApp.jsx
import { useState, useRef, useEffect } from "react";
import {
  Box,
  IconButton,
  Typography,
  Avatar,
  List,
  ListItem,
  Badge,
  InputBase,
  ListItemButton,
} from "@mui/material";
import { IoSend } from "react-icons/io5";
import { FiSearch } from "react-icons/fi";

const conversations = [
  {
    id: 1,
    name: "Alex Rivera",
    avatar: "A",
    lastMsg: "Sounds good! See you then",
    time: "2m",
    unread: 4,
    online: true,
  },
  {
    id: 2,
    name: "Sarah Chen",
    avatar: "S",
    lastMsg: "Thanks for the files!",
    time: "1h",
    unread: 0,
    online: true,
  },
  {
    id: 3,
    name: "Jordan Kim",
    avatar: "J",
    lastMsg: "let's goooo",
    time: "3h",
    unread: 1,
    online: false,
  },
  {
    id: 4,
    name: "Maya Patel",
    avatar: "M",
    lastMsg: "Voice message (0:12)",
    time: "yesterday",
    unread: 0,
    online: false,
  },
];

const initialMessages = [
  { id: 1, text: "Hey! How's it going?", sender: "them", time: "2:30 PM" },
  {
    id: 2,
    text: "Pretty good! Just shipped a new feature",
    sender: "me",
    time: "2:31 PM",
  },
  { id: 3, text: "No way! What does it do?", sender: "them", time: "2:32 PM" },
  {
    id: 4,
    text: "Real-time collaborative whiteboarding",
    sender: "me",
    time: "2:33 PM",
  },
  { id: 5, text: "That's actually insane", sender: "them", time: "2:34 PM" },
];

export default function ChatApp() {
  const [selected, setSelected] = useState(conversations[0]);
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  const sendMessage = () => {
    if (!input.trim()) return;
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now(),
        text: input,
        sender: "me",
        time: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      },
    ]);
    setInput("");
  };

  return (
    <Box
      sx={{
        width: 390,
        height: 620,
        bgcolor: "rgba(15, 15, 25, 0.95)",
        overflow: "hidden",
        boxShadow: "0 20px 40px rgba(0,0,0,0.6)",
        backdropFilter: "blur(20px)",
        border: "1px solid rgba(255,255,255,0.08)",
        display: "flex",
        flexDirection: "column",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <Box sx={{ display: "flex", flex: 1, minHeight: 0 }}>
        {/* Sidebar */}
        <Box
          sx={{
            bgcolor: "rgba(10, 10, 20, 0.7)",
            borderRight: "1px solid rgba(255,255,255,0.05)",
          }}
        >
          <Box sx={{ p: 1 }}>
            <Box
              sx={{
                bgcolor: "rgba(255,255,255,0.08)",
                borderRadius: 3,
                display: "flex",
                alignItems: "center",
                p: 1,
              }}
            >
              <FiSearch color="#888" />
            </Box>
          </Box>

          <List sx={{ pt: 0 }}>
            {conversations.map((c) => (
              <ListItem key={c.id} disablePadding>
                <ListItemButton
                  selected={selected.id === c.id}
                  onClick={() => setSelected(c)}
                  sx={{
                    flexDirection: "column",
                    position: "relative",
                    bgcolor:
                      selected.id === c.id
                        ? "rgba(0, 176, 255, 0.15)"
                        : "transparent",
                    "&:hover": { bgcolor: "rgba(0, 176, 255, 0.08)" },
                    borderRadius: 1,
                  }}
                >
                  {/* Avatar with online badge */}
                  <Badge
                    overlap="circular"
                    anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                    badgeContent={
                      c.online ? (
                        <Box
                          sx={{
                            width: 14,
                            height: 14,
                            bgcolor: "#4ade80",
                            border: "3px solid #0f0f1a",
                            borderRadius: "50%",
                          }}
                        />
                      ) : null
                    }
                  >
                    <Avatar
                      sx={{
                        width: 36,
                        height: 36,
                        bgcolor: "#00b0ff",
                        fontWeight: "bold",
                        fontSize: "1.1rem",
                        boxShadow: "0 4px 12px rgba(0,176,255,0.3)",
                      }}
                    >
                      {c.avatar}
                    </Avatar>
                  </Badge>

                  {/* Unread count badge */}
                  {c.unread > 0 && (
                    <Box
                      sx={{
                        position: "absolute",
                        top: 8,
                        right: 12,
                        bgcolor: "#ff3b30",
                        color: "white",
                        borderRadius: "50%",
                        width: 17,
                        height: 17,
                        fontSize: 11,
                        fontWeight: "bold",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {c.unread}
                    </Box>
                  )}
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Box>

        {/* Main Chat */}
        <Box
          sx={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            bgcolor: "rgba(20,20,35,0.95)",
          }}
        >
          {/* Chat Header */}
          <Box
            sx={{
              py: 1,
              px: 2,
              borderBottom: "1px solid rgba(255,255,255,0.08)",
              display: "flex",
              alignItems: "center",
              gap: 2,
            }}
          >
            <Badge
              overlap="circular"
              anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
              badgeContent={
                <Box
                  sx={{
                    width: 14,
                    height: 14,
                    bgcolor: "#4ade80",
                    border: "3px solid #141421",
                    borderRadius: "50%",
                  }}
                />
              }
            >
              <Avatar
                sx={{
                  bgcolor: "#00b0ff",
                  width: 44,
                  height: 44,
                  fontWeight: "bold",
                }}
              >
                {selected.avatar}
              </Avatar>
            </Badge>
            <Box>
              <Typography fontWeight="700" color="white">
                {selected.name}
              </Typography>
              <Typography variant="caption" color="#00b0ff">
                Active now
              </Typography>
            </Box>
          </Box>

          {/* Messages */}
          <Box
            sx={{
              flex: 1,
              overflowY: "auto",
              p: 3,
              backgroundImage: `url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><defs><pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M 10 0 L 0 0 0 10" fill="none" stroke="%23333333" stroke-width="0.5"/></pattern></defs><rect width="100" height="100" fill="url(%23grid)"/></svg>')`,
              backgroundAttachment: "fixed",
            }}
          >
            {messages.map((msg) => (
              <Box
                key={msg.id}
                sx={{
                  mb: 2.5,
                  display: "flex",
                  justifyContent:
                    msg.sender === "me" ? "flex-end" : "flex-start",
                }}
              >
                <Box
                  sx={{
                    maxWidth: "78%",
                    px: 2.5,
                    py: 1.8,
                    borderRadius: 3,
                    borderTopLeftRadius: msg.sender === "me" ? 18 : 4,
                    borderTopRightRadius: msg.sender === "me" ? 4 : 18,
                    borderBottomLeftRadius: 18,
                    borderBottomRightRadius: 18,
                    bgcolor:
                      msg.sender === "me"
                        ? "linear-gradient(135deg, #00b0ff, #0081cb)"
                        : "rgba(255,255,255,0.08)",
                    color: msg.sender === "me" ? "white" : "#e0e0e0",
                    boxShadow:
                      msg.sender === "me"
                        ? "0 8px 20px rgba(0,176,255,0.3)"
                        : "0 2px 8px rgba(0,0,0,0.2)",
                    backdropFilter: "blur(10px)",
                    position: "relative",
                  }}
                >
                  <Typography
                    variant="body1"
                    sx={{ lineHeight: 1.5, wordBreak: "break-word" }}
                  >
                    {msg.text}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      opacity: 0.7,
                      fontSize: "0.7rem",
                      display: "block",
                      textAlign: "right",
                      mt: 0.5,
                    }}
                  >
                    {msg.time}
                  </Typography>
                </Box>
              </Box>
            ))}
            <div ref={messagesEndRef} />
          </Box>

          {/* Input */}
          <Box
            sx={{
              borderTop: "1px solid rgba(255,255,255,0.08)",
              bgcolor: "rgba(15,15,25,0.8)",
            }}
          >
            <InputBase
              fullWidth
              multiline
              maxRows={4}
              placeholder="Type a message..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) =>
                e.key === "Enter" &&
                !e.shiftKey &&
                (e.preventDefault(), sendMessage())
              }
              sx={{
                bgcolor: "rgba(255,255,255,0.07)",
                px: 3,
                py: 1,
                color: "white",
                fontSize: "1rem",
                backdropFilter: "blur(10px)",
                border: "1px solid rgba(255,255,255,0.1)",
                "&:hover": { borderColor: "rgba(0,176,255,0.4)" },
                "&:focus": { outline: "none", borderColor: "#00b0ff" },
              }}
              endAdornment={
                <IconButton
                  onClick={sendMessage}
                  disabled={!input.trim()}
                  sx={{
                    bgcolor: input.trim() ? "#00b0ff" : "rgba(255,255,255,0.1)",
                    color: "white",
                    ml: 1,
                    "&:hover": { bgcolor: "#0099e6" },
                    transition: "all 0.2s",
                  }}
                >
                  <IoSend />
                </IconButton>
              }
            />
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
