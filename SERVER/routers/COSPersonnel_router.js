const {
  bulkAddCOSPersonnel,
  getAllCOSPersonnel,
  updateCOSPersonnel,
  deleteCOSPersonnel,
  getGrandTotalCOS
} = require("../controllers/COSPersonnelController");
const Router = require("express").Router;
const checkDueDate = require("../middleware/checkDueDate");
const checkToken = require("../middleware/checkToken");
const hierarchicalAccessControl = require("../middleware/hierarchicalAccessControl");
const cosPersonnelRouter = Router();
// Apply authentication middleware to all routes in this router
cosPersonnelRouter.use(checkToken);
// Apply hierarchical access control middleware for read operations
cosPersonnelRouter.use('/cosPersonnels', hierarchicalAccessControl('read'));
cosPersonnelRouter.use('/grandtotalCOS', hierarchicalAccessControl('read'));
// Apply hierarchical access control middleware for write operations
cosPersonnelRouter.use('/cos-personnel/bulk-add', hierarchicalAccessControl('create'));
cosPersonnelRouter.put('/cos-personnel/:id', hierarchicalAccessControl('update'));
cosPersonnelRouter.delete('/cos-personnel/:id', hierarchicalAccessControl('delete'));
cosPersonnelRouter.get("/cosPersonnels",  getAllCOSPersonnel);
cosPersonnelRouter.post("/cos-personnel/bulk-add",  checkDueDate, bulkAddCOSPersonnel);
cosPersonnelRouter.put("/cos-personnel/:id",  checkDueDate, updateCOSPersonnel);
cosPersonnelRouter.delete("/cos-personnel/:id",  checkDueDate, deleteCOSPersonnel);
cosPersonnelRouter.get("/grandtotalCOS",  getGrandTotalCOS);
module.exports = cosPersonnelRouter;
