import { useState, useEffect, useRef } from "react";
import { Box, Typography, Stack } from "@mui/material";
import { FiLogIn } from "react-icons/fi";

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

  // Load saved Time-In
  useEffect(() => {
    const saved = localStorage.getItem("clockTimeIn");
    if (saved) setTimeIn(saved);
  }, []);

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
      {/* Main Container - NO border radius */}
      <Box
        sx={{
          bgcolor: "background.paper",
          boxShadow: 6,
          width: 300,
          mx: "auto",
        }}
      >
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
          {now.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: true,
          })}
        </Typography>

        {/* Time In Input (Only One!) */}
        <Stack
          direction="row"
          spacing={2}
          alignItems="center"
          mt={2}
          px={3}
          pb={2}
        >
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

        {/* Time Out Display (Read-only) */}
        {timeOut && (
          <Box sx={{ textAlign: "center", pb: 2 }}>
            <Typography
              variant="subtitle1"
              sx={{ color: "#999", fontFamily: "monospace" }}
            >
              Time Out
            </Typography>
            <Typography
              variant="h4"
              sx={{
                fontFamily: "monospace",
                fontWeight: "bold",
                color: "#f44336",
              }}
            >
              {format12(timeOut)}
            </Typography>
          </Box>
        )}

        {/* Info */}
        <Box
          sx={{
            textAlign: "center",
            pb: 2,
            fontSize: "12px",
            color: "text.secondary",
          }}
        >
          {new Date().getDay() === 1 && (
            <div>Max Time-In: 7:45 AM (Flag Ceremony)</div>
          )}
          {[2, 3, 4, 5].includes(new Date().getDay()) && (
            <div>Max Time-In: 9:00 AM</div>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default ClockApp;
