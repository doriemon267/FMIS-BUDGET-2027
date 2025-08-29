const express = require("express");
const multer = require("multer");
const xlsx = require("xlsx");
const Department = require("../../models/Department"); // Make sure your Department model exists

const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage });

router.post("/uploaddepartments", upload.single("file"), async (req, res) => {
  try {
    const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheetData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

    for (let record of sheetData) {
      if (record._id) {
        const existing = await Department.findById(record._id);
        if (existing) {
          await Department.updateOne({ _id: record._id }, { $set: record });
        } else {
          await Department.create(record);
        }
      } else {
        await Department.create(record);
      }
    }

    res.json({ message: "Departments file processed successfully!" });
  } catch (error) {
    console.error("Error processing departments file:", error);
    res.status(500).json({ error: "Error uploading file" });
  }
});

module.exports = router;
