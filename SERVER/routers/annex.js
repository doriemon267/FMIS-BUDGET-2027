const {
    getAllAnnexes,
    addAnnex,
    editAnnex,
    deleteAnnex,
  } = require("../controllers/annex_controller");
  const Router = require("express").Router;
  
  const annexRouter = Router();

const isAuth = require("../middleware/is_auth");
  
  // Apply authentication middleware to all routes in this router
  annexRouter.use(isAuth);
  // Get all annexes
  annexRouter.get("/annexes", getAllAnnexes);
  // Add a new annex
  annexRouter.post("/annexes", addAnnex);
  // Edit an existing annex
  annexRouter.put("/annexes/:id", editAnnex);
  // Delete an annex
  annexRouter.delete("/annexes/:id", deleteAnnex);
  module.exports = annexRouter;
