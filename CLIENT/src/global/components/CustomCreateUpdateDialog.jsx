import { yupResolver } from "@hookform/resolvers/yup";
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Typography,
} from "@mui/material";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { toast } from "react-hot-toast";
import { FaEdit } from "react-icons/fa";
import * as yup from "yup";
import api from "../../config/api";
import CustomButton from "../../global/components/CustomButton";
import CustomTextField from "../../global/components/CustomTextField";
import CustomAutocompleteField from "../../global/components/CustomAutocompleteField";
import { formatLabel } from "../../utils/formatLabel";
import { invalidateDataList } from "../../utils/queryClientHelpers";

// We'll fetch regions from the database instead of using static values

const CustomCreateUpdateDialog = ({
  schema,
  row,
  endpoint,
  parentClose,
  dataListName,
  onAfterInvalidate,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [regions, setRegions] = useState([]);
  const isEditMode = Boolean(row);
  const queryClient = useQueryClient();
  
  // Fetch regions from the database
  useEffect(() => {
    if (isOpen) {
      const fetchRegions = async () => {
        try {
          const response = await api.get('/api/regions');
          if (response.data && Array.isArray(response.data)) {
            // Extract region names from the response
            const regionNames = response.data.map(region => region.regionName || region.name);
            setRegions(regionNames);
          } else if (response.data && response.data.regions && Array.isArray(response.data.regions)) {
            // Alternative response format
            const regionNames = response.data.regions.map(region => region.regionName || region.name);
            setRegions(regionNames);
          } else {
            console.error('Invalid regions response format:', response.data);
          }
        } catch (error) {
          console.error('Error fetching regions:', error);
          // Fallback to empty array if fetch fails
          setRegions([]);
        }
      };
      
      fetchRegions();
    }
  }, [isOpen]);

  // Convert schema to Yup validation dynamically
  const validationSchema = yup.object(
    Object.keys(schema).reduce((acc, key) => {
      if (schema[key].readOnly) return acc;
      if (schema[key].type === "text" && schema[key].required) {
        acc[key] = yup.string().required(`${schema[key].label} is required`);
      } else if (schema[key].type === "number") {
        acc[key] = yup
          .number()
          .min(0, `${schema[key].label} must be a positive number`);
      } else if (schema[key].type === "boolean") {
        acc[key] = yup.boolean().default(schema[key].default ?? false);
      } else if (schema[key].type === "array") {
        acc[key] = yup.array().of(yup.string());
      } else {
        acc[key] = yup.string().optional();
      }
      return acc;
    }, {})
  );

  const {
    control,
    handleSubmit,
    watch,
    setValue,
  } = useForm({
    resolver: yupResolver(validationSchema),
    defaultValues: isEditMode
      ? row
      : Object.keys(schema).reduce((acc, key) => {
          if (schema[key].type === "array") {
            acc[key] = schema[key].default ?? [];
          } else {
            acc[key] = schema[key].default ?? "";
          }
          return acc;
        }, {}),
  });

  const salaryGradeValue = watch("gradelevel_SG");
  const payGradeValue = watch("gradelevel_PG");
  const jobGradeValue = watch("gradelevel_JG");
  const salaryStepValue = watch("step");
  const salaryLookupSequence = useRef(0);
  
  // Watch for isGlobal changes to clear regions when global is checked
  const isGlobalValue = watch("isGlobal");
  
  useEffect(() => {
    if (isGlobalValue) {
      setValue("regions", []);
    }
  }, [isGlobalValue, setValue]);

  // Keep the Permanent PS salary in sync with the active salary mapping.
  // This is intentionally limited to existing Permanent personnel records.
  useEffect(() => {
    if (
      !isOpen ||
      !isEditMode ||
      String(row?.statusOfAppointment || "").trim().toUpperCase() !== "PERMANENT"
    ) return undefined;

    const timer = setTimeout(async () => {
      const requestId = ++salaryLookupSequence.current;
      const step = parseInt(String(salaryStepValue || row?.step || "1"), 10);
      const salaryGrade = parseInt(String(salaryGradeValue || ""), 10);
      const payGrade = parseInt(String(payGradeValue || ""), 10);
      const jobGrade = parseInt(String(jobGradeValue || "").replace(/^JG-?/i, ""), 10);
      if (!Number.isInteger(step) || step < 1 || step > 8) return;

      const changedFromOriginal = (current, original) =>
        current != null && String(current).trim() !== String(original ?? "").trim();
      const lookupBy = changedFromOriginal(salaryGradeValue, row?.gradelevel_SG)
        ? "salaryGrade"
        : changedFromOriginal(payGradeValue, row?.gradelevel_PG)
          ? "cpcs2PayGrade"
          : changedFromOriginal(jobGradeValue, row?.gradelevel_JG)
            ? "cpcs1JobGrade"
            : "salaryGrade";

      try {
        const { data: cpcsSettings } = await api.get("/cpcs-salary/use-cpcs");
        const cpcs2AppointmentTypes = Array.isArray(cpcsSettings?.cpcs2AppointmentTypes)
          ? cpcsSettings.cpcs2AppointmentTypes.map((value) => String(value).toUpperCase())
          : ["PERMANENT"];
        const useCpcs2 = Boolean(cpcsSettings?.useCPCSForEmployeeAdd) &&
          cpcs2AppointmentTypes.includes("PERMANENT");

        let monthlySalary;
        if (useCpcs2) {
          const filterValue = lookupBy === "salaryGrade"
            ? salaryGrade
            : lookupBy === "cpcs2PayGrade"
              ? payGrade
              : jobGrade;
          if (!Number.isInteger(filterValue)) return;
          const filterName = lookupBy === "salaryGrade"
            ? "salaryGrade"
            : lookupBy;
          const { data } = await api.get("/cpcs-salary/table", {
            params: { [filterName]: filterValue, limit: 100, offset: 0 },
          });
          const rows = Array.isArray(data?.rows) ? data.rows : [];
          const rowMatchesCurrentMapping = (item) =>
            (Number.isInteger(salaryGrade) && Number(item.salaryGrade) === salaryGrade) ||
            (Number.isInteger(payGrade) && Number(item.cpcs2PayGrade) === payGrade);
          const mapping = rows.find(rowMatchesCurrentMapping) || rows[0];
          if (!mapping) return;
          monthlySalary = mapping[`step${step}`];
          if (monthlySalary == null || !Number.isFinite(Number(monthlySalary))) return;
          if (requestId !== salaryLookupSequence.current) return;
          setValue("gradelevel_SG", String(mapping.salaryGrade), { shouldDirty: true });
          setValue("gradelevel_JG", String(mapping.cpcs1JobGrade), { shouldDirty: true });
          setValue("gradelevel_PG", String(mapping.cpcs2PayGrade), { shouldDirty: true });
        } else {
          if (!Number.isInteger(salaryGrade)) return;
          const { data } = await api.get("/salary-grades", {
            params: { salary_grade: salaryGrade },
          });
          const mapping = Array.isArray(data?.grades) ? data.grades[0] : null;
          const rates = mapping?.rates || {};
          monthlySalary = rates[String(step)] ?? rates[step];
          if (monthlySalary == null || !Number.isFinite(Number(monthlySalary))) return;
          if (requestId !== salaryLookupSequence.current) return;
          if (mapping?.job_grade != null) {
            setValue("gradelevel_JG", String(mapping.job_grade), { shouldDirty: true });
          }
        }

        if (requestId === salaryLookupSequence.current) {
          setValue("monthlySalary", Number(monthlySalary), {
            shouldDirty: true,
            shouldValidate: true,
          });
          setValue("annualSalary", Number(monthlySalary) * 12, { shouldDirty: true });
          setValue("midyearBonus", Number(monthlySalary), { shouldDirty: true });
          setValue("yearEndBonus", Number(monthlySalary), { shouldDirty: true });
        }
      } catch (error) {
        console.error("Failed to recompute Permanent monthly salary:", error);
      }
    }, 200);

    return () => {
      clearTimeout(timer);
      salaryLookupSequence.current += 1;
    };
  }, [
    isOpen,
    isEditMode,
    row,
    salaryGradeValue,
    payGradeValue,
    jobGradeValue,
    salaryStepValue,
    setValue,
  ]);

  const mutation = useMutation({
    mutationFn: async (data) => {
      try {
        const response = isEditMode
          ? await api.put(`${endpoint}/${row._id}`, data)
          : await api.post(endpoint, data);
        return response;
      } catch (error) {
        console.error("API error:", error);
        console.error("Error response:", error.response?.data);
        throw error;
      }
    },
    onSuccess: async () => {
      await invalidateDataList(queryClient, dataListName);
      
      // Also invalidate chargedToIncome queries for BudgetarySupportTable
      if (dataListName.includes('ChargedToIncome')) {
        queryClient.invalidateQueries({
          queryKey: ['personnelServices', 'chargedToIncome']
        });
      }
      
      // Optional: invalidate related queries (e.g. BudgetarySupportTable, Comprehensive Reports)
      if (typeof onAfterInvalidate === 'function') {
        await onAfterInvalidate();
      }
      
      toast.success(
        isEditMode ? "Updated successfully" : "Created successfully"
      );
      handleClose();
      if (parentClose) parentClose();
    },
    onError: (error) => {
      console.error("Mutation error:", error);
      toast.error(error.response?.data?.error || error.message || "Error occurred");
    },
  });

  const handleOpen = () => setIsOpen(true);
  const handleClose = () => {
    setIsOpen(false);
    if (parentClose) parentClose();
  };

  const onSubmit = (data) => {
    
    // Make sure we're sending the correct data structure
    const formattedData = {
      ...data,
      // Sync name with incomeSubcategoryName for API compatibility
      name: data.incomeSubcategoryName,
      // Ensure regions is an array
      regions: Array.isArray(data.regions) ? data.regions : [],
      // Make sure isGlobal is a boolean
      isGlobal: Boolean(data.isGlobal)
    };
    
    Object.keys(schema).filter(key => schema[key].readOnly).forEach(key => delete formattedData[key]);
    mutation.mutate(formattedData);
  };

  const label = formatLabel(dataListName);

  return (
    <div>
      {!row ? (
        <CustomButton onClick={handleOpen}>Add {label}</CustomButton>
      ) : (
        <MenuItem
          onClick={() => {
            // Check if the record has been submitted
            const submittedStatuses = ["Submitted", "Division Submitted", "Forwarded to Officer", "Officer Approved", "Forwarded to Manager", "Finalized"];
            if (submittedStatuses.includes(row.status)) {
              toast.error("Cannot edit record that has been submitted or approved");
              return;
            }
            handleOpen();
          }}
          disableRipple
          sx={{ display: "flex", gap: 1 }}
        >
          <FaEdit />
          Edit
        </MenuItem>
      )}

      <Dialog open={isOpen} onClose={handleClose}>
        <DialogTitle>{isEditMode ? "Edit Entry" : "Add New Entry"}</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" gutterBottom mb={2}>
            {isEditMode
              ? "Update the details below."
              : "Provide details below."}
          </Typography>

          {Object.keys(schema).map((key) => {
            const field = schema[key];
            if (field.readOnly) return null;

            if (
              field.type === "action" ||
              key === "createdAt" ||
              key === "updatedAt" ||
              key === "specialRegions" || // Skip specialRegions entirely
              (isGlobalValue && key === "regions")
            )
              return null; // Skip non-renderable / action fields

            if (field.type === "array") {
              const options = key === "regions" ? regions : (field.options || []);
              return (
                <CustomAutocompleteField
                  key={key}
                  control={control}
                  fieldName={key}
                  label={field.label}
                  options={options}
                  multiple={true}
                  sx={{ mb: 2 }}
                />
              );
            }

            if (field.type === "date") {
              return (
                <CustomTextField
                  key={key}
                  control={control}
                  fieldName={key}
                  label={field.label}
                  type={field.type}
                  required={!!field.required}
                  row={3}
                  InputLabelProps={{ shrink: true }}
                  multiline={field.type === "textarea"}
                  sx={{ mb: 2 }}
                />
              );
            }
            
            return (
              <CustomTextField
                key={key}
                control={control}
                fieldName={key}
                label={field.label}
                type={field.type}
                required={!!field.required}
                row={3}
                multiline={field.type === "textarea"}
                sx={{ mb: 2 }}
              />
            );
          })}
        </DialogContent>
        <DialogActions>
          <CustomButton plain color="error" onClick={handleClose}>
            Cancel
          </CustomButton>
          <CustomButton
            loading={mutation.isLoading}
            onClick={handleSubmit(onSubmit)}
          >
            {isEditMode ? "Update" : "Add"}
          </CustomButton>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default CustomCreateUpdateDialog;
