const express = require("express");
const multer = require("multer");
const xlsx = require("xlsx");
const ChartOfAccount = require("../../models/chartOfAccounts"); // Make sure your ChartOfAccount model exists
const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage });
router.post("/uploadcoa", upload.single("file"), async (req, res) => {
  try {
    const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheetData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
    for (let record of sheetData) {
      if (record._id) {
        const existing = await ChartOfAccount.findById(record._id);
        if (existing) {
          await ChartOfAccount.updateOne({ _id: record._id }, { $set: record });
        } else {
          await ChartOfAccount.create(record);
        }
      } else {
        await ChartOfAccount.create(record);
      }
    }
    res.json({ message: "Chart of Accounts file processed successfully!" });
  } catch (error) {
    console.error("Error processing COA file:", error);
    res.status(500).json({ error: "Error uploading file" });
  }
});
module.exports = router;