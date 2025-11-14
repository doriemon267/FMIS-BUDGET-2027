import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  Box,
  IconButton,
  Collapse,
  Typography,
  Chip,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Paper,
  Tooltip,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  Toolbar,
  Tabs,
  Tab,
  Fade,
} from "@mui/material";
import {
  KeyboardArrowDown,
  KeyboardArrowUp,
  Edit,
  Add,
  Save,
  Cancel,
  Refresh,
  FolderOpen,
  Folder,
  Description,
} from "@mui/icons-material";
import { NumericFormat } from "react-number-format";
import { toast } from "react-toastify";
import api from "../../config/api";
import { useRegion } from "../../context/RegionContext";
import { useUser } from "../../context/UserContext";
import { useWorkflowRef } from "../../hooks/useWorkflowRef";

// Number format component
const NumberFormatCustom = React.forwardRef(function NumberFormatCustom(props, ref) {
  const { onChange, name = "amount", ...other } = props;

  return (
    <NumericFormat
      {...other}
      getInputRef={ref}
      onValueChange={(values) => {
        onChange({
          target: {
            name: name,
            value: values.value,
          },
        });
      }}
      thousandSeparator
      valueIsNumericString
      prefix="₱"
    />
  );
});

// Format number helper
const formatNumber = (number) => {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(number || 0);
};

// Custom Toolbar
function CustomToolbar({ onRefresh, onAddNew, loading, locked = false, lockedReason = "" }) {
  return (
    <Toolbar 
      sx={{ 
        gap: 1, 
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        color: "white",
        borderRadius: "8px 8px 0 0",
      }}
    >
      <Typography variant="h6" sx={{ flex: 1, fontWeight: 600 }}>
        💼 Capital Outlay Management
      </Typography>
      <Button
        size="small"
        startIcon={<Refresh />}
        onClick={onRefresh}
        disabled={loading}
        sx={{ 
          color: "white", 
          borderColor: "rgba(255,255,255,0.5)",
          "&:hover": { 
            borderColor: "white",
            bgcolor: "rgba(255,255,255,0.1)" 
          }
        }}
        variant="outlined"
      >
        Refresh
      </Button>
      <Tooltip
        title={locked ? lockedReason || "Adding entries is currently disabled." : ""}
        disableFocusListener={!locked}
        disableHoverListener={!locked}
        disableTouchListener={!locked}
      >
        <span>
          <Button
            size="small"
            variant="contained"
            startIcon={<Add />}
            onClick={onAddNew}
            disabled={locked}
            sx={{ 
              bgcolor: "white", 
              color: "#667eea",
              "&:hover": { bgcolor: "#f0f0f0" }
            }}
          >
            Add New
          </Button>
        </span>
      </Tooltip>
    </Toolbar>
  );
}

// Level 3: Detail Row (Particulars Breakdown) - EDITABLE
function DetailRow({ detail, onEdit, canEdit }) {
  const total = (detail.income_amount || 0) + (detail.subsidy_amount || 0);

  return (
    <Fade in timeout={300}>
      <Paper
        elevation={0}
        sx={{
          p: 1.5,
          mb: 1,
          border: "1px solid #e0e0e0",
          borderLeft: "4px solid #4caf50",
          borderRadius: 1,
          display: "flex",
          gap: 2,
          transition: "all 0.2s",
          "&:hover": {
            boxShadow: 2,
            borderLeftColor: "#2e7d32",
          },
        }}
      >
        <Description sx={{ color: "#4caf50", fontSize: 20 }} />
        <Box sx={{ flex: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            {detail.particulars || "No particulars"}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
          <Box sx={{ textAlign: "right", minWidth: 100 }}>
            <Typography variant="caption" color="text.secondary">
              Income
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 500, color: "#1976d2" }}>
              ₱{formatNumber(detail.income_amount)}
            </Typography>
          </Box>
          <Box sx={{ textAlign: "right", minWidth: 100 }}>
            <Typography variant="caption" color="text.secondary">
              Subsidy
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 500, color: "#ed6c02" }}>
              ₱{formatNumber(detail.subsidy_amount)}
            </Typography>
          </Box>
          <Box sx={{ textAlign: "right", minWidth: 100 }}>
            <Typography variant="caption" color="text.secondary">
              Total
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600, color: "#2e7d32" }}>
              ₱{formatNumber(total)}
            </Typography>
          </Box>
          {canEdit && (
            <Tooltip title="Edit Detail">
              <IconButton
                size="small"
                color="primary"
                onClick={() => onEdit(detail)}
                sx={{ ml: 1 }}
              >
                <Edit fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Paper>
    </Fade>
  );
}

