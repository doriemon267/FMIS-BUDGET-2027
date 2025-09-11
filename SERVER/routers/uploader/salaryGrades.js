const express = require("express");
const multer = require("multer");
const xlsx = require("xlsx");
const SalaryGrade = require("../../models/SalarySelection"); // your SalaryGrade model
const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage });
router.post("/uploadgrades", upload.single("file"), async (req, res) => {
  try {
    const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
    for (let row of rows) {
      // Build the steps array as before
      const stepsArr = Array.from({ length: 8 }, (_, i) => row[`steps[${i}]`]);
      // Build a plain object for rates so Mongoose can cast it into a Map
      const ratesMap = {};
      for (let i = 1; i <= 8; i++) {
        const val = row[`rates.${i}`];
        if (val != null) {
          ratesMap[i] = val;
        }
      }
      const payload = {
        salary_grade: row.salary_grade,
        job_grade: row.job_grade,
        steps: stepsArr,
        rates: ratesMap,   // <-- now an object, not an array
      };
      // Upsert by salary_grade (no more casting _id)
      const existing = await SalaryGrade.findOne({ salary_grade: row.salary_grade });
      if (existing) {
        await SalaryGrade.updateOne(
          { _id: existing._id },
          { $set: payload }
        );
      } else {
        await SalaryGrade.create(payload);
      }
    }
    res.json({ message: "Salary Grades file processed successfully!" });
  } catch (error) {
    console.error("Error processing salary grades file:", error);
    res.status(500).json({ error: error.message });
  }
});
module.exports = router;