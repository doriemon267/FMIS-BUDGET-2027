// **Date Filtering**
exports.processDate = (dateString) => {
  const parts = dateString.split("-"); // Expected format: MM-DD-YYYY
  if (parts.length === 3) {
    const [month, day, year] = parts.map(Number);
    const parsedDate = new Date(year, month - 1, day); // JavaScript months are 0-based

    if (!isNaN(parsedDate.getTime())) {
      return {
        $gte: new Date(year, month - 1, day, 0, 0, 0, 0), // Start of the day
        $lte: new Date(year, month - 1, day, 23, 59, 59, 999), // End of the day
      };
    }
  }
  return null;
};