// Level 2: Subline Item Row (Child) - Collapsible
function SublineRow({ 
  sublineItem, 
  expandedSublines, 
  onToggleSubline, 
  details, 
  loadingDetails, 
  canEdit,
  onEditDetail 
}) {
  const isExpanded = expandedSublines.has(sublineItem._id);
  const detailsList = details || [];
  const total = (sublineItem.income || 0) + (sublineItem.subsidy || 0);

  return (
    <>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          p: 1.5,
          pl: 6,
          bgcolor: isExpanded ? "#f5f5f5" : "white",
          borderBottom: "1px solid #e0e0e0",
          cursor: "pointer",
          transition: "all 0.2s",
          "&:hover": {
            bgcolor: "#f0f0f0",
          },
        }}
        onClick={() => onToggleSubline(sublineItem._id)}
      >
        <IconButton size="small" sx={{ mr: 1 }}>
          {isExpanded ? <KeyboardArrowUp /> : <KeyboardArrowDown />}
        </IconButton>
        
        <Box sx={{ flex: 1, display: "flex", gap: 3 }}>
          <Box sx={{ minWidth: 150 }}>
            <Typography variant="caption" color="text.secondary">
              Subline Item
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {sublineItem.sublineItem || "-"}
            </Typography>
          </Box>
          
          <Box sx={{ minWidth: 200 }}>
            <Typography variant="caption" color="text.secondary">
              Accounting Title
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {sublineItem.accountingTitle || "-"}
            </Typography>
          </Box>
          
          <Box sx={{ minWidth: 120 }}>
            <Typography variant="caption" color="text.secondary">
              UACS Code
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {sublineItem.uacsCode || "-"}
            </Typography>
          </Box>
          
          <Box sx={{ flex: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Particulars
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                {sublineItem.particulars || "-"}
              </Typography>
              {detailsList.length > 0 && (
                <Chip
                  label={`${detailsList.length}`}
                  size="small"
                  color="primary"
                  variant="outlined"
                />
              )}
            </Box>
          </Box>
        </Box>

        <Box sx={{ display: "flex", gap: 2, mr: 2 }}>
          <Box sx={{ textAlign: "right", minWidth: 100 }}>
            <Typography variant="caption" color="text.secondary">
              Income
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 500, color: "#1976d2" }}>
              ₱{formatNumber(sublineItem.income)}
            </Typography>
          </Box>
          <Box sx={{ textAlign: "right", minWidth: 100 }}>
            <Typography variant="caption" color="text.secondary">
              Subsidy
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 500, color: "#ed6c02" }}>
              ₱{formatNumber(sublineItem.subsidy)}
            </Typography>
          </Box>
          <Box sx={{ textAlign: "right", minWidth: 100 }}>
            <Typography variant="caption" color="text.secondary">
              Total
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600, color: "#2e7d32" }}>
              ₱{formatNumber(total)}
            </Typography>
          </Box>
        </Box>
      </Box>

      <Collapse in={isExpanded} timeout="auto" unmountOnExit>
        <Box sx={{ pl: 10, pr: 3, py: 2, bgcolor: "#fafafa" }}>
          {loadingDetails ? (
            <Box sx={{ display: "flex", justifyContent: "center", p: 2 }}>
              <CircularProgress size={24} />
            </Box>
          ) : detailsList.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
              No breakdown details available
            </Typography>
          ) : (
            <>
              <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600, color: "#666" }}>
                📋 Breakdown Details ({detailsList.length} items)
              </Typography>
              {detailsList.map((detail, index) => (
                <DetailRow
                  key={detail._id || index}
                  detail={detail}
                  onEdit={onEditDetail}
                  canEdit={canEdit}
                />
              ))}
            </>
          )}
        </Box>
      </Collapse>
    </>
  );
}

