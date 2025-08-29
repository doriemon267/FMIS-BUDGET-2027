const Settings = require("../models/Settings");

const checkDueDate = async (req, res, next) => {
  try {
    const activeSettings = await Settings.findOne({ isActive: true });

    if (!activeSettings) {
      return res.status(400).json({ message: "No active fiscal year found." });
    }

    const now = new Date();
    const dueDate = new Date(activeSettings.dueDate);

    if (now > dueDate) {
      return res.status(403).json({
        message: `Submissions are closed. Deadline was ${dueDate.toLocaleDateString("en-PH")}.`,
      });
    }

    next();
  } catch (error) {
    res.status(500).json({ message: "Due date check failed", error });
  }
};

module.exports = checkDueDate;
