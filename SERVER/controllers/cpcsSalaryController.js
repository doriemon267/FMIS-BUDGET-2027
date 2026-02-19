const path = require("path");
const xlsx = require("xlsx");
const CPCSSalaryTable = require("../models/CPCSSalaryTable");
const CPCSSalarySettings = require("../models/CPCSSalarySettings");

const STEP_KEYS = ["step1", "step2", "step3", "step4", "step5", "step6", "step7", "step8"];

/** Get CPCS salary table rows with search, filter, pagination */
exports.getTable = async (req, res) => {
  try {
    const {
      q = "",
      salaryGrade,
      cpcs1JobGrade,
      cpcs2PayGrade,
      limit = 20,
      offset = 0,
      sortField = "salaryGrade",
      sortDir = "asc",
    } = req.query;

    const filter = {};
    if (q && String(q).trim()) {
      const search = String(q).trim();
      const numSearch = parseInt(search, 10);
      if (!isNaN(numSearch)) {
        filter.$or = [
          { salaryGrade: numSearch },
          { cpcs1JobGrade: numSearch },
          { cpcs2PayGrade: numSearch },
          ...STEP_KEYS.map((k) => ({ [k]: numSearch })),
        ];
      }
    }
    if (salaryGrade != null && salaryGrade !== "") {
      const sg = parseInt(salaryGrade, 10);
      if (!isNaN(sg)) filter.salaryGrade = sg;
    }
    if (cpcs1JobGrade != null && cpcs1JobGrade !== "") {
      const jg = parseInt(cpcs1JobGrade, 10);
      if (!isNaN(jg)) filter.cpcs1JobGrade = jg;
    }
    if (cpcs2PayGrade != null && cpcs2PayGrade !== "") {
      const pg = parseInt(cpcs2PayGrade, 10);
      if (!isNaN(pg)) filter.cpcs2PayGrade = pg;
    }

    const sort = {};
    const allowedSort = ["salaryGrade", "cpcs1JobGrade", "cpcs2PayGrade", "step1", "step8"];
    const field = allowedSort.includes(sortField) ? sortField : "salaryGrade";
    sort[field] = sortDir === "desc" ? -1 : 1;

    const skip = Math.max(0, parseInt(offset, 10) || 0);
    const lim = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

    const [rows, totalRecords] = await Promise.all([
      CPCSSalaryTable.find(filter).sort(sort).skip(skip).limit(lim).lean(),
      CPCSSalaryTable.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(totalRecords / lim);
    const currentPage = Math.floor(skip / lim) + 1;
    res.status(200).json({ rows, totalRecords, totalPages, currentPage });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/** Get one row by id */
exports.getRowById = async (req, res) => {
  try {
    const row = await CPCSSalaryTable.findById(req.params.id).lean();
    if (!row) return res.status(404).json({ error: "Row not found" });
    res.status(200).json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/** Create a table row */
exports.createRow = async (req, res) => {
  try {
    const row = new CPCSSalaryTable(req.body);
    await row.save();
    res.status(201).json(row);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

/** Update a table row */
exports.updateRow = async (req, res) => {
  try {
    const row = await CPCSSalaryTable.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!row) return res.status(404).json({ error: "Row not found" });
    res.status(200).json(row);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

/** Delete a table row */
exports.deleteRow = async (req, res) => {
  try {
    const row = await CPCSSalaryTable.findByIdAndDelete(req.params.id);
    if (!row) return res.status(404).json({ error: "Row not found" });
    res.status(200).json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/** Get settings (single document); create with defaults if missing */
exports.getSettings = async (req, res) => {
  try {
    let settings = await CPCSSalarySettings.findOne().lean();
    if (!settings) {
      const defaultSettings = await CPCSSalarySettings.create({
        useCPCSForEmployeeAdd: false,
        cpcs1AppointmentTypes: ["CASUAL"],
        cpcs2AppointmentTypes: ["PERMANENT"],
        cosUsesCPCSIIRate: true,
        inactiveUsesCPCS1: true,
      });
      settings = defaultSettings.toObject();
    }
    res.status(200).json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/** Update settings */
exports.updateSettings = async (req, res) => {
  try {
    const { useCPCSForEmployeeAdd, cpcs1AppointmentTypes, cpcs2AppointmentTypes, cosUsesCPCSIIRate, inactiveUsesCPCS1 } = req.body;
    const settings = await CPCSSalarySettings.findOneAndUpdate(
      {},
      {
        ...(typeof useCPCSForEmployeeAdd === "boolean" && { useCPCSForEmployeeAdd }),
        ...(Array.isArray(cpcs1AppointmentTypes) && { cpcs1AppointmentTypes }),
        ...(Array.isArray(cpcs2AppointmentTypes) && { cpcs2AppointmentTypes }),
        ...(typeof cosUsesCPCSIIRate === "boolean" && { cosUsesCPCSIIRate }),
        ...(typeof inactiveUsesCPCS1 === "boolean" && { inactiveUsesCPCS1 }),
      },
      { new: true, upsert: true }
    );
    res.status(200).json(settings);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

/** Check if CPCS is used for employee add (for frontend) */
exports.getUseCPCS = async (req, res) => {
  try {
    const settings = await CPCSSalarySettings.findOne().lean();
    res.status(200).json({
      useCPCSForEmployeeAdd: settings ? settings.useCPCSForEmployeeAdd : false,
      cpcs1AppointmentTypes: settings?.cpcs1AppointmentTypes || ["CASUAL"],
      cpcs2AppointmentTypes: settings?.cpcs2AppointmentTypes || ["PERMANENT"],
      cosUsesCPCSIIRate: settings != null ? (settings.cosUsesCPCSIIRate !== false) : true,
      inactiveUsesCPCS1: settings != null ? settings.inactiveUsesCPCS1 : true,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/** Get rate by CPCS: gradeType=cpcs1|cpcs2, grade=number, step=1-8 */
exports.getRateByCPCS = async (req, res) => {
  try {
    const { gradeType, grade, step } = req.query;
    const stepNum = parseInt(step, 10);
    if (!gradeType || !grade || !step || stepNum < 1 || stepNum > 8) {
      return res.status(400).json({ error: "Invalid gradeType, grade, or step (1-8)" });
    }
    const gradeNum = parseInt(grade, 10);
    if (isNaN(gradeNum)) return res.status(400).json({ error: "grade must be a number" });

    const field = gradeType.toLowerCase() === "cpcs1" ? "cpcs1JobGrade" : "cpcs2PayGrade";
    const row = await CPCSSalaryTable.findOne({ [field]: gradeNum }).lean();
    if (!row) return res.status(404).json({ error: `No row found for ${gradeType} grade ${grade}` });

    const stepKey = `step${stepNum}`;
    const rate = row[stepKey];
    if (rate == null) return res.status(404).json({ error: `Rate not found for step ${step}` });
    res.status(200).json({ rate });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/** For PERMANENT: get row by salary_grade (for employee add form - same shape as old salary-grades) */
exports.getGradesBySalaryGrade = async (req, res) => {
  try {
    const salaryGrade = req.query.salary_grade || req.params.salary_grade;
    if (!salaryGrade) return res.status(400).json({ error: "salary_grade required" });
    const sg = parseInt(salaryGrade, 10);
    if (isNaN(sg)) return res.status(400).json({ error: "salary_grade must be a number" });

    const row = await CPCSSalaryTable.findOne({ salaryGrade: sg }).lean();
    if (!row) return res.status(200).json({ grades: [] });

    const steps = STEP_KEYS.map((k) => k.replace("step", ""));
    const rates = {};
    STEP_KEYS.forEach((k, i) => { rates[String(i + 1)] = row[k]; });
    res.status(200).json({
      grades: [{
        salary_grade: String(row.salaryGrade),
        job_grade: String(row.cpcs1JobGrade),
        cpcs2PayGrade: row.cpcs2PayGrade,
        steps,
        rates,
      }],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/** For CASUAL: get rate by job grade (CPCS 1) and step - same API shape as old rate-by-job-grade-and-step */
exports.getRateByJobGradeAndStep = async (req, res) => {
  try {
    const { job_grade, step } = req.params;
    const jg = parseInt(String(job_grade).replace(/^JG-?/i, ""), 10);
    const stepNum = parseInt(step, 10);
    if (isNaN(jg) || stepNum < 1 || stepNum > 8) {
      return res.status(400).json({ error: "Invalid job_grade or step (1-8)" });
    }

    const row = await CPCSSalaryTable.findOne({ cpcs1JobGrade: jg }).lean();
    if (!row) return res.status(404).json({ error: `Job grade ${jg} not found` });

    const stepKey = `step${stepNum}`;
    const rate = row[stepKey];
    if (rate == null) return res.status(404).json({ error: `Rate not found for step ${step}` });
    res.status(200).json({ rate });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/** Seed initial table from CPCS II Rate.xlsx - exact values; only if collection is empty */
exports.seedTable = async (req, res) => {
  try {
    const count = await CPCSSalaryTable.countDocuments();
    if (count > 0) {
      return res.status(400).json({ error: "Table already has data. Clear first to seed." });
    }
    // Exact values from CPCS II Rate.xlsx (uploads/CPCS II Rate.xlsx)
    const seed = [
      { salaryGrade: 1, cpcs1JobGrade: 2, cpcs2PayGrade: 1, step1: 15208, step2: 15304, step3: 15423, step4: 15542, step5: 15663, step6: 15784, step7: 15906, step8: 16030 },
      { salaryGrade: 2, cpcs1JobGrade: 3, cpcs2PayGrade: 2, step1: 16118, step2: 16233, step3: 16349, step4: 16466, step5: 16582, step6: 16700, step7: 16820, step8: 16939 },
      { salaryGrade: 3, cpcs1JobGrade: 4, cpcs2PayGrade: 3, step1: 17120, step2: 17244, step3: 17366, step4: 17490, step5: 17616, step6: 17740, step7: 17868, step8: 17994 },
      { salaryGrade: 4, cpcs1JobGrade: 5, cpcs2PayGrade: 4, step1: 18180, step2: 18309, step3: 18440, step4: 18571, step5: 18704, step6: 18836, step7: 18971, step8: 19106 },
      { salaryGrade: 5, cpcs1JobGrade: 5, cpcs2PayGrade: 5, step1: 19296, step2: 19434, step3: 19573, step4: 19712, step5: 19852, step6: 19994, step7: 20137, step8: 20280 },
      { salaryGrade: 6, cpcs1JobGrade: 5, cpcs2PayGrade: 6, step1: 20474, step2: 20620, step3: 20767, step4: 20916, step5: 21065, step6: 21215, step7: 21367, step8: 21520 },
      { salaryGrade: 7, cpcs1JobGrade: 5, cpcs2PayGrade: 7, step1: 21872, step2: 22034, step3: 22196, step4: 22362, step5: 22526, step6: 22693, step7: 22860, step8: 23030 },
      { salaryGrade: 8, cpcs1JobGrade: 6, cpcs2PayGrade: 8, step1: 23399, step2: 23603, step3: 23808, step4: 24014, step5: 24221, step6: 24432, step7: 24644, step8: 24859 },
      { salaryGrade: 9, cpcs1JobGrade: 7, cpcs2PayGrade: 9, step1: 25433, step2: 25627, step3: 25823, step4: 26021, step5: 26220, step6: 26421, step7: 26624, step8: 26828 },
      { salaryGrade: 10, cpcs1JobGrade: 7, cpcs2PayGrade: 10, step1: 28247, step2: 28462, step3: 28678, step4: 28896, step5: 29116, step6: 29337, step7: 29561, step8: 29787 },
      { salaryGrade: 11, cpcs1JobGrade: 8, cpcs2PayGrade: 11, step1: 33387, step2: 33501, step3: 33790, step4: 34082, step5: 34378, step6: 34679, step7: 34983, step8: 35292 },
      { salaryGrade: 12, cpcs1JobGrade: 8, cpcs2PayGrade: 12, step1: 35650, step2: 35771, step3: 36059, step4: 36350, step5: 36645, step6: 36944, step7: 37246, step8: 37552 },
      { salaryGrade: 13, cpcs1JobGrade: 9, cpcs2PayGrade: 13, step1: 37828, step2: 37987, step3: 38303, step4: 38623, step5: 38948, step6: 39276, step7: 39608, step8: 39945 },
      { salaryGrade: 14, cpcs1JobGrade: 9, cpcs2PayGrade: 14, step1: 40505, step2: 40882, step3: 41263, step4: 41650, step5: 42040, step6: 42436, step7: 42837, step8: 43243 },
      { salaryGrade: 15, cpcs1JobGrade: 10, cpcs2PayGrade: 15, step1: 44148, step2: 44564, step3: 44985, step4: 45412, step5: 45844, step6: 46281, step7: 46723, step8: 47172 },
      { salaryGrade: 16, cpcs1JobGrade: 10, cpcs2PayGrade: 16, step1: 47829, step2: 48286, step3: 48750, step4: 49219, step5: 49694, step6: 50175, step7: 50662, step8: 51154 },
      { salaryGrade: 17, cpcs1JobGrade: 10, cpcs2PayGrade: 17, step1: 51877, step2: 52381, step3: 52891, step4: 53407, step5: 53929, step6: 54459, step7: 54993, step8: 55536 },
      { salaryGrade: 18, cpcs1JobGrade: 11, cpcs2PayGrade: 18, step1: 56332, step2: 56885, step3: 57447, step4: 58013, step5: 58589, step6: 59171, step7: 59760, step8: 60356 },
      { salaryGrade: 19, cpcs1JobGrade: 11, cpcs2PayGrade: 19, step1: 61916, step2: 62729, step3: 63556, step4: 64395, step5: 65249, step6: 66116, step7: 66999, step8: 67895 },
      { salaryGrade: 20, cpcs1JobGrade: 11, cpcs2PayGrade: 20, step1: 76594, step2: 77628, step3: 78679, step4: 79747, step5: 80833, step6: 81936, step7: 82982, step8: 84121 },
      { salaryGrade: 21, cpcs1JobGrade: 12, cpcs2PayGrade: 20, step1: 76594, step2: 77628, step3: 78679, step4: 79747, step5: 80833, step6: 81936, step7: 82982, step8: 84121 },
      { salaryGrade: 22, cpcs1JobGrade: 12, cpcs2PayGrade: 21, step1: 95296, step2: 96612, step3: 97952, step4: 99320, step5: 100814, step6: 102331, step7: 103873, step8: 105308 },
      { salaryGrade: 23, cpcs1JobGrade: 12, cpcs2PayGrade: 21, step1: 95296, step2: 96612, step3: 97952, step4: 99320, step5: 100814, step6: 102331, step7: 103873, step8: 105308 },
      { salaryGrade: 24, cpcs1JobGrade: 13, cpcs2PayGrade: 22, step1: 107022, step2: 108627, step3: 110260, step4: 111918, step5: 113603, step6: 115317, step7: 116952, step8: 118719 },
      { salaryGrade: 25, cpcs1JobGrade: 14, cpcs2PayGrade: 23, step1: 121559, step2: 123385, step3: 125242, step4: 127128, step5: 129047, step6: 130995, step7: 132977, step8: 134989 },
      { salaryGrade: 26, cpcs1JobGrade: 14, cpcs2PayGrade: 24, step1: 155217, step2: 157550, step3: 159921, step4: 162184, step5: 164630, step6: 166512, step7: 169030, step8: 171587 },
      { salaryGrade: 27, cpcs1JobGrade: 15, cpcs2PayGrade: 25, step1: 173788, step2: 176411, step3: 179077, step4: 181457, step5: 184205, step6: 186999, step7: 189319, step8: 192196 },
      { salaryGrade: 28, cpcs1JobGrade: 16, cpcs2PayGrade: 26, step1: 194570, step2: 197521, step3: 200519, step4: 203567, step5: 206663, step6: 209044, step7: 212230, step8: 215469 },
      { salaryGrade: 29, cpcs1JobGrade: 17, cpcs2PayGrade: 27, step1: 218237, step2: 221556, step3: 224726, step4: 227943, step5: 231209, step6: 234743, step7: 238113, step8: 241758 },
      { salaryGrade: 30, cpcs1JobGrade: 18, cpcs2PayGrade: 28, step1: 308730, step2: 314460, step3: 320302, step4: 325952, step5: 331707, step6: 337758, step7: 343862, step8: 350080 },
    ];
    await CPCSSalaryTable.insertMany(seed);
    res.status(201).json({ message: "Table seeded with 30 rows from CPCS II Rate.xlsx", count: seed.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/** Seed from CPCS II Rate.xlsx file (Permanent & Casual). Replaces existing data. */
exports.seedFromExcel = async (req, res) => {
  try {
    const excelPath = path.join(__dirname, "../uploads/CPCS II Rate.xlsx");
    const fs = require("fs");
    if (!fs.existsSync(excelPath)) {
      return res.status(404).json({ error: "CPCS II Rate.xlsx not found in uploads folder." });
    }
    const workbook = xlsx.readFile(excelPath);
    const sheetName = workbook.SheetNames[0];
    const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: null });

    if (!rows || rows.length === 0) {
      return res.status(400).json({ error: "Excel file is empty or has no data." });
    }

    const toNum = (v) => (v != null && v !== "" ? parseInt(String(v).replace(/,/g, ""), 10) : null);
    const docs = [];
    for (const r of rows) {
      const sg = toNum(r["SALARY GRADE"] ?? r.SalaryGrade ?? r.salaryGrade ?? r.SG);
      const jg1 = toNum(r["CPCS 1 Job Grade"] ?? r["CPCS 1"] ?? r.cpcs1JobGrade);
      const jg2 = toNum(r["CPCS 2\r\nPay Grade"] ?? r["CPCS 2 Pay Grade"] ?? r["CPCS 2"] ?? r.cpcs2PayGrade);
      if (sg == null) continue;
      const s1 = toNum(r["Category 1"] ?? r["Step 1"] ?? r.step1);
      const s2 = toNum(r.__EMPTY ?? r["Step 2"] ?? r.step2);
      const s3 = toNum(r.__EMPTY_1 ?? r["Step 3"] ?? r.step3);
      const s4 = toNum(r.__EMPTY_2 ?? r["Step 4"] ?? r.step4);
      const s5 = toNum(r.__EMPTY_3 ?? r["Step 5"] ?? r.step5);
      const s6 = toNum(r.__EMPTY_4 ?? r["Step 6"] ?? r.step6);
      const s7 = toNum(r.__EMPTY_5 ?? r["Step 7"] ?? r.step7);
      const s8 = toNum(r.__EMPTY_6 ?? r["Step 8"] ?? r.step8);
      if (s1 == null && s2 == null) continue;
      docs.push({
        salaryGrade: sg,
        cpcs1JobGrade: jg1 ?? sg,
        cpcs2PayGrade: jg2 ?? sg,
        step1: s1 ?? 0, step2: s2 ?? 0, step3: s3 ?? 0, step4: s4 ?? 0,
        step5: s5 ?? 0, step6: s6 ?? 0, step7: s7 ?? 0, step8: s8 ?? 0,
      });
    }
    if (docs.length === 0) {
      return res.status(400).json({ error: "No valid rows found. Check Excel column names (Salary Grade, CPCS 1, CPCS 2, Step 1-8)." });
    }
    await CPCSSalaryTable.deleteMany({});
    await CPCSSalaryTable.insertMany(docs);
    res.status(201).json({ message: `Seeded ${docs.length} rows from CPCS II Rate.xlsx`, count: docs.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
