const express = require("express");
const multer = require("multer");
const xlsx = require("xlsx");
const PositionTitle = require("../../models/PositionTitle"); // Make sure your PositionTitle model exists
const isAuth = require("../../middleware/is_auth");
const requireDynamicPermission = require("../../middleware/requireDynamicPermission");
const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage });
router.post(
  "/uploadpositiontitles",
  isAuth,
  requireDynamicPermission("/position-titles"),
  upload.single("file"),
  async (req, res) => {
    try {
      const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      const sheetData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
      for (const record of sheetData) {
        if (record._id) {
          const existing = await PositionTitle.findById(record._id);
          if (existing) {
            await PositionTitle.updateOne({ _id: record._id }, { $set: record });
          } else {
            await PositionTitle.create(record);
          }
        } else {
          await PositionTitle.create(record);
        }
      }
      res.json({ message: "Position Titles file processed successfully!" });
    } catch (error) {
      console.error("Error processing position titles file:", error);
      res.status(500).json({ error: "Error uploading file" });
    }
  }
);
module.exports = router;
