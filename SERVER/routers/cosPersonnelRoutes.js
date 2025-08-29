const {
  bulkAddCOSPersonnel,
  getAllCOSPersonnel,
  updateCOSPersonnel,
  deleteCOSPersonnel,
  getGrandTotalCOS
} = require("../controllers/cosPersonnelController");

const Router = require("express").Router;
const checkDueDate = require("../middleware/checkDueDate");
const checkToken = require("../middleware/checkToken");

const cosPersonnelRouter = Router();

// Apply authentication middleware to all routes in this router
cosPersonnelRouter.use(checkToken);

cosPersonnelRouter.get("/cosPersonnels",  getAllCOSPersonnel);
cosPersonnelRouter.post("/cos-personnel/bulk-add",  checkDueDate, bulkAddCOSPersonnel);
cosPersonnelRouter.put("/cos-personnel/:id",  checkDueDate, updateCOSPersonnel);
cosPersonnelRouter.delete("/cos-personnel/:id",  checkDueDate, deleteCOSPersonnel);
cosPersonnelRouter.get("/grandtotalCOS",  getGrandTotalCOS);

module.exports = cosPersonnelRouter;
