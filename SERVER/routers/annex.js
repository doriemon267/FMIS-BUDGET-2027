const {
    getAllAnnexes,
    addAnnex,
    editAnnex,
    deleteAnnex,
  } = require("../controllers/annex_controller");
  const Router = require("express").Router;
  const checkToken = require('../middleware/check_token');
  const annexRouter = Router();
  // Apply authentication middleware to all routes in this router
  annexRouter.use(checkToken);
  // Get all annexes
  annexRouter.get("/annexes", getAllAnnexes);
  // Add a new annex
  annexRouter.post("/annexes", addAnnex);
  // Edit an existing annex
  annexRouter.put("/annexes/:id", editAnnex);
  // Delete an annex
  annexRouter.delete("/annexes/:id", deleteAnnex);
  module.exports = annexRouter;