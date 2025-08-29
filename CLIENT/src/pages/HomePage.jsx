import React, { useState, useEffect } from "react";
import { Button, Typography, Box, Switch } from "@mui/material";
import env from "../utils/env";
import { motion } from "framer-motion";

const motivationalQuotes = [
  "Code is like humor. When you have to explain it, it’s bad.",
  "Experience is the name everyone gives to their mistakes.",
  "Simplicity is the soul of efficiency.",
  "Make it work, make it right, make it fast.",
  "Talk is cheap. Show me the code.",
  "First, solve the problem. Then, write the code.",
];

const HomePage = () => {
  const [darkMode, setDarkMode] = useState(false);
  const [quote, setQuote] = useState(motivationalQuotes[0]);

  const [text, setText] = useState(
    "Hello Dev! 🚀Welcome to the FMIS Project. Get started now!"
  );

  useEffect(() => {
    let index = 13; // Start after "Hello Dev! 🚀"
    const message = "Welcome to the FMIS Project. Get started now!";
    setText("Hello Developer! 🚀"); // Reset text initially
    const interval = setInterval(() => {
      if (index - 13 < message.length) {
        setText((prev) => prev + message[index - 14]);
        index++;
      } else {
        clearInterval(interval);
      }
    }, 40);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const quoteInterval = setInterval(() => {
      setQuote(
        motivationalQuotes[
          Math.floor(Math.random() * motivationalQuotes.length)
        ]
      );
    }, 4000);
    return () => clearInterval(quoteInterval);
  }, []);

  const handleNavigateToLogin = () => {
    location.href = env("AUTH_CLIENT_URL") + "/login";
  };

  return (
    <Box
      sx={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        textAlign: "center",
        background: darkMode
          ? "linear-gradient(135deg, #0f0f0f, #1a1a1a)"
          : "linear-gradient(135deg, #002b36, #004d40)",
        color: "white",
        transition: "background 0.5s ease",
        overflow: "hidden",
      }}
    >
      <Switch
        checked={darkMode}
        onChange={() => setDarkMode(!darkMode)}
        sx={{ position: "absolute", top: 20, right: 20 }}
      />

      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1 }}
      >
        <Typography
          variant="h1"
          sx={{ fontWeight: "bold", mb: 2, textShadow: "0px 0px 20px #00ffcc" }}
        >
          {text}
        </Typography>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 1 }}
      >
        <Typography
          variant="h5"
          sx={{ mb: 4, fontStyle: "italic", color: "#00ffcc" }}
        >
          {quote}
        </Typography>
      </motion.div>

      <motion.div whileHover={{ scale: 1.1 }}>
        <Button
          variant="contained"
          sx={{
            background: "#00ffcc",
            color: "#002b36",
            fontWeight: "bold",
            fontSize: "1.2rem",
            mb: 2,
            boxShadow: "0px 0px 20px #00ffcc",
            ":hover": {
              background: "#00ffcc",
              color: "#002b36",
              boxShadow: "0px 0px 20px #00ffcc",
            },
          }}
          onClick={handleNavigateToLogin}
        >
          LOGIN
        </Button>
      </motion.div>
    </Box>
  );
};

export default HomePage;
