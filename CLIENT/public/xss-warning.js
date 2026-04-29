(function selfXSSWarning() {
  console.log(
    '%cStop!',
    'color: #f00; font-family: system-ui, sans-serif; font-size: 80px; font-weight: bold; -webkit-text-stroke: 1px #000;'
  );
  console.log(
    '%cIto ay feature ng browser para sa mga developer. Kung may nagsabi sa iyo na mag-paste ng kahit anong code dito para ma-enable ang isang feature ng FMIS o ma-"hack" ang isang account — SCAM iyon. Mabibigyan nila ng access ang iyong FMIS account.',
    'font-family: system-ui, sans-serif; font-size: 24px; font-weight: 500;'
  );
  console.log(
    '%cSee https://budget.nia.gov.ph/stop for more information.',
    'font-family: system-ui, sans-serif; font-size: 24px;'
  );
})();