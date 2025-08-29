const express = require("express");
const multer = require("multer");
const xlsx = require("xlsx");
const Category = require("../../models/Category"); // Make sure your Category model exists

const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage });

router.post("/uploadcategories", upload.single("file"), async (req, res) => {
  try {
    const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheetData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

    for (let record of sheetData) {
      if (record._id) {
        const existing = await Category.findById(record._id);
        if (existing) {
          await Category.updateOne({ _id: record._id }, { $set: record });
        } else {
          await Category.create(record);
        }
      } else {
        await Category.create(record);
      }
    }

    res.json({ message: "Categories file processed successfully!" });
  } catch (error) {
    console.error("Error processing categories file:", error);
    res.status(500).json({ error: "Error uploading file" });
  }
});

module.exports = router;