// Level 1: Mother Row (TITLE/Category) - Collapsible
function MotherRow({ 
  title, 
  sublineItems, 
  expandedMothers, 
  expandedSublines,
  onToggleMother, 
  onToggleSubline,
  capitalOutlayDetails,
  loadingDetails,
  fetchDetails,
  canEdit,
  onEditDetail
}) {
  const isExpanded = expandedMothers.has(title);
  
  // Calculate totals from all subline items
  const totalIncome = sublineItems.reduce((sum, item) => sum + (item.income || 0), 0);
  const totalSubsidy = sublineItems.reduce((sum, item) => sum + (item.subsidy || 0), 0);
  const grandTotal = totalIncome + totalSubsidy;
  const itemCount = sublineItems.length;

  const handleToggle = () => {
    onToggleMother(title);
  };

  const handleSublineToggle = (sublineId) => {
    onToggleSubline(sublineId);
    fetchDetails(sublineId);
  };

  return (
    <>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          p: 2,
          bgcolor: isExpanded ? "#e3f2fd" : "white",
          borderBottom: "2px solid #1976d2",
          cursor: "pointer",
          transition: "all 0.3s",
          "&:hover": {
            bgcolor: isExpanded ? "#bbdefb" : "#f5f5f5",
            transform: "translateX(4px)",
          },
        }}
        onClick={handleToggle}
      >
        <IconButton size="small" sx={{ mr: 2 }}>
          {isExpanded ? <FolderOpen sx={{ color: "#1976d2" }} /> : <Folder sx={{ color: "#666" }} />}
        </IconButton>
        
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, color: "#1976d2" }}>
            {title}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {itemCount} subline item{itemCount !== 1 ? 's' : ''}
          </Typography>
        </Box>

        <Box sx={{ display: "flex", gap: 3, mr: 2 }}>
          <Box sx={{ textAlign: "right", minWidth: 120 }}>
            <Typography variant="caption" color="text.secondary">
              Total Income
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 600, color: "#1976d2" }}>
              ₱{formatNumber(totalIncome)}
            </Typography>
          </Box>
          <Box sx={{ textAlign: "right", minWidth: 120 }}>
            <Typography variant="caption" color="text.secondary">
              Total Subsidy
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 600, color: "#ed6c02" }}>
              ₱{formatNumber(totalSubsidy)}
            </Typography>
          </Box>
          <Box sx={{ textAlign: "right", minWidth: 120 }}>
            <Typography variant="caption" color="text.secondary">
              Grand Total
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 700, color: "#2e7d32" }}>
              ₱{formatNumber(grandTotal)}
            </Typography>
          </Box>
        </Box>
      </Box>

      <Collapse in={isExpanded} timeout="auto" unmountOnExit>
        <Box sx={{ bgcolor: "#fafafa" }}>
          {sublineItems.map((sublineItem) => (
            <SublineRow
              key={sublineItem._id}
              sublineItem={sublineItem}
              expandedSublines={expandedSublines}
              onToggleSubline={handleSublineToggle}
              details={capitalOutlayDetails[sublineItem._id]}
              loadingDetails={loadingDetails[sublineItem._id]}
              canEdit={canEdit}
              onEditDetail={onEditDetail}
            />
          ))}
        </Box>
      </Collapse>
    </>
  );
}

