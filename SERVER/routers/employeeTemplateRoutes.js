const express = require('express');
const router = express.Router();
const isAuth = require("../middleware/is_auth");
const { generateEmployeeTemplate } = require("../utils/employeeTemplateGenerator");

router.get('/', isAuth, async (req, res) => {
  try {
    const userAccess = req.user?.hierarchicalAccess || {};
    const { scope = "REGION", accessibleDepartments = [], accessibleDivisions = [], accessibleSections = [] } = userAccess;
    const region = req.query.region || req.user?.region || "";

    const templateBuffer = generateEmployeeTemplate({
      region, fiscalYear: "", scope, accessibleDepartments, accessibleDivisions, accessibleSections
    });

    const fileName = `employee_import_template_${region || "authenticated"}.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.send(templateBuffer);
  } catch (error) {
    console.error("Error generating template:", error);
    res.status(500).json({ error: "Error generating template", details: error.message });
  }
});

module.exports = router;
