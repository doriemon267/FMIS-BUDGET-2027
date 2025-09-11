const RATA = require('../models/RATA');
exports.getAllRATAs = async (req, res) => {
  try {
    // 1. Extract pagination, sorting, global search & individual filters
    const {
      page = 1,
      limit = 10,
      search,
      orderBy = 'updatedAt',
      order = 'asc',
      SG: SGQuery,
      RATA: rataQuery,
      createdAt,
    } = req.query;
    // 2. Build the Mongo query object
    const query = {};
    // 2a. Global search (exclude date-looking strings)
    if (search && search.split('-').length !== 3) {
      query.$or = [
        { SG:    { $regex: search, $options: 'i' } },
      ];
      const num = Number(search);
      if (!isNaN(num)) query.$or.push({ RATA: num });
    }
    // 2b. Column-specific filters
    if (SGQuery) {
      query.SG = { $regex: SGQuery, $options: 'i' };
    }
    if (rataQuery !== undefined) {
      const num = Number(rataQuery);
      if (!isNaN(num)) query.RATA = num;
      else return res.status(400).json({ error: 'RATA filter must be a number.' });
    }
    if (createdAt) {
      const date = new Date(createdAt);
      if (!isNaN(date)) {
        // match any time within that day
        const next = new Date(date);
        next.setDate(date.getDate() + 1);
        query.createdAt = { $gte: date, $lt: next };
      } else {
        return res.status(400).json({ error: 'createdAt must be YYYY-MM-DD.' });
      }
    }
    // 3. Sorting
    const sortOrder = order.toLowerCase() === 'desc' ? -1 : 1;
    const sortObj = { [orderBy]: sortOrder };
    // 4. Pagination math
    const pageNum  = Math.max(1, Number(page));
    const limitNum = Math.max(1, Number(limit));
    const skip     = (pageNum - 1) * limitNum;
    // 5. Fetch data + count
    const [ratas, totalRecords] = await Promise.all([
      RATA.find(query).skip(skip).limit(limitNum).sort(sortObj),
      RATA.countDocuments(query),
    ]);
    // 6. Return structured response
    return res.status(200).json({
      ratas,
      totalPages: Math.ceil(totalRecords / limitNum),
      currentPage: pageNum,
      totalRecords,
    });
  } catch (error) {
    console.error('getAllRATAs error:', error);
    return res.status(500).json({ error: 'Something went wrong.' });
  }
};
// Get RATA by ID
exports.getRATAById = async (req, res) => {
  try {
    const rata = await RATA.findById(req.params.id);
    if (!rata) {
      return res.status(404).json({ error: 'RATA not found' });
    }
    res.status(200).json(rata);
  } catch (error) {
    res.status(500).json({ error: 'An error occurred while fetching the RATA.' });
  }
};
// Create a new RATA
exports.createRATA = async (req, res) => {
  try {
    // Map either SG or grade, and RATA or amount
    const SG = req.body.SG
      || req.body.sg
      || (req.body.grade !== undefined ? String(req.body.grade) : undefined);
    // Map RA and TA fields
    const RA = req.body.RA !== undefined ? Number(req.body.RA) : undefined;
    const TA = req.body.TA !== undefined ? Number(req.body.TA) : undefined;
    let rataValue = req.body.RATA;
    if (rataValue === undefined) {
      // fallback to lowercase or your form’s "amount"
      rataValue = req.body.rata !== undefined
        ? req.body.rata
        : req.body.amount;
    }
    // Validation
    if (!SG) {
      return res.status(400).json({ error: 'SG (grade) is required.' });
    }
    if (rataValue === undefined) {
      return res.status(400).json({ error: 'RATA (amount) is required.' });
    }
    if (RA === undefined || isNaN(RA)) {
      return res.status(400).json({ error: 'RA (Representation Allowance) is required and must be a number.' });
    }
    if (TA === undefined || isNaN(TA)) {
      return res.status(400).json({ error: 'TA (Transportation Allowance) is required and must be a number.' });
    }
    // Coerce and check number
    const parsedRATA = Number(rataValue);
    if (isNaN(parsedRATA)) {
      return res.status(400).json({ error: 'RATA must be a number.' });
    }
    // Save
    const newRATA = new RATA({ SG, RA, TA, RATA: RA + TA });
    await newRATA.save();
    return res
      .status(201)
      .json({ message: 'RATA created successfully.', rata: newRATA });
  } catch (error) {
    console.error('🛑 createRATA error:', error);
    return res
      .status(500)
      .json({ error: 'Failed to create RATA.', details: error.message });
  }
};
// Update a RATA by ID
exports.updateRATA = async (req, res) => {
  try {
    const updatedRATA = await RATA.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!updatedRATA) {
      return res.status(404).json({ error: 'RATA not found' });
    }
    res.status(200).json(updatedRATA);
  } catch (error) {
    res.status(500).json({ error: 'An error occurred while updating the RATA.' });
  }
};
// Delete a RATA by ID
exports.deleteRATA = async (req, res) => {
  try {
    const deletedRATA = await RATA.findByIdAndDelete(req.params.id);
    if (!deletedRATA) {
      return res.status(404).json({ error: 'RATA not found' });
    }
    res.status(200).json({ message: 'RATA deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'An error occurred while deleting the RATA.' });
  }
};