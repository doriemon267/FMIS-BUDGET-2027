const Settings = require("../models/Settings");
const checkDueDateWithRoleBypass = async (req, res, next) => {
  try {
    // Check if user has admin privileges
    const userRoles = req.user?.Roles || [];
    const isAdmin = userRoles.some((roleRaw) => {
      const role = typeof roleRaw === 'string' ? roleRaw.toUpperCase().replace(/_/g, ' ') : '';
      return (
        role.includes('ADMIN') ||
        role.includes('SUPER') ||
        role.includes('BUDGET ADMIN') ||
        role.includes('BUDGET ANALYST')
      );
    });
    // If user is admin, bypass due date check
    if (isAdmin) {
      return next();
    }
    // For non-admin users, perform the standard due date check
    const activeSettings = await Settings.findOne({ isActive: true });
    if (!activeSettings) {
      return res.status(400).json({ message: "No active fiscal year found." });
    }
    const now = new Date();
    const dueDate = new Date(activeSettings.dueDate);
    if (now > dueDate) {
      return res.status(403).json({
        message: `Submissions are closed. Deadline was ${dueDate.toLocaleDateString("en-PH")}. Contact your administrator if you need to make changes after the deadline.`,
      });
    }
    next();
  } catch (error) {
    console.error("Due date check failed:", error);
    res.status(500).json({ message: "Due date check failed", error: error.message });
  }
};
module.exports = checkDueDateWithRoleBypass;