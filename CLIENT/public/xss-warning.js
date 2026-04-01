// Self-XSS Protection Warning
// Runs before any module code so it cannot be silenced by silenceConsole.js
(function selfXSSWarning() {
  console.log(
    '%c STOP! ',
    'background:#e00;color:#fff;font-size:48px;font-weight:bold;padding:4px 8px;border-radius:4px;'
  );
  console.log(
    '%cIto ay feature ng browser para sa mga developer.',
    'color:#000;font-size:14px;'
  );
  console.warn(
    '%cKung may nagsabi sa iyo na mag-paste ng kahit anong code dito\n' +
    'para ma-enable ang isang feature ng FMIS o ma-"hack" ang isang account \u2014\n' +
    'SCAM iyon. Mabibigyan nila ng access ang iyong FMIS account.',
    'color:#c00;font-size:13px;'
  );
})();
