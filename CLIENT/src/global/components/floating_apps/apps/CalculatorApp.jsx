// src/components/CalculatorApp.jsx
import { Box, Button, Dialog, DialogTitle, DialogContent, DialogActions, Stack, Typography, Select, MenuItem, FormControl, Tooltip } from "@mui/material";
import { useState, useRef, useEffect } from "react";

/* ---------- ICONS ---------- */
import { FaDivide, FaEquals, FaPlusMinus } from "react-icons/fa6";
import { MdAdd, MdBackspace, MdPercent, MdRemove, MdHistory } from "react-icons/md";

const STORAGE_KEY = "calculator-state-v1";
const HISTORY_KEY = "calculator-history-v1";
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

  // New enhancements
  const [scientificMode, setScientificMode] = useState(() => {
    try { return localStorage.getItem("calcScientificMode") === "true"; } catch { return false; }
  });
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem("calcTheme") || "dark"; } catch { return "dark"; }
  });
  const [calculationHistory, setCalculationHistory] = useState(() => {
    try { const h = localStorage.getItem(HISTORY_KEY); return h ? JSON.parse(h) : []; } catch { return []; }
  });
  const [showHistory, setShowHistory] = useState(false);

  // Save preferences
  useEffect(() => {
    try { localStorage.setItem("calcScientificMode", scientificMode); } catch { }
    try { localStorage.setItem("calcTheme", theme); } catch { }
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(calculationHistory.slice(0, 50))); } catch { }
  }, [scientificMode, theme, calculationHistory]);

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

  // Scientific functions
  const scientificFunctions = {
    sin: (x) => Math.sin((x * Math.PI) / 180),
    cos: (x) => Math.cos((x * Math.PI) / 180),
    tan: (x) => Math.tan((x * Math.PI) / 180),
    sqrt: (x) => Math.sqrt(x),
    log: (x) => Math.log10(x),
    ln: (x) => Math.log(x),
    π: () => Math.PI,
    e: () => Math.E,
  };

  const applyScienticFunction = (func) => {
    const val = parseFloat(display.replace(/,/g, ""));
    if (isNaN(val)) return;
    
    let result;
    if (func === "π") result = Math.PI;
    else if (func === "e") result = Math.E;
    else if (scientificFunctions[func]) result = scientificFunctions[func](val);
    else return;

    setDisplay(result.toString());
    setShouldReset(true);
    addToHistory(`${func}(${val})`, result.toString());
  };

  const addToHistory = (expression, result) => {
    const entry = `${expression} = ${result}`;
    setCalculationHistory(prev => [entry, ...prev.slice(0, 49)]);
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
    addToHistory(`${a} ${sym} ${b}`, result.toString());
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

  const scientificButtons = [
    ["AC", "Backspace", "%", "/"],
    ["sin", "cos", "tan", "X"],
    ["√", "log", "ln", "-"],
    ["π", "e", "^", "+"],
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
    else if (["sin", "cos", "tan", "√", "log", "ln", "π", "e"].includes(key))
      applyScienticFunction(key);
    else if (key === "^") operator("^");
    else append(key);
  };

  const getButtonStyle = (key) => {
    const isOperator = ["+", "-", "X", "/", "="].includes(key);
    const isFunction = ["AC", "+/-", "%", "Backspace"].includes(key);
    const isScientific = ["sin", "cos", "tan", "√", "log", "ln", "π", "e", "^"].includes(key);

    const bgColor = theme === "dark" 
      ? isOperator ? "rgba(255, 159, 10, 0.8)" : isFunction ? "rgba(165, 165, 165, 0.8)" : isScientific ? "rgba(100, 100, 150, 0.8)" : "rgba(70, 70, 70, 0.7)"
      : isOperator ? "rgba(255, 152, 0, 0.9)" : isFunction ? "rgba(158, 158, 158, 0.9)" : isScientific ? "rgba(76, 101, 189, 0.9)" : "rgba(200, 200, 200, 0.9)";

    const textColor = theme === "dark" 
      ? isFunction && !isOperator && !isScientific ? "#000" : "#fff"
      : "#000";

    return {
      bgcolor: bgColor,
      color: textColor,
      borderRadius: "12px",
      height: 50,
      fontSize: scientificMode ? "0.9rem" : "1.2rem",
      fontWeight: "bold",
      textTransform: "none",
      minWidth: 0,
      padding: "4px",
      "&:hover": {
        opacity: 0.8,
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
    "√": "√",
    "^": "^",
  };

  /* ---------- RENDER ---------- */
  const bgColor = theme === "dark" ? "rgba(20, 20, 20, 0.7)" : "rgba(240, 240, 240, 0.9)";
  const textColor = theme === "dark" ? "#fff" : "#000";
  const borderColor = theme === "dark" ? "#333" : "#ddd";

  return (
    <Box
      sx={{
        transition: "background-color 0.3s ease-in-out",
        bgcolor: bgColor,
        boxShadow: "0 4px 15px rgba(0,0,0,0.5)",
        width: scientificMode ? 400 : 300,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        userSelect: "none",
        color: textColor,
      }}
    >
      {/* Controls */}
      <Stack direction="row" spacing={1} sx={{ width: "100%", p: 1, justifyContent: "space-between", alignItems: "center" }}>
        <Stack direction="row" spacing={0.5}>
          <Tooltip title="Scientific mode">
            <Button
              size="small"
              variant={scientificMode ? "contained" : "outlined"}
              onClick={() => setScientificMode(!scientificMode)}
              sx={{ fontSize: "0.7rem", py: 0.3 }}
            >
              S
            </Button>
          </Tooltip>
          
          <Tooltip title="Toggle theme">
            <Button
              size="small"
              variant="outlined"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              sx={{ fontSize: "0.7rem", py: 0.3 }}
            >
              {theme === "dark" ? "☀️" : "🌙"}
            </Button>
          </Tooltip>
        </Stack>

        <Tooltip title="View history">
          <Button
            size="small"
            variant="outlined"
            startIcon={<MdHistory size={16} />}
            onClick={() => setShowHistory(true)}
            sx={{ fontSize: "0.7rem", py: 0.3 }}
          >
            H
          </Button>
        </Tooltip>
      </Stack>

      {/* History */}
      <Box
        ref={historyRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleHistoryChange}
        sx={{
          width: "100%",
          color: textColor === "#fff" ? "#bbb" : "#666",
          fontFamily: "monospace",
          fontSize: "1.1rem",
          minHeight: "1.4rem",
          pr: 1,
          py: 0.5,
          backdropFilter: "blur(.7px)",
          outline: "none",
          cursor: "text",
          textAlign: "right",
          borderBottom: `1px solid ${borderColor}`,
          "&:focus": { color: textColor },
          "&:empty:before": { content: '" "', color: "transparent" },
        }}
      />

      {/* Display */}
      <Box
        ref={displayRef}
        contentEditable={history.trim() === ""}
        suppressContentEditableWarning={history.trim() === ""}
        onInput={history.trim() === "" ? handleDisplayChange : undefined}
        onKeyDown={history.trim() === "" ? handleDisplayKeyDown : undefined}
        onFocus={(e) => {
          if (history.trim() !== "") {
            e.target.blur();
          }
        }}
        sx={{
          width: "100%",
          color: textColor,
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
          borderBottom: `1px solid ${borderColor}`,
          "&:focus": {
            color: textColor,
            outline: "none",
          },
          opacity: history.trim() !== "" ? 0.9 : 1,
        }}
      />

      {/* Buttons */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: `repeat(${scientificMode ? 4 : 4}, 1fr)`,
          gap: 0.5,
          width: "100%",
          bgcolor: bgColor,
          p: scientificMode ? 1 : 2,
        }}
      >
        {(scientificMode ? scientificButtons : buttons).flat().map((key) => (
          <Button
            key={key}
            onClick={() => handleClick(key)}
            sx={getButtonStyle(key)}
          >
            {iconMap[key] ?? key}
          </Button>
        ))}
      </Box>

      {/* History Dialog */}
      <Dialog open={showHistory} onClose={() => setShowHistory(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Calculation History</DialogTitle>
        <DialogContent sx={{ maxHeight: 400, overflowY: "auto" }}>
          {calculationHistory.length === 0 ? (
            <Typography sx={{ color: "#aaa", textAlign: "center", py: 2 }}>No calculations yet</Typography>
          ) : (
            <Stack spacing={1}>
              {calculationHistory.map((item, idx) => (
                <Box
                  key={idx}
                  sx={{
                    p: 1,
                    bgcolor: theme === "dark" ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)",
                    borderRadius: 1,
                    fontFamily: "monospace",
                    fontSize: "0.9rem",
                    cursor: "pointer",
                    "&:hover": { bgcolor: theme === "dark" ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)" },
                    onClick: () => {
                      const result = item.split(" = ")[1];
                      if (result) {
                        setDisplay(result);
                        setHistory("");
                        setShouldReset(true);
                        setShowHistory(false);
                      }
                    },
                  }}
                >
                  {item}
                </Box>
              ))}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCalculationHistory([])} color="error">Clear History</Button>
          <Button onClick={() => setShowHistory(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CalculatorApp;
