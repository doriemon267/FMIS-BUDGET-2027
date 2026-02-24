const FourthTrancheCosTable = require("../models/FourthTrancheCosTable");

/** Get rate by Salary Grade and Step (for COS auto-compute from cos-salary-table) */
exports.getRateBySalaryGradeAndStep = async (req, res) => {
  try {
    const { salaryGrade, step } = req.params;
    const sg = parseInt(salaryGrade, 10);
    const stepNum = parseInt(step, 10);
    if (isNaN(sg) || sg < 1 || sg > 33 || isNaN(stepNum) || stepNum < 1 || stepNum > 8) {
      return res.status(400).json({ error: "Invalid salary grade (1-33) or step (1-8)" });
    }
    const row = await FourthTrancheCosTable.findOne({ salaryGrade: sg }).lean();
    if (!row) return res.status(404).json({ error: `Salary grade ${sg} not found in COS table` });
    const stepKey = `step${stepNum}`;
    const rate = row[stepKey];
    if (rate == null) return res.status(404).json({ error: `Rate not found for SG ${sg} Step ${stepNum}` });
    res.json({ rate, salaryGrade: sg, step: stepNum });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/** Get Fourth-Tranche COS table rows (from PDF) */
exports.getTable = async (req, res) => {
  try {
    const { q = "", salaryGrade, limit = 50, offset = 0, sortField = "salaryGrade", sortDir = "asc" } = req.query;
    const filter = {};
    if (q && String(q).trim()) {
      const num = parseInt(String(q).trim(), 10);
      if (!isNaN(num)) filter.$or = [{ salaryGrade: num }, { step1: num }, { step2: num }];
    }
    if (salaryGrade != null && salaryGrade !== "") {
      const sg = parseInt(salaryGrade, 10);
      if (!isNaN(sg)) filter.salaryGrade = sg;
    }
    const sort = { [sortField]: sortDir === "desc" ? -1 : 1 };
    const skip = Math.max(0, parseInt(offset, 10) || 0);
    const lim = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));

    const [rows, totalRecords] = await Promise.all([
      FourthTrancheCosTable.find(filter).sort(sort).skip(skip).limit(lim).lean(),
      FourthTrancheCosTable.countDocuments(filter),
    ]);
    res.status(200).json({ rows, totalRecords });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/** Update a COS table row (amounts only) */
exports.updateRow = async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body;
    const update = {};
    const stepKeys = ["step1", "step2", "step3", "step4", "step5", "step6", "step7", "step8"];
    for (const key of stepKeys) {
      if (body[key] !== undefined) {
        const val = body[key] === "" || body[key] == null ? null : parseInt(String(body[key]).replace(/,/g, ""), 10);
        update[key] = isNaN(val) ? null : val;
      }
    }
    if (Object.keys(update).length === 0) {
      return res.status(400).json({ error: "No valid step amounts to update" });
    }
    const row = await FourthTrancheCosTable.findByIdAndUpdate(id, { $set: update }, { new: true, runValidators: true });
    if (!row) return res.status(404).json({ error: "Row not found" });
    res.status(200).json(row);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

/** Seed Fourth-Tranche table from PDF (officialgazette.gov.ph) */
exports.seedTable = async (req, res) => {
  try {
    const count = await FourthTrancheCosTable.countDocuments();
    if (count > 0) {
      return res.status(400).json({ error: "Table already has data. Clear first to seed." });
    }
    const seed = [
      { salaryGrade: 1, step1: 11068, step2: 11160, step3: 11254, step4: 11348, step5: 11443, step6: 11538, step7: 11635, step8: 11732 },
      { salaryGrade: 2, step1: 11761, step2: 11851, step3: 11942, step4: 12034, step5: 12126, step6: 12219, step7: 12313, step8: 12407 },
      { salaryGrade: 3, step1: 12466, step2: 12562, step3: 12658, step4: 12756, step5: 12854, step6: 12952, step7: 13052, step8: 13152 },
      { salaryGrade: 4, step1: 13214, step2: 13316, step3: 13418, step4: 13521, step5: 13625, step6: 13729, step7: 13835, step8: 13941 },
      { salaryGrade: 5, step1: 14007, step2: 14115, step3: 14223, step4: 14332, step5: 14442, step6: 14553, step7: 14665, step8: 14777 },
      { salaryGrade: 6, step1: 14847, step2: 14961, step3: 15076, step4: 15192, step5: 15309, step6: 15426, step7: 15545, step8: 15664 },
      { salaryGrade: 7, step1: 15738, step2: 15859, step3: 15981, step4: 16104, step5: 16227, step6: 16352, step7: 16477, step8: 16604 },
      { salaryGrade: 8, step1: 16758, step2: 16910, step3: 17063, step4: 17217, step5: 17372, step6: 17529, step7: 17688, step8: 17848 },
      { salaryGrade: 9, step1: 17975, step2: 18125, step3: 18277, step4: 18430, step5: 18584, step6: 18739, step7: 18896, step8: 19054 },
      { salaryGrade: 10, step1: 19233, step2: 19394, step3: 19556, step4: 19720, step5: 19884, step6: 20051, step7: 20218, step8: 20387 },
      { salaryGrade: 11, step1: 20754, step2: 21038, step3: 21327, step4: 21619, step5: 21915, step6: 22216, step7: 22520, step8: 22829 },
      { salaryGrade: 12, step1: 22938, step2: 23222, step3: 23510, step4: 23801, step5: 24096, step6: 24395, step7: 24697, step8: 25003 },
      { salaryGrade: 13, step1: 25232, step2: 25545, step3: 25861, step4: 26181, step5: 26506, step6: 26834, step7: 27166, step8: 27503 },
      { salaryGrade: 14, step1: 27755, step2: 28099, step3: 28447, step4: 28800, step5: 29156, step6: 29517, step7: 29883, step8: 30253 },
      { salaryGrade: 15, step1: 30531, step2: 30909, step3: 31292, step4: 31680, step5: 32072, step6: 32469, step7: 32871, step8: 33279 },
      { salaryGrade: 16, step1: 33584, step2: 34000, step3: 34421, step4: 34847, step5: 35279, step6: 35716, step7: 36159, step8: 36606 },
      { salaryGrade: 17, step1: 36942, step2: 37400, step3: 37863, step4: 38332, step5: 38807, step6: 39288, step7: 39774, step8: 40267 },
      { salaryGrade: 18, step1: 40637, step2: 41140, step3: 41650, step4: 42165, step5: 42688, step6: 43217, step7: 43752, step8: 44294 },
      { salaryGrade: 19, step1: 45269, step2: 46008, step3: 46759, step4: 47522, step5: 48298, step6: 49086, step7: 49888, step8: 50702 },
      { salaryGrade: 20, step1: 51155, step2: 51989, step3: 52838, step4: 53700, step5: 54577, step6: 55468, step7: 56373, step8: 57293 },
      { salaryGrade: 21, step1: 57805, step2: 58748, step3: 59707, step4: 60681, step5: 61672, step6: 62678, step7: 63701, step8: 64741 },
      { salaryGrade: 22, step1: 65319, step2: 66385, step3: 67469, step4: 68570, step5: 69689, step6: 70827, step7: 71983, step8: 73157 },
      { salaryGrade: 23, step1: 73811, step2: 75015, step3: 76240, step4: 77484, step5: 78749, step6: 80034, step7: 81340, step8: 82668 },
      { salaryGrade: 24, step1: 83406, step2: 84767, step3: 86151, step4: 87557, step5: 88986, step6: 90439, step7: 91915, step8: 93415 },
      { salaryGrade: 25, step1: 95083, step2: 96635, step3: 98212, step4: 99815, step5: 101444, step6: 103100, step7: 104783, step8: 106493 },
      { salaryGrade: 26, step1: 107444, step2: 109197, step3: 110980, step4: 112791, step5: 114632, step6: 116503, step7: 118404, step8: 120337 },
      { salaryGrade: 27, step1: 121411, step2: 123393, step3: 125407, step4: 127454, step5: 129534, step6: 131648, step7: 133797, step8: 135981 },
      { salaryGrade: 28, step1: 137195, step2: 139434, step3: 141710, step4: 144023, step5: 146373, step6: 148763, step7: 151191, step8: 153658 },
      { salaryGrade: 29, step1: 155030, step2: 157561, step3: 160132, step4: 162746, step5: 165402, step6: 168102, step7: 170845, step8: 173634 },
      { salaryGrade: 30, step1: 175184, step2: 178043, step3: 180949, step4: 183903, step5: 186904, step6: 189955, step7: 193055, step8: 196206 },
      { salaryGrade: 31, step1: 257809, step2: 262844, step3: 267978, step4: 273212, step5: 278549, step6: 283989, step7: 289536, step8: 295191 },
      { salaryGrade: 32, step1: 307365, step2: 313564, step3: 319887, step4: 326338, step5: 332919, step6: 339633, step7: 346483, step8: 353470 },
      { salaryGrade: 33, step1: 388096, step2: 399739, step3: null, step4: null, step5: null, step6: null, step7: null, step8: null },
    ];
    await FourthTrancheCosTable.insertMany(seed);
    res.status(201).json({ message: "Fourth-Tranche COS table seeded from PDF (Jan 1 2019)", count: seed.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
