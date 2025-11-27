// src/components/CalculatorApp.jsx
import { Box, Button } from "@mui/material";
import { useState, useRef, useEffect } from "react";

/* ---------- ICONS ---------- */
import { FaDivide, FaEquals, FaPlusMinus } from "react-icons/fa6";
import { MdAdd, MdBackspace, MdPercent, MdRemove } from "react-icons/md";

const STORAGE_KEY = "calculator-state-v1";
const EXPIRY_DAYS = 2;

// Helper: detect touch devices
const isTouchDevice = () =>
  "ontouchstart" in window || navigator.maxTouchPoints > 0;

const CalculatorApp = () => {
  const [display, setDisplay] = useState("0");
  const [prev, setPrev] = useState("");
  const [op, setOp] = useState("");
  const [shouldReset, setShouldReset] = useState(false);
  const [history, setHistory] = useState("");

  const historyRef = useRef(null);
  const displayRef = useRef(null);

  /* ---------- LOAD (with 2-day expiry) ---------- */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;

      const { timestamp, state } = JSON.parse(raw);
      const now = Date.now();
      const ageMs = now - timestamp;
      const maxAgeMs = EXPIRY_DAYS * 24 * 60 * 60 * 1000;

      if (ageMs > maxAgeMs) {
        localStorage.removeItem(STORAGE_KEY); // expired
        return;
      }

      setDisplay(state.display ?? "0");
      setPrev(state.prev ?? "");
      setOp(state.op ?? "");
      setShouldReset(state.shouldReset ?? false);
      setHistory(state.history ?? "");
    } catch (e) {
      console.error("Failed to load calculator state:", e);
    }
  }, []);

  /* ---------- SAVE (debounced) ---------- */
  useEffect(() => {
    const timeout = setTimeout(() => {
      const payload = {
        timestamp: Date.now(),
        state: { display, prev, op, shouldReset, history },
      };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      } catch (e) {
        console.error("Failed to save calculator state:", e);
      }
    }, 150);

    return () => clearTimeout(timeout);
  }, [display, prev, op, shouldReset, history]);

  /* ---------- FORMATTING ---------- */
  const formatNumber = (num) => {
    if (num === "Error") return "Error";
    if (num === "" || num === "-") return num;
    const [int, dec] = num.split(".");
    const formattedInt = Number(int.replace(/,/g, "")).toLocaleString("en-US");
    return dec !== undefined ? `${formattedInt}.${dec}` : formattedInt;
  };

  /* ---------- INPUT HANDLERS ---------- */
  const append = (val) => {
    setDisplay((d) => {
      if (shouldReset) {
        setShouldReset(false);
        return val;
      }
      if (d === "0") return val;
      return d + val;
    });
  };

  const operator = (nextOp) => {
    if (!display || display === "Error") return;

    if (prev && op && !shouldReset) {
      calculate();
      setOp(nextOp);
      return;
    }

    setPrev(display);
    setOp(nextOp);
    setShouldReset(true);

    const sym = nextOp === "*" ? "x" : nextOp === "/" ? "÷" : nextOp;
    setHistory(`${formatNumber(display)} ${sym}`);
  };

  const calculate = () => {
    if (!prev || !op || !display) return;

    const a = parseFloat(prev.replace(/,/g, ""));
    const b = parseFloat(display.replace(/,/g, ""));
    if (isNaN(a) || isNaN(b)) return;

    let result;
    switch (op) {
      case "+":
        result = a + b;
        break;
      case "-":
        result = a - b;
        break;
      case "*":
        result = a * b;
        break;
      case "/":
        result = b === 0 ? "Error" : a / b;
        break;
      default:
        return;
    }

    const sym = op === "*" ? "x" : op === "/" ? "÷" : op;
    setHistory(`${formatNumber(prev)} ${sym} ${formatNumber(display)} =`);
    setDisplay(result.toString());
    setPrev("");
    setOp("");
    setShouldReset(true);
  };

  const clear = () => {
    setDisplay("0");
    setPrev("");
    setOp("");
    setHistory("");
    setShouldReset(false);

    // Prevent mobile keyboard from popping up
    if (isTouchDevice()) {
      document.activeElement?.blur();
      setTimeout(() => {
        displayRef.current?.blur();
      }, 50);
    } else {
      // Desktop: allow quick typing
      setTimeout(() => {
        displayRef.current?.focus();
      }, 100);
    }
  };

  const backspace = () => {
    if (history.trim()) {
      // Clear history only
      setHistory("");
      setShouldReset(false);

      // Prevent unwanted keyboard on mobile
      if (isTouchDevice()) {
        document.activeElement?.blur();
        setTimeout(() => displayRef.current?.blur(), 50);
      } else {
        // Desktop: focus so user can type immediately
        setTimeout(() => displayRef.current?.focus(), 100);
      }
    } else {
      // Delete last digit
      setDisplay((d) => {
        if (d === "Error" || d === "0" || d.length <= 1) return "0";
        return d.slice(0, -1);
      });

      // Prevent mobile keyboard from appearing
      if (isTouchDevice()) {
        document.activeElement?.blur();
        setTimeout(() => displayRef.current?.blur(), 50);
      }
    }
  };

  /* ---------- EDITABLE HISTORY & DISPLAY ---------- */
  const handleHistoryChange = (e) => {
    const text = e.target.innerText.trim();
    setHistory(text);

    const expr = text
      .replace(/x/g, "*")
      .replace(/÷/g, "/")
      .replace(/,/g, "")
      .replace(/[^0-9+\-*/.]/g, "")
      .trim();

    if (expr && /[+\-*/]/.test(expr)) {
      try {
        const res = eval(expr);
        if (!isNaN(res) && isFinite(res)) {
          setDisplay(res.toString());
          setShouldReset(true);
        }
      } catch (_e) { /* ignore invalid expressions */ }
    }
  };

  const handleDisplayChange = (e) => {
    const raw = e.target.innerText.replace(/,/g, "");
    const sanitized = raw.replace(/[^0-9.-]/g, "");

    if (
      sanitized === "" ||
      sanitized === "-" ||
      sanitized === "." ||
      !isNaN(parseFloat(sanitized))
    ) {
      setDisplay(sanitized || "0");
      if (shouldReset) setShouldReset(false);
    }
  };

  const handleDisplayKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (prev && op) calculate();
    } else if (e.key === "Backspace") {
      e.preventDefault();
      backspace();
    } else if (e.key === "Escape") {
      e.preventDefault();
      clear();
    }
  };

  /* ---------- SYNC REFS WITH STATE ---------- */
  useEffect(() => {
    if (historyRef.current) {
      const cur = historyRef.current.innerText.trim();
      const exp = history || "";
      if (cur !== exp) historyRef.current.innerText = exp;
    }
  }, [history]);

  useEffect(() => {
    if (displayRef.current && history.trim() === "") {
      const formatted = formatNumber(display);
      const cur = displayRef.current.innerText;
      if (cur !== formatted) {
        displayRef.current.innerText = formatted;

        // Restore cursor to end
        const range = document.createRange();
        const sel = window.getSelection();
        range.selectNodeContents(displayRef.current);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    } else if (displayRef.current && history.trim() !== "") {
      // When history exists, just show formatted value (not editable)
      const formatted = formatNumber(display);
      if (displayRef.current.innerText !== formatted) {
        displayRef.current.innerText = formatted;
      }
    }
  }, [display, history]);
  // prevent mobile keyboard from showing when opening the app
  useEffect(() => {
    if (!isTouchDevice()) {
      // Desktop: focus for quick typing
      setTimeout(() => {
        displayRef.current?.focus();
      }, 150);
    } else {
      // Mobile: prevent unwanted keyboard
      document.activeElement?.blur();
    }
  }, []);

  /* ---------- BUTTON MATRIX ---------- */
  const buttons = [
    ["AC", "Backspace", "%", "/"],
    ["7", "8", "9", "X"],
    ["4", "5", "6", "-"],
    ["1", "2", "3", "+"],
    ["+/-", "0", ".", "="],
  ];

  const handleClick = (key) => {
    if (key === "AC") clear();
    else if (key === "=") calculate();
    else if (["+", "-", "X", "/"].includes(key))
      operator(key === "X" ? "*" : key);
    else if (key === "Backspace") backspace();
    else if (key === "+/-")
      setDisplay((d) =>
        d === "0" ? "0" : d.startsWith("-") ? d.slice(1) : "-" + d
      );
    else if (key === "%")
      setDisplay((d) => (parseFloat(d.replace(/,/g, "")) / 100).toString());
    else append(key);
  };

  const getButtonStyle = (key) => {
    const isOperator = ["+", "-", "X", "/", "="].includes(key);
    const isFunction = ["AC", "+/-", "%", "Backspace"].includes(key);

    return {
      bgcolor: isOperator
        ? "rgba(255, 159, 10, 0.8)"
        : isFunction
        ? "rgba(165, 165, 165, 0.8)"
        : "rgba(70, 70, 70, 0.7)",
      color: isOperator ? "#fff" : isFunction ? "#000" : "#fff",
      borderRadius: "12px",
      height: 60,
      fontSize: "1.2rem",
      fontWeight: "bold",
      textTransform: "none",
      minWidth: 0,
      "&:hover": {
        bgcolor: isOperator ? "#ffa733" : isFunction ? "#bdbdbd" : "#333",
      },
    };
  };

  const iconMap = {
    X: "x",
    Backspace: <MdBackspace size={22} />,
    "%": <MdPercent size={22} />,
    "+": <MdAdd size={22} />,
    "-": <MdRemove size={22} />,
    "/": <FaDivide size={22} />,
    "=": <FaEquals size={22} />,
    "+/-": <FaPlusMinus size={22} />,
  };

  /* ---------- RENDER ---------- */
  return (
    <Box
      sx={{
        transition: "background-color 0.3s ease-in-out",
        bgcolor: "rgba(20, 20, 20, 0.7)",
        boxShadow: "0 4px 15px rgba(0,0,0,0.5)",
        width: 300,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        userSelect: "none",
      }}
    >
      {/* History */}
      <Box
        ref={historyRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleHistoryChange}
        sx={{
          width: "100%",
          color: "#bbb",
          fontFamily: "monospace",
          fontSize: "1.1rem",
          minHeight: "1.4rem",
          pr: 1,
          py: 0.5,
          backdropFilter: "blur(.7px)",
          outline: "none",
          cursor: "text",
          textAlign: "right",
          "&:focus": { color: "#fff" },
          "&:empty:before": { content: '" "', color: "transparent" },
        }}
      />

      {/* Display */}
      {/* Display - Editable only when no history */}
      <Box
        ref={displayRef}
        contentEditable={history.trim() === ""}
        suppressContentEditableWarning={history.trim() === ""}
        onInput={history.trim() === "" ? handleDisplayChange : undefined}
        onKeyDown={history.trim() === "" ? handleDisplayKeyDown : undefined}
        onFocus={(e) => {
          if (history.trim() !== "") {
            e.target.blur(); // Prevent focus if history exists
          }
        }}
        sx={{
          width: "100%",
          color: "#fff",
          fontFamily: "monospace",
          fontSize: "2.8rem",
          pr: 1,
          py: 0.5,
          backdropFilter: "blur(.7px)",
          outline: "none",
          cursor: history.trim() === "" ? "text" : "default",
          textAlign: "right",
          overflowX: "auto",
          wordBreak: "break-all",
          userSelect: history.trim() === "" ? "text" : "none",
          "&:focus": {
            color: "#fff",
            outline: "none",
          },
          // Optional: visual cue when not editable
          opacity: history.trim() !== "" ? 0.9 : 1,
        }}
      />

      {/* Buttons */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 1,
          width: "100%",
          bgcolor: "rgba(20, 20, 20, 0.7)",
          p: 2,
        }}
      >
        {buttons.flat().map((key) => (
          <Button
            key={key}
            onClick={() => handleClick(key)}
            sx={getButtonStyle(key)}
          >
            {iconMap[key] ?? key}
          </Button>
        ))}
      </Box>
    </Box>
  );
};

export default CalculatorApp;
