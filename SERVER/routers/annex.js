const {
    getAllAnnexes,
    addAnnex,
    editAnnex,
    deleteAnnex,
  } = require("../controllers/annex_controller");
  const Router = require("express").Router;
  
  const annexRouter = Router();

  const check_token_dev = require("../middleware/check_token_dev");
  const check_token_prod = require("../middleware/check_token_prod");
  const IS_PRODUCTION = require("../utils/IS_PRODUCTION");
  
  const tokenMiddleware = IS_PRODUCTION ? check_token_prod : check_token_dev;
  
  // Apply authentication middleware to all routes in this router
  annexRouter.use(tokenMiddleware);
  // Get all annexes
  annexRouter.get("/annexes", getAllAnnexes);
  // Add a new annex
  annexRouter.post("/annexes", addAnnex);
  // Edit an existing annex
  annexRouter.put("/annexes/:id", editAnnex);
  // Delete an annex
  annexRouter.delete("/annexes/:id", deleteAnnex);
  module.exports = annexRouter;