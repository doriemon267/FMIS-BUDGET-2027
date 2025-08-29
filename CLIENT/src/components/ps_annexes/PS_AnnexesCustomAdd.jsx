import React, { useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from "@mui/material";
import { useForm } from "react-hook-form";
import CustomTextField from "../../global/components/CustomTextField";
import CustomAutoComplete from "../../global/components/CustomAutoComplete";
import CustomButton from "../../global/components/CustomButton";
import api from "../../config/api";
import { toast } from "react-hot-toast";
import { useUser } from "../../context/UserContext";
const AddPSAnnexDialog = ({ parentClose }) => {
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const { currentUser } = useUser();
  const {
    control,
    handleSubmit,
    reset,
    setValue,
    trigger,
    getValues,
    formState: { isDirty },
  } = useForm({
    defaultValues: {
      employeeFullName: "",
      positionTitle: "",
      department: "",
      division: "",
      Amount: "",
      annexNameId: "",
    },
  });

  const handleOpen = () => setIsOpen(true);
  const handleClose = () => {
    setIsOpen(false);
    parentClose && parentClose();
  };

  const handleSave = async (data) => {
    setLoading(true);
    try {
      const processBy = `${currentUser.FirstName} ${currentUser.LastName}`;
      const region = currentUser.Region;
      const processDate = new Date();
      const fiscalYear = new Date().getFullYear().toString();

      // Ensure all required fields are mapped correctly
      const payload = {
        employeeFullName: data.employeeFullName,
        positionTitle: data.positionTitle,
        Department: data.department, // Ensure casing matches model (Department)
        Division: data.division,
        Amount: Number(data.Amount), // Ensure Amount is a number
        region,
        processBy,
        processDate,
        fiscalYear,
        status: data.status || "Not Submitted",
        annexNameId: data.annexNameId, 
      };

      await api.post("/ps_annexes", payload);
      toast.success("PS Annex added successfully");
      handleClose();
    } catch (error) {
      console.error("Error saving PS Annex:", error);
      toast.error(error.response?.data?.error || "Failed to save PS Annex");
    } finally {
      setLoading(false);
    }
  };

  const handleEmployeeChange = async (value) => {
    if (value) {
      try {
        const response = await api.get(`/ps_employeename/${value}`);
        const employeeData = response.data;
        setValue("positionTitle", employeeData.positionTitle);
        setValue("department", employeeData.department);
        setValue("division", employeeData.division);
        trigger(["positionTitle", "department", "division"]);
      } catch (error) {
        toast.error("Failed to fetch employee details");
      }
    }
  };

  return (
    <div>
      <Button variant="contained" size="large" onClick={handleOpen}>
        Add PS Annex
      </Button>

      <Dialog open={isOpen} onClose={handleClose}>
        <DialogTitle>Add New PS Annex</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" gutterBottom>
            Fill in the PS Annex details.
          </Typography>

          <CustomAutoComplete
            fieldName="annexNameId"
            label="Select Annex Name"
            apiList={{
              api: api,
              endpoint: "/annexes",
              listName: "annexes",
            }}
            control={control}
            sx={{ mb: 2, mt: 0 }}
            getOptionLabel="AnnexName"
            required
          />

          <CustomAutoComplete
            fieldName="employeeFullName"
            label="Select Employee Name"
            apiList={{
              api: api,
              endpoint: "ps_employeename",
              listName: "personnelServices",
            }}
            control={control}
            sx={{ mb: 2, mt: 0 }}
            getOptionLabel="employeeFullName"
            required
            getObject
            onChange={(value) => {
              setValue("positionTitle", value.positionTitle);
              setValue("department", value.department);
              setValue("division", value.division);
              // handleEmployeeChange(value?.employeeFullName)
            }}
          />

          <CustomTextField
            fieldName="positionTitle"
            control={control}
            label="Position Title"
            disabled
          />
          <CustomTextField
            fieldName="department"
            control={control}
            label="Department"
            disabled
          />
          <CustomTextField
            fieldName="division"
            control={control}
            label="Division"
            disabled
          />
          <CustomTextField
            fieldName="Amount"
            control={control}
            label="Amount"
            type="number"
            required
          />
        </DialogContent>

        <DialogActions>
          <CustomButton
            loading={loading}
            plain
            color="error"
            onClick={handleClose}
          >
            Close
          </CustomButton>
          <CustomButton loading={loading} onClick={handleSubmit(handleSave)}>
            Create
          </CustomButton>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default AddPSAnnexDialog;
