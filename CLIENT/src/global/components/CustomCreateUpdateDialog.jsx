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
import { useState, useEffect } from "react";
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
  
  // Watch for isGlobal changes to clear regions when global is checked
  const isGlobalValue = watch("isGlobal");
  
  useEffect(() => {
    if (isGlobalValue) {
      setValue("regions", []);
    }
  }, [isGlobalValue, setValue]);

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

            if (
              field.type === "action" ||
              key === "createdAt" ||
              key === "updatedAt" ||
              key === "specialRegions" || // Skip specialRegions entirely
              (isGlobalValue && key === "regions")
            )
              return null; // Skip non-renderable / action fields

            if (field.type === "array") {
              if (key === "regions") {
                return (
                  <CustomAutocompleteField
                    key={key}
                    control={control}
                    fieldName={key}
                    label={field.label}
                    options={regions}
                    multiple={true}
                    sx={{ mb: 2 }}
                  />
                );
              }
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
