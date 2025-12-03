import { useState, useEffect, useRef } from "react";
import { Box, Typography, Stack, Button, TextField, Dialog, DialogTitle, DialogContent, DialogActions, Select, MenuItem, FormControl, IconButton, Chip, Tooltip } from "@mui/material";
import { FiLogIn, FiPlus, FiTrash2, FiPlay, FiPause, FiRotateCcw } from "react-icons/fi";
import { MdAlarm, MdAlarmOff } from "react-icons/md";

const ClockApp = () => {
  const [now, setNow] = useState(new Date());
  const animationRef = useRef();

  const hourHandRef = useRef();
  const minuteHandRef = useRef();
  const secondHandRef = useRef();
  const counterWeightRef = useRef();

  const [timeIn, setTimeIn] = useState("");
  const [timeOut, setTimeOut] = useState("");
  const [timeToGo, setTimeToGo] = useState(false);

  // New enhancements
  const [displayFormat, setDisplayFormat] = useState("12h"); // 12h or 24h
  const [displayMode, setDisplayMode] = useState("clock"); // clock, stopwatch, timer, worldtime
  const [clockFormat, setClockFormat] = useState(() => {
    try { return localStorage.getItem("clockFormat") || "12h"; } catch { return "12h"; }
  });

  // Alarms
  const [alarms, setAlarms] = useState(() => {
    try { const s = localStorage.getItem("clashAlarms"); return s ? JSON.parse(s) : []; } catch { return []; }
  });
  const [showAlarmDialog, setShowAlarmDialog] = useState(false);
  const [newAlarmTime, setNewAlarmTime] = useState("08:00");
  const [newAlarmLabel, setNewAlarmLabel] = useState("Alarm");
  
  // Stopwatch
  const [stopwatchMs, setStopwatchMs] = useState(0);
  const [stopwatchRunning, setStopwatchRunning] = useState(false);
  const stopwatchRef = useRef(null);

  // Timer
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerInput, setTimerInput] = useState("");
  const [timerRunning, setTimerRunning] = useState(false);
  const timerRef = useRef(null);

  // World time zones
  const [worldTimeZones, setWorldTimeZones] = useState(() => {
    try { return localStorage.getItem("worldTimeZones") ? JSON.parse(localStorage.getItem("worldTimeZones")) : ["UTC", "Asia/Manila", "America/New_York"]; } catch { return ["UTC", "Asia/Manila", "America/New_York"]; }
  });
  const [newTimeZone, setNewTimeZone] = useState("UTC");

  const commonTimeZones = ["UTC", "Asia/Manila", "Asia/Tokyo", "Asia/Hong_Kong", "America/New_York", "America/Los_Angeles", "Europe/London", "Europe/Paris", "Australia/Sydney"];

  // Save preferences
  useEffect(() => {
    try { localStorage.setItem("clockFormat", clockFormat); } catch { }
    try { localStorage.setItem("clashAlarms", JSON.stringify(alarms)); } catch { }
    try { localStorage.setItem("worldTimeZones", JSON.stringify(worldTimeZones)); } catch { }
  }, [clockFormat, alarms, worldTimeZones]);

  // Stopwatch logic
  useEffect(() => {
    if (!stopwatchRunning) return;
    const interval = setInterval(() => {
      setStopwatchMs(p => p + 10);
    }, 10);
    return () => clearInterval(interval);
  }, [stopwatchRunning]);

  // Timer logic
  useEffect(() => {
    if (!timerRunning || timerSeconds <= 0) return;
    const interval = setInterval(() => {
      setTimerSeconds(p => {
        if (p <= 1) {
          setTimerRunning(false);
          try {
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification("Timer Finished!", { body: "Your timer is done!" });
            }
          } catch (e) { }
          return 0;
        }
        return p - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timerRunning, timerSeconds]);

  // Alarm checking
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      
      alarms.forEach(alarm => {
        if (alarm.time === currentTime && alarm.enabled && !alarm.triggered) {
          try {
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification(alarm.label || "Alarm!", { body: alarm.time });
            }
          } catch (e) { }
          setAlarms(prev => prev.map(a => a.id === alarm.id ? { ...a, triggered: true } : a));
        }
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [alarms]);

  // Format stopwatch time
  const formatStopwatch = () => {
    const totalSeconds = Math.floor(stopwatchMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const ms = Math.floor((stopwatchMs % 1000) / 10);
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(ms).padStart(2, "0")}`;
  };

  // Format timer time
  const formatTimer = () => {
    const minutes = Math.floor(timerSeconds / 60);
    const seconds = timerSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  };

  // Add alarm
  const addAlarm = () => {
    if (!newAlarmTime) return;
    const alarm = {
      id: Date.now(),
      time: newAlarmTime,
      label: newAlarmLabel || "Alarm",
      enabled: true,
      triggered: false,
    };
    setAlarms([...alarms, alarm]);
    setNewAlarmTime("08:00");
    setNewAlarmLabel("Alarm");
    setShowAlarmDialog(false);
  };

  // Delete alarm
  const deleteAlarm = (id) => {
    setAlarms(alarms.filter(a => a.id !== id));
  };

  // Toggle alarm
  const toggleAlarm = (id) => {
    setAlarms(alarms.map(a => a.id === id ? { ...a, enabled: !a.enabled, triggered: false } : a));
  };

  // Add timezone
  const addTimeZone = () => {
    if (newTimeZone && !worldTimeZones.includes(newTimeZone)) {
      setWorldTimeZones([...worldTimeZones, newTimeZone]);
      setNewTimeZone("UTC");
    }
  };

  // Remove timezone
  const removeTimeZone = (tz) => {
    setWorldTimeZones(worldTimeZones.filter(t => t !== tz));
  };

  // Get time in timezone
  const getTimeInZone = (tz) => {
    try {
      return now.toLocaleTimeString([], { timeZone: tz, hour: clockFormat === "24h" ? "2-digit" : "2-digit", minute: "2-digit", second: "2-digit", hour12: clockFormat === "12h" });
    } catch { return "--:--"; }
  };

  // Auto-calculate Time-Out when Time-In changes
  useEffect(() => {
    if (!timeIn) {
      setTimeOut("");
      return;
    }

    const [h, m] = timeIn.split(":").map(Number);
    const totalMinutes = h * 60 + m;
    const day = new Date().getDay(); // 1 = Monday

    let outH, outM;

    if (day === 1) {
      // Monday - Flag Ceremony
      if (totalMinutes <= 7 * 60 + 45) {
        // On time or early → +9 hours
        const result = totalMinutes + 9 * 60;
        outH = Math.floor(result / 60);
        outM = result % 60;
      } else {
        // Late → Fixed 4:45 PM
        outH = 16;
        outM = 45;
      }
    } else if (day >= 2 && day <= 5) {
      // Tuesday to Friday
      if (totalMinutes <= 9 * 60) {
        // On time → +9 hours
        const result = totalMinutes + 9 * 60;
        outH = Math.floor(result / 60);
        outM = result % 60;
      } else {
        // Late → Fixed 6:00 PM
        outH = 18;
        outM = 0;
      }
    } else {
      // Weekend
      setTimeOut("");
      return;
    }

    const formatted = `${String(outH).padStart(2, "0")}:${String(outM).padStart(
      2,
      "0"
    )}`;
    setTimeOut(formatted);
  }, [timeIn]);

  // Save Time-In
  const handleTimeInChange = (e) => {
    const val = e.target.value;
    setTimeIn(val);
    if (val) {
      localStorage.setItem("clockTimeIn", val);
    } else {
      localStorage.removeItem("clockTimeIn");
    }
  };

  // Clock animation
  useEffect(() => {
    const tick = () => {
      const t = new Date();
      const h = t.getHours() % 12;
      const m = t.getMinutes();
      const s = t.getSeconds();
      const ms = t.getMilliseconds();

      const secDeg = (s + ms / 1000) * 6;
      const minDeg = (m + s / 60) * 6;
      const hourDeg = (h + m / 60) * 30;

      if (hourHandRef.current)
        hourHandRef.current.style.transform = `translateX(-50%) rotate(${hourDeg}deg)`;
      if (minuteHandRef.current)
        minuteHandRef.current.style.transform = `translateX(-50%) rotate(${minDeg}deg)`;
      if (secondHandRef.current)
        secondHandRef.current.style.transform = `translateX(-50%) rotate(${secDeg}deg)`;
      if (counterWeightRef.current)
        counterWeightRef.current.style.transform = `translateX(-50%) rotate(${
          secDeg + 180
        }deg)`;

      setNow(t);
      animationRef.current = requestAnimationFrame(tick);
    };
    animationRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationRef.current);
  }, []);

  // Check if it's time to go
  useEffect(() => {
    if (!timeOut) return;
    const [h, m] = timeOut.split(":").map(Number);
    const check = () => {
      const n = new Date();
      setTimeToGo(
        n.getHours() > h || (n.getHours() === h && n.getMinutes() >= m)
      );
    };
    check();
    const id = setInterval(check, 5000);
    return () => clearInterval(id);
  }, [timeOut]);

  // Late detection
  const isLate = () => {
    if (!timeIn) return false;
    const [h, m] = timeIn.split(":").map(Number);
    const total = h * 60 + m;
    const day = new Date().getDay();
    if (day === 1) return total > 465; // > 7:45
    if (day >= 2 && day <= 5) return total > 540; // > 9:00
    return false;
  };

  const timeOutAngle = timeOut
    ? (parseInt(timeOut.split(":")[0]) % 12) * 30 +
      parseInt(timeOut.split(":")[1]) * 0.5
    : null;

  const format12 = (t) => {
    if (!t) return "--:--";
    const [h, m] = t.split(":").map(Number);
    const hh = h % 12 || 12;
    return `${hh.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
  };

  return (
    <Box sx={{ userSelect: "none" }}>
      {/* Main Container */}
      <Box
        sx={{
          bgcolor: "background.paper",
          boxShadow: 6,
          width: 340,
          mx: "auto",
          p: 2,
          position: "relative",
          zIndex: 1300,
        }}
      >
        {/* Mode Selector */}
        <Stack direction="row" spacing={0.5} sx={{ mb: 2, justifyContent: "center", flexWrap: "wrap", gap: 0.5 }}>
          {["clock", "alarm", "timer", "stopwatch", "worldtime"].map((m) => (
            <Button
              key={m}
              size="small"
              variant={displayMode === m ? "contained" : "outlined"}
              onClick={() => setDisplayMode(m)}
              sx={{ fontSize: "0.7rem", py: 0.3, textTransform: "capitalize" }}
            >
              {m}
            </Button>
          ))}
        </Stack>

        {/* CLOCK MODE */}
        {displayMode === "clock" && (
          <>
            {/* Format Toggle */}
            <Stack direction="row" spacing={1} sx={{ mb: 1, justifyContent: "center" }}>
              <Button 
                size="small" 
                variant={clockFormat === "12h" ? "contained" : "outlined"}
                onClick={() => setClockFormat("12h")}
                sx={{ fontSize: "0.7rem" }}
              >
                12H
              </Button>
              <Button 
                size="small" 
                variant={clockFormat === "24h" ? "contained" : "outlined"}
                onClick={() => setClockFormat("24h")}
                sx={{ fontSize: "0.7rem" }}
              >
                24H
              </Button>
            </Stack>

            {/* Status Banner */}
            <Box sx={{ textAlign: "center", pt: 1 }}>
              {isLate() ? (
                <Typography
                  variant="h6"
                  sx={{
                    color: "#ff1744",
                    fontWeight: "bold",
                    fontFamily: "monospace",
                    animation: "pulse 1.2s infinite",
                  }}
                >
                  LATE!
                </Typography>
              ) : timeIn ? (
                <Typography
                  variant="h6"
                  sx={{
                    color: "#4caf50",
                    fontWeight: "bold",
                    fontFamily: "monospace",
                  }}
                >
                  On Time
                </Typography>
              ) : null}

              {timeToGo && (
                <Typography
                  variant="h6"
                  sx={{
                    color: "#00e676",
                    fontWeight: "bold",
                    fontFamily: "monospace",
                    animation: "pulse 1.5s infinite",
                    mt: 0.5,
                  }}
                >
                  READY TO GO!
                </Typography>
              )}
            </Box>

            {/* Analog Clock */}
            <Box
              sx={{
                position: "relative",
                width: 260,
                height: 260,
                mx: "auto",
                my: 1,
              }}
            >
              <Box
                sx={{
                  width: "100%",
                  height: "100%",
                  borderRadius: "50%",
                  background: "#fdfdfd",
                  border: "6px solid #b8b8b8ff",
                  position: "relative",
                }}
              >
                {/* Minute Ticks */}
                {Array.from({ length: 60 }, (_, i) => (
                  <Box
                    key={i}
                    sx={{
                      position: "absolute",
                      top: "50%",
                      left: "50%",
                      width: i % 5 === 0 ? 4 : 2,
                      height: i % 5 === 0 ? 14 : 8,
                      backgroundColor: "#000",
                      transform: `translate(-50%, -50%) rotate(${
                        i * 6
                      }deg) translateY(-120px)`,
                      borderRadius: 1,
                      opacity: i % 5 === 0 ? 0.9 : 0.45,
                    }}
                  />
                ))}

                {/* Numbers */}
                {Array.from({ length: 12 }, (_, i) => (
                  <Typography
                    key={i}
                    sx={{
                      position: "absolute",
                      top: "50%",
                      left: "50%",
                      fontSize: "20px",
                      fontWeight: "bold",
                      color: "#111",
                      transform: `translate(-50%, -50%) rotate(${
                        i * 30
                      }deg) translateY(-95px) rotate(-${i * 30}deg)`,
                    }}
                  >
                    {i === 0 ? 12 : i}
                  </Typography>
                ))}

                {/* Time Out Marker */}
                {timeOutAngle !== null && (
                  <Box
                    sx={{
                      position: "absolute",
                      top: "50%",
                      left: "50%",
                      width: 14,
                      height: 14,
                      bgcolor: "#f44336",
                      border: "3px solid white",
                      borderRadius: "50%",
                      transform: `translate(-50%, -50%) rotate(${timeOutAngle}deg) translateY(-108px)`,
                      boxShadow: "0 0 14px #f44336",
                      animation: timeToGo ? "pulseDot 1.2s infinite" : "none",
                    }}
                  />
                )}

                {/* Hour Hand */}
                <Box
                  ref={hourHandRef}
                  sx={{
                    position: "absolute",
                    bottom: "50%",
                    left: "50%",
                    width: 10,
                    height: 72,
                    backgroundColor: "#222",
                    transformOrigin: "bottom",
                    borderRadius: 2,
                    boxShadow: "0 0 5px rgba(0,0,0,0.4)",
                  }}
                />

                {/* Minute Hand */}
                <Box
                  ref={minuteHandRef}
                  sx={{
                    position: "absolute",
                    bottom: "50%",
                    left: "50%",
                    width: 6,
                    height: 100,
                    backgroundColor: "#000",
                    transformOrigin: "bottom",
                    borderRadius: 2,
                    boxShadow: "0 0 5px rgba(0,0,0,0.4)",
                  }}
                />

                {/* Second Hand */}
                <Box
                  ref={secondHandRef}
                  sx={{
                    position: "absolute",
                    bottom: "50%",
                    left: "50%",
                    width: 2,
                    height: 110,
                    backgroundColor: "#e91e63",
                    transformOrigin: "bottom",
                  }}
                />

                {/* Counterweight */}
                <Box
                  ref={counterWeightRef}
                  sx={{
                    position: "absolute",
                    bottom: "50%",
                    left: "50%",
                    width: 4,
                    height: 32,
                    backgroundColor: "#555",
                    transformOrigin: "bottom",
                    borderRadius: 2,
                  }}
                />

                {/* Center Cap */}
                <Box
                  sx={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    width: 16,
                    height: 16,
                    backgroundColor: "#000",
                    borderRadius: "50%",
                    transform: "translate(-50%, -50%)",
                    boxShadow: "0 0 6px rgba(0,0,0,0.6)",
                  }}
                />
              </Box>
            </Box>

            {/* Digital Clock */}
            <Typography
              variant="h5"
              sx={{
                textAlign: "center",
                fontFamily: "monospace",
                fontWeight: "bold",
                color: timeToGo ? "#f44336" : "text.primary",
              }}
            >
              {clockFormat === "12h" ? now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }) : now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
            </Typography>

            {/* Time In/Out */}
            <Stack direction="row" spacing={2} alignItems="center" mt={2} px={1} pb={2}>
              <Box sx={{ position: "relative", flex: 1 }}>
                <FiLogIn
                  style={{
                    position: "absolute",
                    left: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: timeIn ? "#4caf50" : "#999",
                    fontSize: 18,
                  }}
                />
                <input
                  type="time"
                  step="60"
                  value={timeIn}
                  onChange={handleTimeInChange}
                  style={{
                    width: "100%",
                    padding: "12px 12px 12px 40px",
                    fontSize: "16px",
                    fontFamily: "inherit",
                    borderRadius: 8,
                    border: `2px solid ${timeIn ? "#4caf50" : "#ccc"}`,
                    background: "transparent",
                    color: timeIn ? "#4caf50" : "inherit",
                    fontWeight: "bold",
                  }}
                />
              </Box>
            </Stack>

            {timeOut && (
              <Box sx={{ textAlign: "center", pb: 2 }}>
                <Typography variant="subtitle1" sx={{ color: "#999", fontFamily: "monospace" }}>
                  Time Out
                </Typography>
                <Typography variant="h4" sx={{ fontFamily: "monospace", fontWeight: "bold", color: "#f44336" }}>
                  {format12(timeOut)}
                </Typography>
              </Box>
            )}
          </>
        )}

        {/* ALARM MODE */}
        {displayMode === "alarm" && (
          <Box>
            <Box sx={{ mb: 2, display: "flex", gap: 1 }}>
              <Button startIcon={<FiPlus />} onClick={() => setShowAlarmDialog(true)} variant="contained" size="small">
                Add Alarm
              </Button>
            </Box>

            {alarms.length === 0 ? (
              <Typography sx={{ textAlign: "center", color: "#aaa" }}>No alarms set</Typography>
            ) : (
              <Stack spacing={1}>
                {alarms.map(alarm => (
                  <Box key={alarm.id} sx={{ display: "flex", gap: 1, p: 1, bgcolor: "rgba(0,0,0,0.1)", borderRadius: 1, alignItems: "center" }}>
                    <IconButton size="small" onClick={() => toggleAlarm(alarm.id)}>
                      {alarm.enabled ? <MdAlarm size={18} /> : <MdAlarmOff size={18} />}
                    </IconButton>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body2" sx={{ fontFamily: "monospace", fontWeight: "bold" }}>
                        {alarm.time}
                      </Typography>
                      <Typography variant="caption">{alarm.label}</Typography>
                    </Box>
                    <IconButton size="small" onClick={() => deleteAlarm(alarm.id)}>
                      <FiTrash2 size={16} />
                    </IconButton>
                  </Box>
                ))}
              </Stack>
            )}

            <Dialog open={showAlarmDialog} onClose={() => setShowAlarmDialog(false)}>
              <DialogTitle>Add Alarm</DialogTitle>
              <DialogContent>
                <TextField type="time" value={newAlarmTime} onChange={(e) => setNewAlarmTime(e.target.value)} sx={{ mt: 2, mb: 1 }} fullWidth />
                <TextField label="Label" value={newAlarmLabel} onChange={(e) => setNewAlarmLabel(e.target.value)} fullWidth />
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setShowAlarmDialog(false)}>Cancel</Button>
                <Button onClick={addAlarm} variant="contained">Add</Button>
              </DialogActions>
            </Dialog>
          </Box>
        )}

        {/* TIMER MODE */}
        {displayMode === "timer" && (
          <Box sx={{ textAlign: "center" }}>
            <Typography variant="h3" sx={{ fontFamily: "monospace", fontWeight: "bold", my: 2 }}>
              {formatTimer()}
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mb: 2, justifyContent: "center" }}>
              <TextField type="number" placeholder="Minutes" value={timerInput} onChange={(e) => setTimerInput(e.target.value)} size="small" sx={{ width: 100 }} />
              <Button 
                onClick={() => {
                  const mins = parseInt(timerInput) || 0;
                  setTimerSeconds(mins * 60);
                  setTimerInput("");
                }} 
                variant="contained" 
                size="small"
              >
                Set
              </Button>
            </Stack>
            <Stack direction="row" spacing={1} sx={{ justifyContent: "center" }}>
              <Button startIcon={timerRunning ? <FiPause /> : <FiPlay />} onClick={() => setTimerRunning(!timerRunning)} variant="contained" size="small">
                {timerRunning ? "Pause" : "Start"}
              </Button>
              <Button startIcon={<FiRotateCcw />} onClick={() => { setTimerSeconds(0); setTimerRunning(false); }} variant="outlined" size="small">
                Reset
              </Button>
            </Stack>
          </Box>
        )}

        {/* STOPWATCH MODE */}
        {displayMode === "stopwatch" && (
          <Box sx={{ textAlign: "center" }}>
            <Typography variant="h3" sx={{ fontFamily: "monospace", fontWeight: "bold", my: 2 }}>
              {formatStopwatch()}
            </Typography>
            <Stack direction="row" spacing={1} sx={{ justifyContent: "center" }}>
              <Button startIcon={stopwatchRunning ? <FiPause /> : <FiPlay />} onClick={() => setStopwatchRunning(!stopwatchRunning)} variant="contained" size="small">
                {stopwatchRunning ? "Pause" : "Start"}
              </Button>
              <Button startIcon={<FiRotateCcw />} onClick={() => { setStopwatchMs(0); setStopwatchRunning(false); }} variant="outlined" size="small">
                Reset
              </Button>
            </Stack>
          </Box>
        )}

        {/* WORLD TIME MODE */}
        {displayMode === "worldtime" && (
          <Box>
            <Box sx={{ mb: 2, display: "flex", gap: 1 }}>
              <FormControl size="small" sx={{ flex: 1 }}>
                <Select 
                  value={newTimeZone} 
                  onChange={(e) => setNewTimeZone(e.target.value)}
                  MenuProps={{
                    PaperProps: {
                      sx: {
                        zIndex: 1400,
                      },
                    },
                  }}
                >
                  {commonTimeZones.map(tz => (
                    <MenuItem key={tz} value={tz}>{tz}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Button onClick={addTimeZone} variant="contained" size="small">Add</Button>
            </Box>

            <Stack spacing={1}>
              {worldTimeZones.map(tz => (
                <Box key={tz} sx={{ display: "flex", gap: 1, p: 1, bgcolor: "rgba(0,0,0,0.1)", borderRadius: 1, alignItems: "center", justifyContent: "space-between" }}>
                  <Box>
                    <Typography variant="body2" sx={{ fontFamily: "monospace" }}>{tz}</Typography>
                    <Typography variant="h6" sx={{ fontFamily: "monospace", fontWeight: "bold" }}>{getTimeInZone(tz)}</Typography>
                  </Box>
                  <IconButton size="small" onClick={() => removeTimeZone(tz)}>
                    <FiTrash2 size={16} />
                  </IconButton>
                </Box>
              ))}
            </Stack>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default ClockApp;
