const express = require("express");
const multer = require("multer");
const xlsx = require("xlsx");
const Rata = require("../../models/RATA"); // your Rata model

const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage });

router.post("/uploadratas", upload.single("file"), async (req, res) => {
  try {
    const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

    for (let row of rows) {
      // build the payload matching your schema
      const payload = {
        SG: row.grade,    // map CSV “grade” → model “SG”
        RATA: row.amount // map CSV “amount” → model “RATA”
      };

      if (row._id) {
        // update existing
        await Rata.updateOne(
          { _id: row._id },
          { $set: payload }
        );
      } else {
        // create new
        await Rata.create(payload);
      }
    }

    res.json({ message: "RATAs file processed successfully!" });
  } catch (error) {
    console.error("Error processing RATAs file:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
