const express = require("express");
const multer = require("multer");
const xlsx = require("xlsx");
const Region = require("../../models/Region"); // Make sure your Region model exists
const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage });
router.post("/uploadregions", upload.single("file"), async (req, res) => {
  try {
    const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheetData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
    for (let record of sheetData) {
      if (record._id) {
        const existing = await Region.findById(record._id);
        if (existing) {
          await Region.updateOne({ _id: record._id }, { $set: record });
        } else {
          await Region.create(record);
        }
      } else {
        await Region.create(record);
      }
    }
    res.json({ message: "Regions file processed successfully!" });
  } catch (error) {
    console.error("Error processing regions file:", error);
    res.status(500).json({ error: "Error uploading file" });
  }
});
module.exports = router;