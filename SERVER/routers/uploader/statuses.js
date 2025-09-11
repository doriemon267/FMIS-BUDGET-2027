const express = require("express");
const multer = require("multer");
const xlsx = require("xlsx");
const StatusOfAppointment = require("../../models/Status"); // your model
const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage });
router.post("/uploadstatus", upload.single("file"), async (req, res) => {
  try {
    const workbook   = xlsx.read(req.file.buffer, { type: "buffer" });
    const sheetName  = workbook.SheetNames[0];
    const rows       = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
    for (let row of rows) {
      // Build payload matching your schema
      const payload = {
        Status: row.StatusOfAppointment  // map CSV → schema
      };
      // Upsert by Status
      const existing = await StatusOfAppointment.findOne({ Status: payload.Status });
      if (existing) {
        await StatusOfAppointment.updateOne(
          { _id: existing._id },
          { $set: payload }
        );
      } else {
        await StatusOfAppointment.create(payload);
      }
    }
    res.json({ message: "Statuses file processed successfully!" });
  } catch (error) {
    console.error("Error processing statuses file:", error);
    res.status(500).json({ error: error.message });
  }
});
module.exports = router;