// Edit Detail Dialog
function EditDetailDialog({ open, onClose, detail, onSave, disabled = false, disabledReason = "" }) {
  const [formData, setFormData] = useState({
    particulars: "",
    income_amount: "",
    subsidy_amount: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (detail) {
      setFormData({
        particulars: detail.particulars || "",
        income_amount: detail.income_amount || "",
        subsidy_amount: detail.subsidy_amount || "",
      });
    }
  }, [detail]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    if (!detail || !detail._id) {
      toast.error("Invalid detail data");
      return;
    }
    if (disabled) {
      toast.error(disabledReason || "Capital outlay editing is currently disabled.");
      return;
    }
    
    try {
      setSaving(true);
      await onSave(detail._id, formData);
      toast.success("Detail updated successfully");
      onClose();
    } catch (err) {
      console.error("Error updating detail:", err);
      toast.error("Failed to update detail");
    } finally {
      setSaving(false);
    }
  };

  if (!detail) {
    return null;
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ bgcolor: "#1976d2", color: "white" }}>
        ✏️ Edit Breakdown Detail
      </DialogTitle>
      <DialogContent sx={{ mt: 2 }}>
        {disabled && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {disabledReason || "Capital outlay editing is currently disabled."}
          </Alert>
        )}
        <Stack spacing={2}>
          <TextField
            label="Particulars"
            name="particulars"
            value={formData.particulars}
            onChange={handleChange}
            fullWidth
            multiline
            rows={3}
          />
          <TextField
            label="Income Amount"
            name="income_amount"
            value={formData.income_amount}
            onChange={handleChange}
            fullWidth
            InputProps={{
              inputComponent: NumberFormatCustom,
            }}
          />
          <TextField
            label="Subsidy Amount"
            name="subsidy_amount"
            value={formData.subsidy_amount}
            onChange={handleChange}
            fullWidth
            InputProps={{
              inputComponent: NumberFormatCustom,
            }}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} startIcon={<Cancel />}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          startIcon={<Save />}
          disabled={saving || disabled}
        >
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// Add New Dialog with Tabs
function AddNewDialog({ open, onClose, categories = [], capitalOutlays = [], onSave, disabled = false, disabledReason = "" }) {
  const [tabValue, setTabValue] = useState(0);
  const [saving, setSaving] = useState(false);
  
  // Ensure arrays are always valid
  const categoriesList = Array.isArray(categories) ? categories : [];
  const capitalOutlaysList = Array.isArray(capitalOutlays) ? capitalOutlays : [];
  
  // Form data for each tab
  const [titleForm, setTitleForm] = useState({
    category: "",
    sublineItem: "",
    accountingTitle: "",
    uacsCode: "",
    particulars: "",
    income: "",
    subsidy: "",
  });

  const [sublineForm, setSublineForm] = useState({
    parentCategory: "",
    sublineItem: "",
    accountingTitle: "",
    uacsCode: "",
    particulars: "",
    income: "",
    subsidy: "",
  });

  const [detailForm, setDetailForm] = useState({
    capitalOutlayId: "",
    particulars: "",
    income_amount: "",
    subsidy_amount: "",
  });

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const handleTitleChange = (e) => {
    const { name, value } = e.target;
    setTitleForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSublineChange = (e) => {
    const { name, value } = e.target;
    setSublineForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleDetailChange = (e) => {
    const { name, value } = e.target;
    setDetailForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    if (disabled) {
      toast.error(disabledReason || "Capital outlay editing is currently disabled.");
      return;
    }
    try {
      setSaving(true);
      
      if (tabValue === 0) {
        // Add new TITLE (mother row)
        await onSave("title", titleForm);
        toast.success("New TITLE entry added successfully");
      } else if (tabValue === 1) {
        // Add new Subline Item
        await onSave("subline", sublineForm);
        toast.success("New Subline Item added successfully");
      } else if (tabValue === 2) {
        // Add new Detail
        await onSave("detail", detailForm);
        toast.success("New Detail added successfully");
      }
      
      onClose();
      // Reset forms
      setTitleForm({
        category: "",
        sublineItem: "",
        accountingTitle: "",
        uacsCode: "",
        particulars: "",
        income: "",
        subsidy: "",
      });
      setSublineForm({
        parentCategory: "",
        sublineItem: "",
        accountingTitle: "",
        uacsCode: "",
        particulars: "",
        income: "",
        subsidy: "",
      });
      setDetailForm({
        capitalOutlayId: "",
        particulars: "",
        income_amount: "",
        subsidy_amount: "",
      });
    } catch (err) {
      console.error("Error adding new entry:", err);
      toast.error("Failed to add new entry");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ bgcolor: "#667eea", color: "white" }}>
        ➕ Add New Entry
      </DialogTitle>
      <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Tabs value={tabValue} onChange={handleTabChange}>
          <Tab label="🏢 Add TITLE" />
          <Tab label="📋 Add Subline Item" />
          <Tab label="📝 Add Detail" />
        </Tabs>
      </Box>
      <DialogContent sx={{ mt: 2 }}>
        {disabled && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {disabledReason || "Capital outlay editing is currently disabled."}
          </Alert>
        )}
        {/* Tab 0: Add TITLE */}
        {tabValue === 0 && (
          <Stack spacing={2}>
            <FormControl fullWidth>
              <InputLabel>Category (TITLE)</InputLabel>
              <Select
                name="category"
                value={titleForm.category}
                onChange={handleTitleChange}
                label="Category (TITLE)"
              >
                {categoriesList.map((cat) => (
                  <MenuItem key={cat._id} value={cat._id}>
                    {cat.categoryName || cat.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Subline Item"
              name="sublineItem"
              value={titleForm.sublineItem}
              onChange={handleTitleChange}
              fullWidth
            />
            <TextField
              label="Accounting Title"
              name="accountingTitle"
              value={titleForm.accountingTitle}
              onChange={handleTitleChange}
              fullWidth
            />
            <TextField
              label="UACS Code"
              name="uacsCode"
              value={titleForm.uacsCode}
              onChange={handleTitleChange}
              fullWidth
            />
            <TextField
              label="Particulars"
              name="particulars"
              value={titleForm.particulars}
              onChange={handleTitleChange}
              fullWidth
              multiline
              rows={2}
            />
            <TextField
              label="Income Amount"
              name="income"
              value={titleForm.income}
              onChange={handleTitleChange}
              fullWidth
              InputProps={{
                inputComponent: NumberFormatCustom,
              }}
            />
            <TextField
              label="Subsidy Amount"
              name="subsidy"
              value={titleForm.subsidy}
              onChange={handleTitleChange}
              fullWidth
              InputProps={{
                inputComponent: NumberFormatCustom,
              }}
            />
          </Stack>
        )}

        {/* Tab 1: Add Subline Item */}
        {tabValue === 1 && (
          <Stack spacing={2}>
            <FormControl fullWidth>
              <InputLabel>Parent Category (TITLE)</InputLabel>
              <Select
                name="parentCategory"
                value={sublineForm.parentCategory}
                onChange={handleSublineChange}
                label="Parent Category (TITLE)"
              >
                {categoriesList.map((cat) => (
                  <MenuItem key={cat._id} value={cat._id}>
                    {cat.categoryName || cat.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Subline Item"
              name="sublineItem"
              value={sublineForm.sublineItem}
              onChange={handleSublineChange}
              fullWidth
            />
            <TextField
              label="Accounting Title"
              name="accountingTitle"
              value={sublineForm.accountingTitle}
              onChange={handleSublineChange}
              fullWidth
            />
            <TextField
              label="UACS Code"
              name="uacsCode"
              value={sublineForm.uacsCode}
              onChange={handleSublineChange}
              fullWidth
            />
            <TextField
              label="Particulars"
              name="particulars"
              value={sublineForm.particulars}
              onChange={handleSublineChange}
              fullWidth
              multiline
              rows={2}
            />
            <TextField
              label="Income Amount"
              name="income"
              value={sublineForm.income}
              onChange={handleSublineChange}
              fullWidth
              InputProps={{
                inputComponent: NumberFormatCustom,
              }}
            />
            <TextField
              label="Subsidy Amount"
              name="subsidy"
              value={sublineForm.subsidy}
              onChange={handleSublineChange}
              fullWidth
              InputProps={{
                inputComponent: NumberFormatCustom,
              }}
            />
          </Stack>
        )}

        {/* Tab 2: Add Detail */}
        {tabValue === 2 && (
          <Stack spacing={2}>
            <Alert severity="info">
              Select the parent Capital Outlay entry to add a breakdown detail.
            </Alert>
            <FormControl fullWidth>
              <InputLabel>Parent Capital Outlay</InputLabel>
              <Select
                name="capitalOutlayId"
                value={detailForm.capitalOutlayId}
                onChange={handleDetailChange}
                label="Parent Capital Outlay"
              >
                {capitalOutlaysList.map((co) => (
                  <MenuItem key={co._id} value={co._id}>
                    {co.category?.categoryName || co.categoryName || "Unknown"} - {co.sublineItem || "N/A"} - {co.accountingTitle || "N/A"}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Particulars"
              name="particulars"
              value={detailForm.particulars}
              onChange={handleDetailChange}
              fullWidth
              multiline
              rows={3}
            />
            <TextField
              label="Income Amount"
              name="income_amount"
              value={detailForm.income_amount}
              onChange={handleDetailChange}
              fullWidth
              InputProps={{
                inputComponent: NumberFormatCustom,
              }}
            />
            <TextField
              label="Subsidy Amount"
              name="subsidy_amount"
              value={detailForm.subsidy_amount}
              onChange={handleDetailChange}
              fullWidth
              InputProps={{
                inputComponent: NumberFormatCustom,
              }}
            />
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} startIcon={<Cancel />}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          startIcon={<Save />}
          disabled={saving || disabled}
        >
          {saving ? "Saving..." : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// Main Component
const CapitalOutlayDataGrid = ({ fiscalYear, onDataChange, disableIncomeInputs: _disableIncomeInputs = false, locked = false }) => {
  // State
  const [capitalOutlays, setCapitalOutlays] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedMothers, setExpandedMothers] = useState(new Set());
  const [expandedSublines, setExpandedSublines] = useState(new Set());
  const [capitalOutlayDetails, setCapitalOutlayDetails] = useState({});
  const [loadingDetails, setLoadingDetails] = useState({});
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [detailToEdit, setDetailToEdit] = useState(null);

  // Context
  const { currentUser } = useUser();
  const { activeRegion } = useRegion();
  const { workflowRef, headerConfig } = useWorkflowRef();
  const hasWorkflowRef = Boolean(workflowRef);
  const ensureWorkflowRef = useCallback(() => {
    if (!workflowRef) {
      toast.error("Create a proposal first to modify capital outlay entries.");
      return false;
    }
    return true;
  }, [workflowRef]);

  // Permissions
  const canEdit = useMemo(() => {
    if (!currentUser || !currentUser.Roles) return false;
    return currentUser.Roles.some(
      (role) =>
        role.toUpperCase().includes("ADMIN") ||
        role.toUpperCase().includes("BUDGET")
    );
  }, [currentUser]);
  const canModify = canEdit && !locked;
  const modificationsAllowed = canModify && hasWorkflowRef;
  const modificationBlockedReason = useMemo(() => {
    if (!hasWorkflowRef) {
      return "Create a proposal first to add or edit capital outlay entries.";
    }
    if (!canEdit) {
      return "You don't have permission to modify capital outlay entries.";
    }
    if (locked) {
      return "Capital outlay editing is currently locked.";
    }
    return "";
  }, [hasWorkflowRef, canEdit, locked]);

  // Fetch capital outlays
  const fetchCapitalOutlays = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        region: activeRegion,
        fiscalYear: fiscalYear || new Date().getFullYear(),
      });

      const response = await api.get(`/capital-outlays?${params.toString()}`);
      const data = response.data.capitalOutlays || [];

      setCapitalOutlays(data);
      onDataChange?.(data);
    } catch (err) {
      console.error("Error fetching capital outlays:", err);
      setError(err.message || "Failed to fetch capital outlays");
      toast.error("Failed to load capital outlays");
    } finally {
      setLoading(false);
    }
  }, [activeRegion, fiscalYear, onDataChange]);

  // Fetch categories
  const fetchCategories = useCallback(async () => {
    try {
      const response = await api.get("/categories");
      const categoriesData = response.data || [];
      setCategories(categoriesData);
    } catch (err) {
      console.error("Error fetching categories:", err);
      toast.error("Failed to load categories");
    }
  }, []);

  // Fetch details for a specific capital outlay
  const fetchDetails = useCallback(async (capitalOutlayId) => {
    if (capitalOutlayDetails[capitalOutlayId]) {
      return; // Already loaded
    }

    try {
      setLoadingDetails((prev) => ({ ...prev, [capitalOutlayId]: true }));
      const response = await api.get(`/api/capital-outlay/${capitalOutlayId}/details`);
      const details = response.data.details || [];

      setCapitalOutlayDetails((prev) => ({
        ...prev,
        [capitalOutlayId]: details,
      }));
    } catch (err) {
      console.error("Error fetching details:", err);
      toast.error("Failed to load breakdown details");
    } finally {
      setLoadingDetails((prev) => ({ ...prev, [capitalOutlayId]: false }));
    }
  }, [capitalOutlayDetails]);

  // Toggle mother row expansion
  const handleToggleMother = useCallback((title) => {
    setExpandedMothers((prev) => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(title)) {
        newExpanded.delete(title);
      } else {
        newExpanded.add(title);
      }
      return newExpanded;
    });
  }, []);

  // Toggle subline row expansion
  const handleToggleSubline = useCallback((id) => {
    setExpandedSublines((prev) => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(id)) {
        newExpanded.delete(id);
      } else {
        newExpanded.add(id);
      }
      return newExpanded;
    });
  }, []);

  // Edit detail handler
  const handleEditDetail = useCallback((detail) => {
    setDetailToEdit(detail);
    setEditDialogOpen(true);
  }, []);

  // Save edited detail
  const handleSaveDetail = useCallback(async (detailId, formData) => {
    if (!ensureWorkflowRef()) return;

    const parentId = detailToEdit?.capital_outlay_id || detailToEdit?.capitalOutlay;
    if (!parentId) {
      throw new Error("Parent capital outlay ID not found");
    }

    const existingDetails = capitalOutlayDetails[parentId] || [];

    const updatedDetails = existingDetails.map((detail) => {
      if (detail._id === detailId) {
        return {
          ...detail,
          particulars: formData.particulars,
          income_amount: parseFloat(formData.income_amount) || 0,
          subsidy_amount: parseFloat(formData.subsidy_amount) || 0,
        };
      }
      return detail;
    });

    await api.post(`/api/capital-outlay/${parentId}/details`, {
      details: updatedDetails,
      processBy: currentUser?.username || "System",
      proposalId: workflowRef
    }, { headers: headerConfig() });

    setCapitalOutlayDetails((prev) => {
      const newDetails = { ...prev };
      delete newDetails[parentId];
      return newDetails;
    });

    await fetchDetails(parentId);
    await fetchCapitalOutlays();
  }, [detailToEdit, capitalOutlayDetails, currentUser, fetchDetails, fetchCapitalOutlays, ensureWorkflowRef, workflowRef, headerConfig]);

  // Add new handler
  const handleAddNew = useCallback(async (type, formData) => {
    if (!ensureWorkflowRef()) return;

    if (type === "title" || type === "subline") {
      await api.post("/capital-outlays", {
        ...formData,
        region: activeRegion,
        fiscalYear: fiscalYear || new Date().getFullYear(),
        proposalId: workflowRef
      }, { headers: headerConfig() });
    } else if (type === "detail") {
      const capitalOutlayId = formData.capitalOutlayId;
      const existingDetails = capitalOutlayDetails[capitalOutlayId] || [];

      let detailsList = existingDetails;
      if (detailsList.length === 0) {
        try {
          const response = await api.get(`/api/capital-outlay/${capitalOutlayId}/details`);
          detailsList = response.data.details || [];
        } catch (err) {
          console.error("Error fetching existing details:", err);
          detailsList = [];
        }
      }

      const newDetail = {
        particulars: formData.particulars,
        income_amount: parseFloat(formData.income_amount) || 0,
        subsidy_amount: parseFloat(formData.subsidy_amount) || 0,
      };

      const updatedDetails = [...detailsList, newDetail];

      await api.post(`/api/capital-outlay/${capitalOutlayId}/details`, {
        details: updatedDetails,
        processBy: currentUser?.username || "System",
        proposalId: workflowRef
      }, { headers: headerConfig() });

      setCapitalOutlayDetails((prev) => {
        const newDetails = { ...prev };
        delete newDetails[capitalOutlayId];
        return newDetails;
      });
    }

    await fetchCapitalOutlays();
  }, [activeRegion, fiscalYear, capitalOutlayDetails, currentUser, fetchCapitalOutlays, ensureWorkflowRef, workflowRef, headerConfig]);

  // Initial load
  useEffect(() => {
    fetchCapitalOutlays();
    fetchCategories();
  }, [fetchCapitalOutlays, fetchCategories]);

  // Group data by TITLE (category)
  const groupedData = useMemo(() => {
    const groups = {};
    
    capitalOutlays.forEach((item) => {
      // Get category name
      let categoryName = "-";
      if (item.category?.categoryName) {
        categoryName = item.category.categoryName;
      } else if (item.categoryName) {
        categoryName = item.categoryName;
      } else if (item.category_name) {
        categoryName = item.category_name;
      } else if (Array.isArray(categories) && categories.length > 0 && item.category?._id) {
        const category = categories.find(cat => cat._id === item.category._id);
        if (category?.categoryName) categoryName = category.categoryName;
        else if (category?.name) categoryName = category.name;
      }

      if (!groups[categoryName]) {
        groups[categoryName] = [];
      }
      groups[categoryName].push(item);
    });

    return groups;
  }, [capitalOutlays, categories]);

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Paper sx={{ width: "100%", overflow: "hidden", borderRadius: 2, boxShadow: 3 }}>
      <CustomToolbar 
        onRefresh={fetchCapitalOutlays}
        onAddNew={() => {
          if (!canModify) {
            toast.error(modificationBlockedReason || "Capital outlay editing is currently locked.");
            return;
          }
          if (!ensureWorkflowRef()) return;
          setAddDialogOpen(true);
        }}
        loading={loading}
        locked={!modificationsAllowed}
        lockedReason={modificationBlockedReason}
      />

      {(!hasWorkflowRef || locked) && (
        <Box sx={{ px: 2, pt: 2, display: "flex", flexDirection: "column", gap: 1 }}>
          {!hasWorkflowRef && (
            <Alert severity="warning">
              Create a proposal first to enable capital outlay editing. Existing entries remain read-only.
            </Alert>
          )}
          {locked && (
            <Alert severity="info">
              Capital outlay entries are currently locked for editing by administrators.
            </Alert>
          )}
        </Box>
      )}
      
      <Box sx={{ maxHeight: 600, overflow: "auto" }}>
        {Object.keys(groupedData).length === 0 ? (
          <Box sx={{ p: 4, textAlign: "center" }}>
            <Typography variant="body1" color="text.secondary">
              No capital outlay data available
            </Typography>
          </Box>
        ) : (
          Object.entries(groupedData).map(([title, sublineItems]) => (
            <MotherRow
              key={title}
              title={title}
              sublineItems={sublineItems}
              expandedMothers={expandedMothers}
              expandedSublines={expandedSublines}
              onToggleMother={handleToggleMother}
              onToggleSubline={handleToggleSubline}
              capitalOutlayDetails={capitalOutlayDetails}
              loadingDetails={loadingDetails}
              fetchDetails={fetchDetails}
              canEdit={modificationsAllowed}
              onEditDetail={handleEditDetail}
            />
          ))
        )}
      </Box>

      {/* Add New Dialog */}
      <AddNewDialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        categories={categories}
        capitalOutlays={capitalOutlays}
        onSave={handleAddNew}
        disabled={!modificationsAllowed}
        disabledReason={modificationBlockedReason}
      />

      {/* Edit Detail Dialog */}
      <EditDetailDialog
        open={editDialogOpen}
        onClose={() => {
          setEditDialogOpen(false);
          setDetailToEdit(null);
        }}
        detail={detailToEdit}
        onSave={handleSaveDetail}
        disabled={!modificationsAllowed}
        disabledReason={modificationBlockedReason}
      />
    </Paper>
  );
};

export default CapitalOutlayDataGrid;