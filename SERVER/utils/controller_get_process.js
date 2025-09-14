const mongoose = require("mongoose");
exports.searchFilter = (query, search, fields) => {
  if (search) {
    query.$or = fields.map((field) => ({
      [field]: { $regex: search, $options: "i" },
    }));
  }
};
// DATE CONDITIONS
exports.processDate = (dateString) => {
  const parts = dateString.split("-"); // Split "MM-DD-YYYY"
  if (parts.length === 3) {
    const [month, day, year] = parts.map(Number);
    // Check if valid date
    const parsedDate = new Date(year, month - 1, day); // Months are 0-based in JS
    if (!isNaN(parsedDate.getTime())) {
      // Set start and end of the day
      const startOfDay = new Date(
        parsedDate.getFullYear(),
        parsedDate.getMonth(),
        parsedDate.getDate(),
        0,
        0,
        0,
        0
      ); // 00:00:00
      const endOfDay = new Date(
        parsedDate.getFullYear(),
        parsedDate.getMonth(),
        parsedDate.getDate(),
        23,
        59,
        59,
        999
      ); // 23:59:59
      return { $gte: startOfDay, $lte: endOfDay }; // Match full day
    }
  }
  return null;
};
exports.numberFilter = (query, filters, operator) => {
  Object.entries(filters).forEach(([field, value]) => {
    if (value !== undefined && value !== "") {
      // Check if value is a number
      if (!isNaN(Number(value))) {
        const numericValue = Number(value);
        switch (operator) {
          case "<":
            query[field] = { $lt: numericValue };
            break;
          case ">":
            query[field] = { $gt: numericValue };
            break;
          case ">=":
            query[field] = { $gte: numericValue };
            break;
          case "<=":
            query[field] = { $lte: numericValue };
            break;
          default:
            query[field] = numericValue; // Exact match
        }
      } else {
        // Treat non-numeric values as exact matches
        query[field] = value;
      }
    }
  });
};
exports.dateFilter = (query, filters) => {
  Object.entries(filters).forEach(([field, value]) => {
    if (value !== undefined && value !== "" && value !== "undefined")
      query[field] = this.processDate(value);
  });
};
exports.textFilter = (query, filters) => {
  Object.entries(filters).forEach(([field, value]) => {
    if (value && value !== "undefined") {
      query[field] = { $regex: value, $options: "i" }; // Case-insensitive regex
    }
  });
};
exports.booleanFilter = (query, filters) => {
  Object.entries(filters).forEach(([field, value]) => {
    if (value && value !== "undefined") {
      query[field] = value === "true";
    }
  });
};
// UNUSED
exports.objectFilter = async (
  Model1,
  Model2,
  filters,
  relationKey,
  query = {}
) => {
  try {
    // 1️⃣ Convert filter values to case-insensitive regex & remove empty values
    const cleanedFilters = Object.fromEntries(
      Object.entries(filters)
        .filter(([_, value]) => value !== undefined && value !== "")
        .map(([key, value]) => [key, { $regex: value, $options: "i" }])
    );
    // 2️⃣ Ensure filters are valid
    if (Object.keys(cleanedFilters).length === 0) {
      return { success: false, message: "No valid filters provided" };
    }
    // 3️⃣ Find the document in Model1 (e.g., Payor)
    const document = await Model1.findOne(cleanedFilters);
    if (!document) {
      return { success: false, message: `No matching document found` };
    }
    // 4️⃣ Add `payor` condition inside `$or` in the query
    if (!query.$or) {
      query.$or = [];
    }
    query.$or.push({ [relationKey]: document._id });
    // 5️⃣ Fetch results from Model2 (e.g., Billing)
    // const results =
    await Model2.find(query).exec();
    // return {
    //   success: true,
    //   totalResults: results.length,
    //   data: results,
    // };
  } catch (error) {
    // Error in objectFilter
    return { success: false, message: "Server error", error: error.message };
  }
};
