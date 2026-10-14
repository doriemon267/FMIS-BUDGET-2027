const AssignedRole = require("../models/AssignedRole");
const Role = require("../models/role");
const { textFilter, searchFilter } = require("../utils/controller_get_process");

exports.getAllRoles = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      orderBy,
      order = "asc",
      name,
      label,
      enabled,
      permission,
    } = req.query;

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.max(1, Number(limit));
    const skip = (pageNum - 1) * limitNum;

    // Base query, excluding SUPER ADMIN
    let query = {
      name: { $ne: "SUPER ADMIN" },
    };

    // **Global Search**
    if (search) {
      searchFilter(query, search, ["name", "label", "permission"]);
    }

    // **Field-based filters**
    textFilter(query, {
      name,
      label,
      permission,
    });

    if (enabled !== undefined) {
      query.enabled = enabled === "true";
    }

    // **Sorting**
    const sortByField = orderBy || "createdAt";
    const sortOrder = order.toLowerCase() === "desc" ? -1 : 1;
    const sortQuery = { [sortByField]: sortOrder };

    // **Fetch paginated, filtered, and sorted data**
    const roles = await Role.find(query)
      .skip(skip)
      .limit(limitNum)
      .sort(sortQuery);

    const totalRecords = await Role.countDocuments(query);

    return res.json({
      roles,
      totalPages: Math.ceil(totalRecords / limitNum),
      currentPage: pageNum,
      totalRecords,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Something went wrong." });
  }
};

exports.saveRole = async (req, res) => {
  try {
    const { name } = req.body;

    // Check if a role with the same name already exists
    const existingRole = await Role.findOne({ name });
    if (existingRole) {
      return res.status(400).json({
        error: "A role with this name already exists.",
        field: "name",
      });
    }

    const role = new Role(req.body);
    await role.save();

    return res.status(201).json({
      message: { msg: "Successfully added a new role." },
      role,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Something went wrong." });
  }
};

exports.updateRole = async (req, res) => {
  const { id } = req.params;
  const { name, label, permission, enabled } = req.body;

  try {
    const updatedRole = await Role.findByIdAndUpdate(
      id,
      { name, label, permission, enabled },
      { new: true },
    );

    if (!updatedRole) {
      return res.status(404).json({ error: "Role not found." });
    }

    return res.status(200).json({
      message: "Successfully updated.",
      role: updatedRole,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Something went wrong." });
  }
};

exports.assignRole = async (req, res) => {
  const { assignedBy, user, fullName, roles } = req.body;

  if (!user || !roles || roles.length === 0) {
    return res.status(400).json({ error: "User and roles are required" });
  }

  try {
    const assigned = await AssignedRole
      .findOneAndUpdate(
        { user },
        {
          assignedBy,
          user,
          fullName,
          roles,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
      .populate("roles");

    res.json(assigned);
  } catch (err) {
    if (err.code === 11000) {
      return res
        .status(400)
        .json({ error: "Role already assigned to this user" });
    }
    res.status(500).json({ error: err.message });
  }
};

// ... existing imports & code ...
exports.getAllAssignedRoles = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      orderBy,
      order = "asc",
      user,
      fullName,
      assignedBy, // new filter
    } = req.query;

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.max(1, Number(limit));
    const skip = (pageNum - 1) * limitNum;

    // === 1. Get current user from token ===
    const currentUser = req.user;
    const currentUserId = currentUser?.particularID;

    if (!currentUserId) {
      return res
        .status(401)
        .json({ error: "Unauthorized: User not identified" });
    }

    // === 2. Check if current user is Super Admin ===
    const currentUserAssignment = await AssignedRole
      .findOne({ user: currentUserId })
      .populate("roles");

    const isSuperAdmin = currentUserAssignment?.roles?.some(
      (role) => role.name === "SUPER ADMIN",
    );

    // === 3. Build base query ===
    let query = {};

    // Super Admin: sees all (except exclusions below)
    // Regular user: only sees own assignments
    if (!isSuperAdmin) {
      query.assignedBy = currentUserId;
    }

    // === 4. Global search (user, fullName, role labels) ===
    if (search) {
      const roleSearch = await Role.find({
        $or: [{ label: new RegExp(search, "i") }],
      }).select("_id");

      const orConditions = [
        { user: new RegExp(search, "i") },
        { fullName: new RegExp(search, "i") },
      ];

      if (roleSearch.length > 0) {
        orConditions.push({ roles: { $in: roleSearch.map((r) => r._id) } });
      }

      if (!isSuperAdmin) {
        query.$and = [{ assignedBy: currentUserId }, { $or: orConditions }];
      } else {
        query.$or = orConditions;
      }
    } else if (!isSuperAdmin) {
      query.assignedBy = currentUserId;
    }

    // === 5. Field filters (user, fullName, assignedBy) ===
    textFilter(query, { user, fullName, assignedBy });

    // === 6. Exclude Super Admins & Current User ===
    // Get all users who have SUPER ADMIN role
    const superAdminAssignments = await AssignedRole
      .find({
        roles: { $in: await Role.find({ name: "SUPER ADMIN" }).select("_id") },
      })
      .select("user");

    const superAdminUserIds = superAdminAssignments.map((a) => a.user);

    // Build exclusion array: Super Admins + Current User
    const excludeUserIds = [...new Set([...superAdminUserIds, currentUserId])];

    if (excludeUserIds.length > 0) {
      query.user = { $nin: excludeUserIds };
    }

    // === 7. Sorting ===
    const sortByField = orderBy || "createdAt";
    const sortOrder = order.toLowerCase() === "desc" ? -1 : 1;
    const sortQuery = { [sortByField]: sortOrder };

    // === 8. Fetch results ===
    const assigned = await AssignedRole
      .find(query)
      .populate("roles")
      .skip(skip)
      .limit(limitNum)
      .sort(sortQuery);

    const totalRecords = await AssignedRole.countDocuments(query);

    return res.json({
      assigned,
      totalPages: Math.ceil(totalRecords / limitNum),
      currentPage: pageNum,
      totalRecords,
    });
  } catch (e) {
    console.error("Error in getAllAssignedRoles:", e);
    return res.status(500).json({ error: "Something went wrong." });
  }
};

exports.reAssignRole = async (req, res) => {
  const { id } = req.params;
  const { roles = [] } = req.body; // Default to empty array if not sent

  // Allow empty array â†’ user can have no roles
  if (!Array.isArray(roles)) {
    return res.status(400).json({ error: "Roles must be an array" });
  }

  try {
    const updated = await AssignedRole
      .findByIdAndUpdate(
        id,
        { roles }, // Can be [] â†’ removes all roles
        { new: true },
      )
      .populate("roles");

    if (!updated) {
      return res.status(404).json({ error: "Assigned role not found" });
    }

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};