import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useUser } from "../../context/UserContext";
import { useRegion } from "../../context/RegionContext";
import { isBRDLevelUser } from "../../constants/roles";
import {
  Box,
  Paper,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableFooter,
  CircularProgress,
  TextField,
  InputAdornment,
  IconButton,
  Chip,
  MenuItem,
  Checkbox,
  Grid,
  Select,
  FormControl,
  InputLabel,
  Skeleton,
} from "@mui/material";
import { toast } from "react-toastify";
import api from "../../config/api";
import "react-toastify/dist/ReactToastify.css";
import ReportPageLayout from "./ReportPageLayout";
import {
  MATRIX_FINANCIAL_COLUMNS,
  MATRIX_PARTICULARS_WIDTH,
  MATRIX_SUBCOLUMN_MIN_WIDTH,
  getMooeMatrixScreenMinimumWidth,
} from "./mooeMatrixLayout";

// Import icons
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import RemoveCircleOutlineIcon from "@mui/icons-material/RemoveCircleOutline";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import GenericPdfPreviewDialog from '../GenericPdfPreviewDialog';
import RefreshIcon from "@mui/icons-material/Refresh";

const EXCEL_MIME_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const EMPTY_MATRIX = { regions: [], rows: [], totalsByRegion: {}, regionalTotal: { income: 0, subsidy: 0, amount: 0, total: 0 } };

const formatMoney = (value) => `₱${Number(value || 0).toLocaleString(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})}`;

const MATRIX_DETAIL_ROW_HEIGHT = 30;

const MatrixFinancialCells = ({
  values = {},
  strong = false,
  groupStart = false,
  backgroundColor = 'inherit',
  borderTop,
  verticalPadding = 0.45,
}) => (
  <>
    {MATRIX_FINANCIAL_COLUMNS.map(({ key }, index) => (
      <TableCell
        key={key}
        align="right"
        sx={{
          width: MATRIX_SUBCOLUMN_MIN_WIDTH,
          minWidth: MATRIX_SUBCOLUMN_MIN_WIDTH,
          px: 0.75,
          py: verticalPadding,
          bgcolor: backgroundColor,
          borderLeft: groupStart && index === 0 ? '2px solid #cbd5e1' : undefined,
          borderTop,
          fontSize: '0.7rem',
          fontWeight: strong ? 800 : 500,
          fontVariantNumeric: 'tabular-nums',
          whiteSpace: 'nowrap',
        }}
      >
        {formatMoney(values[key])}
      </TableCell>
    ))}
  </>
);

const sumMatrixRows = (rows, regionName) => (rows || []).reduce((totals, row) => {
  const values = regionName ? row?.valuesByRegion?.[regionName] : row?.totals;
  totals.income += Number(values?.income || 0);
  totals.subsidy += Number(values?.subsidy || 0);
  totals.amount += Number(values?.amount || 0);
  return totals;
}, { income: 0, subsidy: 0, amount: 0 });

const getConsolidatedMooeTitle = (budgetType) => {
  const normalizedBudgetType = String(budgetType || "INITIAL").trim().toUpperCase();
  return `Consolidated MOOE – ${normalizedBudgetType || "INITIAL"} BUDGET PROPOSAL`;
};

const getResponseFilename = (contentDisposition, fallback) => {
  if (!contentDisposition) return fallback;

  const filenameStarMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (filenameStarMatch?.[1]) return decodeURIComponent(filenameStarMatch[1]);

  const filenameMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
  return filenameMatch?.[1] || fallback;
};

const ConsolidatedReportsPage = () => {
  const { currentUser } = useUser();
  const { activeRegion } = useRegion();
  const queryClient = useQueryClient();

  // State management (Moved up to avoid ReferenceError in hooks below)
  const [expandedRows, setExpandedRows] = useState([]);
  const matrixExpansionKeyRef = useRef("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFilters] = useState({
    dataTypes: [], // MOOE, Corporate Income, etc.
    regions: [],
    amountRange: { min: "", max: "" },
    hasValues: false,
    emptyValues: false
  });
  const [selectedRegions, setSelectedRegions] = useState([]);
  const [selectedCurrentRegion, setSelectedCurrentRegion] = useState(""); // single region when consolidationType === "current"
  const [consolidationType, setConsolidationType] = useState("current"); // current, all, custom
  const [organizationStructure, setOrganizationStructure] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedDivision, setSelectedDivision] = useState("");
  
  // --- ROLE-BASED SCOPING LOGIC ---
  const hierarchical = useMemo(() => currentUser?.hierarchicalAccess || {}, [currentUser?.hierarchicalAccess]);
  const scope = useMemo(() => String(hierarchical.scope || hierarchical.assignmentLevel || "").toUpperCase(), [hierarchical]);
  const isBRD = useMemo(() => isBRDLevelUser(currentUser), [currentUser]);

  // Enforce restriction: restricted roles (Preparer, Reviewer, Approver) are locked to "Current Region Only".
  // Only BRD-level roles (Analyst, Officer, Manager, SuperAdmin) can view All Regions or Custom Selection.
  const isRestricted = useMemo(() => {
    if (!currentUser) return true;
    const roles = (currentUser.Roles || []).map(r => String(r || '').replace(/\s+/g, '_').toUpperCase());
    const hasRestrictedRole = roles.some(r => [
      'BUDGET_PREPARER', 'BUDGET_REVIEWER', 'BUDGET_APPROVER', 
      'REVIEWER', 'APPROVER', 'BUDGET_COORDINATOR'
    ].includes(r));
    const hasBRDRole = roles.some(r => [
      'SUPER_ADMIN', 'SUPERADMIN', 'BUDGET_MANAGER', 
      'BUDGET_OFFICER', 'BUDGET_PLANNING_ANALYST', 
      'OVERALL_BUDGET_APPROVER', 'BUDGET_ADMIN'
    ].includes(r));

    if (hasBRDRole) return false;
    if (hasRestrictedRole) return true;
    return !isBRD;
  }, [currentUser, isBRD]);

  const scopeNormalized = scope.replace(/_/g, ' ').trim();
  const isDepartmentRestricted = useMemo(() => {
    if (['DEPARTMENT', 'DIVISION', 'OFFICE', 'RESPONSIBILITY CENTER'].includes(scopeNormalized)) return true;
    if (isRestricted && scopeNormalized !== 'REGION' && scopeNormalized !== 'CENTRAL') return true;
    return false;
  }, [scopeNormalized, isRestricted]);

  const isDivisionRestricted = useMemo(() => {
    if (['DIVISION', 'RESPONSIBILITY CENTER'].includes(scopeNormalized)) return true;
    if (isRestricted && scopeNormalized !== 'REGION' && scopeNormalized !== 'CENTRAL' && scopeNormalized !== 'DEPARTMENT' && scopeNormalized !== 'OFFICE') return true;
    return false;
  }, [scopeNormalized, isRestricted]);

  // Enforce restrictions based on role/scope
  useEffect(() => {
    if (isRestricted) {
      setConsolidationType((prev) => (prev !== 'current' ? 'current' : prev));
      
      const userRegion = hierarchical.accessibleRegions?.[0]?.regionName || activeRegion?.name || activeRegion?.Region;
      if (userRegion) {
        setSelectedCurrentRegion((prev) => (prev !== userRegion ? userRegion : prev));
      }
      
      if ((scope === 'DEPARTMENT' || scope === 'DIVISION') && hierarchical.accessibleDepartments?.[0]) {
        const userDeptId = String(hierarchical.accessibleDepartments[0]._id || hierarchical.accessibleDepartments[0].id);
        setSelectedDepartment((prev) => (prev !== userDeptId ? userDeptId : prev));
      }
      if (scope === 'DIVISION' && hierarchical.accessibleDivisions?.[0]) {
        const userDiv = hierarchical.accessibleDivisions[0];
        setSelectedDivision((prev) => (prev !== userDiv ? userDiv : prev));
      }
    }
  }, [isRestricted, scope, hierarchical, activeRegion]);
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState("");
  const [pdfFilename, setPdfFilename] = useState("");
  const [pdfLoading, setPdfLoading] = useState(false);
  const [excelLoading, setExcelLoading] = useState(false);

  useEffect(() => {
    return () => {
      if (pdfPreviewUrl) {
        window.URL.revokeObjectURL(pdfPreviewUrl);
      }
    };
  }, [pdfPreviewUrl]);

  // Fetch active settings
  const { data: activeSettings } = useQuery({
    queryKey: ["activeSettings"],
    queryFn: async () => {
      const response = await api.get("/settings/active");
      return response.data;
    },
  });

  // Fetch all regions for selection
  const { data: regions = [] } = useQuery({
    queryKey: ["availableRegions"],
    queryFn: async () => {
      const response = await api.get("/api/consolidated-reports/available-regions");
      return response.data?.regions || [];
    },
    onSuccess: (data) => {
      // When regions first load and we're on "current", default to active region or first region
      if (data?.length && consolidationType === "current" && !selectedCurrentRegion) {
        const name = activeRegion?.name || activeRegion?.Region;
        const match = data.find(r => (r.name || r.Region) === name) ? name : (data[0]?.name || data[0]?.Region || "");
        setSelectedCurrentRegion(match);
      }
    },
    onError: (err) => {
      console.error('Error fetching available regions:', err);
    }
  });

  // Resolve which single region to use for "current" (dropdown selection or active region)
  const effectiveCurrentRegion = selectedCurrentRegion || activeRegion?.name || (regions?.length ? regions[0]?.name : "");
  const selectedDepartmentName = selectedDepartment
    ? (departments.find((d) => String(d._id) === String(selectedDepartment))?.Department || selectedDepartment)
    : "";
  const selectedDivisionName = selectedDivision
    ? (divisions.find((d) => d.name === selectedDivision || String(d._id) === String(selectedDivision))?.name ?? selectedDivision)
    : "";

  useEffect(() => {
    const fetchOrgStructure = async () => {
      try {
        const res = await api.get("/api/hierarchical-rbac/organization-structure", { params: { structure: "old" } });
        setOrganizationStructure(res.data?.data || res.data);
      } catch (_) {
        setOrganizationStructure(null);
      }
    };
    fetchOrgStructure();
  }, []);

  useEffect(() => {
    if (consolidationType !== "current" || !organizationStructure) {
      setDepartments([]);
      setDivisions([]);
      setSelectedDepartment("");
      setSelectedDivision("");
      return;
    }

    const selectedRegionObj = (regions || []).find(
      (r) => (r.name || r.Region || "") === effectiveCurrentRegion
    ) || activeRegion;
    const regionId = String(selectedRegionObj?._id || selectedRegionObj?.id || "");
    const selectedRegionName = (selectedRegionObj?.name || selectedRegionObj?.regionName || selectedRegionObj?.Region || "").trim();
    if (!selectedRegionName) {
      setDepartments([]);
      setSelectedDepartment("");
      setSelectedDivision("");
      return;
    }

    const data = organizationStructure;
    const allDepts = data?.availableUnits?.departments || [];
    const mappings = data?.mappings || [];
    const orgRegions = data?.availableUnits?.regions || [];
    const norm = (s) => String(s || "").trim().toUpperCase();
    const rn = norm(selectedRegionName);
    const isExcludeRegionalAndIMO = rn === "CENTRAL OFFICE" || rn === "MARIIS" || rn === "UPRIIS";
    const excludeNames = isExcludeRegionalAndIMO ? ["REGIONAL OFFICE", "IRRIGATION MANAGEMENT OFFICE"] : [];

    let regionMappings = mappings.filter(
      (m) =>
        (m.regionId && String(m.regionId) === regionId) ||
        (m.regionIds && m.regionIds.includes(regionId)) ||
        (m.regionNames && m.regionNames.some((name) => norm(name) === rn))
    );
    if (regionMappings.length === 0) {
      regionMappings = mappings.filter((m) => norm(m.regionName) === rn);
    }
    if (regionMappings.length === 0 && isExcludeRegionalAndIMO) {
      const matchedOrgRegion = orgRegions.find((r) => norm(r.name || r.Region) === rn);
      if (matchedOrgRegion) {
        const altId = String(matchedOrgRegion.id || matchedOrgRegion._id);
        regionMappings = mappings.filter((m) => m.regionId && String(m.regionId) === altId);
      }
    }
    if (regionMappings.length === 0 && isExcludeRegionalAndIMO && allDepts.length > 0) {
      const depts = allDepts
        .filter((d) => !excludeNames.includes(norm(d.name || d.Department)))
        .map((d) => ({ _id: d.id || d._id, Department: d.name || d.Department, name: d.name || d.Department }));
      setDepartments(depts);
      setSelectedDepartment("");
      setSelectedDivision("");
      return;
    }

    let regionDeptIds = [...new Set(regionMappings.map((m) => m.departmentId?.toString()).filter(Boolean))];
    if (regionDeptIds.length === 0 && allDepts.length > 0 && !isExcludeRegionalAndIMO) {
      regionDeptIds = allDepts.map((d) => String(d.id || d._id));
    }
    const regionDepts = allDepts.filter((d) => {
      const id = d.id || d._id;
      return id && regionDeptIds.includes(String(id)) && !excludeNames.includes(norm(d.name || d.Department));
    });
    const depts = regionDepts.map((d) => ({
      _id: d.id || d._id,
      Department: d.name || d.Department,
      name: d.name || d.Department,
    }));
    setDepartments(depts);
    setSelectedDepartment("");
    setSelectedDivision("");
  }, [organizationStructure, consolidationType, effectiveCurrentRegion, activeRegion, regions]);

  useEffect(() => {
    if (consolidationType !== "current" || !selectedDepartment) {
      setDivisions([]);
      setSelectedDivision("");
      return;
    }
    const selectedRegionObj = (regions || []).find(
      (r) => (r.name || r.Region || "") === effectiveCurrentRegion
    ) || activeRegion;
    const regionId = String(selectedRegionObj?._id || selectedRegionObj?.id || "");
    const params = new URLSearchParams({ departmentId: selectedDepartment });
    if (regionId) params.set("regionId", regionId);
    api.get(`/api/hierarchical-rbac/divisions?${params.toString()}`)
      .then((res) => setDivisions(res.data?.data || res.data || []))
      .catch(() => setDivisions([]));
    setSelectedDivision("");
  }, [selectedDepartment, consolidationType, effectiveCurrentRegion, activeRegion, regions]);

  // Fetch consolidated data
  const { data: reportResult, isLoading: consolidatedLoading } = useQuery({
    queryKey: ["consolidatedReports", effectiveCurrentRegion, selectedRegions, consolidationType, activeSettings?.fiscalYear, activeSettings?.budgetType, selectedDepartmentName, selectedDivisionName],
    queryFn: async () => {
      try {
        let regionsToFetch;
        if (consolidationType === "current") {
          regionsToFetch = [effectiveCurrentRegion].filter(Boolean);
        } else if (consolidationType === "all") {
          regionsToFetch = null; // Don't filter by regions - get all data
        } else {
          regionsToFetch = selectedRegions;
        }

        if (consolidationType !== "all" && (!regionsToFetch || regionsToFetch.length === 0)) {
          return { data: [], matrix: EMPTY_MATRIX };
        }

        // Use the consolidated reports API endpoint
        const apiParams = {
          fiscalYear: activeSettings?.fiscalYear || new Date().getFullYear(),
          budgetType: activeSettings?.budgetType || 'INITIAL',
        };
        
        // Only add regions parameter if we have specific regions to fetch
        if (regionsToFetch) {
          apiParams.regions = regionsToFetch;
        }
        if (consolidationType === "current" && selectedDepartmentName) {
          apiParams.department = selectedDepartmentName;
        }
        if (consolidationType === "current" && selectedDivisionName) {
          apiParams.division = selectedDivisionName;
        }

        const response = await api.get("/api/consolidated-reports/consolidated-data", {
          params: apiParams,
          withCredentials: true
        });

        const rawData = response.data?.data || [];

        // Transform and aggregate data based on consolidation type
        let transformedData;
        
        if (consolidationType === "all" && rawData.length > 0) {
          // Aggregate data from all regions
          const categoryMap = new Map();
          
          rawData.forEach(item => {
            const category = item.category;
            
            if (!categoryMap.has(category)) {
              categoryMap.set(category, {
                id: `all-regions-${category}`,
                region: "ALL REGIONS",
                category: category,
                dataType: 'MOOE',
                total: 0,
                children: new Map() // Use Map to aggregate children by accounting title
              });
            }
            
            const categoryData = categoryMap.get(category);
            categoryData.total += parseFloat(item.total || 0);
            
            // Aggregate children/items
            if (Array.isArray(item.items)) {
              item.items.forEach(child => {
                const key = child.accountingTitle || child.name || child.uacsCode || `${child.id}`;
                
                if (!categoryData.children.has(key)) {
                  categoryData.children.set(key, {
                    id: `all-${key}-${child.id}`,
                    accountingTitle: child.accountingTitle,
                    name: child.name,
                    uacsCode: child.uacsCode,
                    particulars: child.particulars,
                    income: 0,
                    subsidy: 0,
                    amount: 0,
                    total: 0
                  });
                }
                
                const aggregatedChild = categoryData.children.get(key);
                aggregatedChild.income += parseFloat(child.income || 0);
                aggregatedChild.subsidy += parseFloat(child.subsidy || 0);
                aggregatedChild.amount += parseFloat(child.amount || 0);
                aggregatedChild.total += parseFloat(child.total || 0);
              });
            }
          });
          
          // Convert Maps back to arrays
          transformedData = Array.from(categoryMap.values()).map(category => ({
            ...category,
            children: Array.from(category.children.values())
          }));
        } else {
          // Regular transformation for current region or custom selection
          transformedData = rawData.map((item, index) => ({
            id: `${item.region}-${item.category}-${index}`,
            region: item.region,
            category: item.category,
            dataType: 'MOOE',
            total: item.total,
            children: Array.isArray(item.items) ? item.items : []
          }));
        }

        return { data: transformedData, matrix: response.data?.matrix || EMPTY_MATRIX };
      } catch (err) {
        console.error("Error fetching consolidated data:", err);
        throw err;
      }
    },
    enabled: (() => {
      const enabled = Boolean(
        activeSettings && (
          (consolidationType === "current" && effectiveCurrentRegion) ||
          (consolidationType === "all") ||
          (consolidationType === "custom" && selectedRegions.length > 0)
        )
      );
      return enabled;
    })(),
    onError: (err) => {
      console.error("Error fetching consolidated data:", err);
      console.error("Full error details:", {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status
      });
      console.error("Full error details:", {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status
      });
      toast.error("Failed to load consolidated data");
    },
  });
  const consolidatedData = useMemo(() => reportResult?.data || [], [reportResult?.data]);
  const allRegionsMatrix = useMemo(() => reportResult?.matrix || EMPTY_MATRIX, [reportResult?.matrix]);

  // Filter and sort data
  const filteredData = useMemo(() => {
    if (!consolidatedData) return [];

    const filtered = consolidatedData.filter(row => {
      // Search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const matchesCategory = row.category?.toLowerCase().includes(searchLower);
        const matchesDataType = row.dataType?.toLowerCase().includes(searchLower);
        const matchesRegion = row.region?.toLowerCase().includes(searchLower);
        const matchesChildren = (row.children || []).some(child =>
          child.accountingTitle?.toLowerCase().includes(searchLower) ||
          child.name?.toLowerCase().includes(searchLower) ||
          child.uacsCode?.toLowerCase().includes(searchLower) ||
          child.particulars?.toLowerCase().includes(searchLower)
        );
        if (!matchesCategory && !matchesDataType && !matchesRegion && !matchesChildren) return false;
      }

      // Data type filter
      if (selectedFilters.dataTypes.length > 0) {
        if (!selectedFilters.dataTypes.includes(row.dataType)) return false;
      }

      return true;
    });

    // Sort each row's children by UACS code, with IAs O&M Cost at the end
    filtered.forEach(row => {
      if (row.children && Array.isArray(row.children)) {
        row.children.sort((a, b) => {
          const aIsIAs = a.accountingTitle && a.accountingTitle.toLowerCase().includes("irrigators' associations") && 
                         a.accountingTitle.toLowerCase().includes("operation") && 
                         a.accountingTitle.toLowerCase().includes("maintenance");
          const bIsIAs = b.accountingTitle && b.accountingTitle.toLowerCase().includes("irrigators' associations") && 
                         b.accountingTitle.toLowerCase().includes("operation") && 
                         b.accountingTitle.toLowerCase().includes("maintenance");
          
          // If one is IAs O&M and the other is not, put IAs O&M at the end
          if (aIsIAs && !bIsIAs) return 1;
          if (!aIsIAs && bIsIAs) return -1;
          
          // If both are IAs O&M or both are not, sort by UACS code
          const aUacs = a.uacsCode || '';
          const bUacs = b.uacsCode || '';
          return aUacs.localeCompare(bUacs);
        });
      }
    });

    // Sort category groups by their minimum UACS code
    filtered.sort((a, b) => {
      const getMinUacs = (row) => {
        if (!row.children || !Array.isArray(row.children) || row.children.length === 0) return '';
        return row.children.reduce((min, child) => {
          const u = (child.uacsCode || '').toString();
          return (!min || u.padStart(20, '0') < min.padStart(20, '0')) ? u : min;
        }, '');
      };
      const aMinUacs = getMinUacs(a);
      const bMinUacs = getMinUacs(b);
      const uacsCompare = aMinUacs.padStart(20, '0').localeCompare(bMinUacs.padStart(20, '0'));
      if (uacsCompare !== 0) return uacsCompare;
      return (a.category || '').localeCompare(b.category || '');
    });

    return filtered;
  }, [consolidatedData, searchTerm, selectedFilters]);

  const filteredMatrixRows = useMemo(() => {
    if (consolidationType !== 'all') return [];
    const search = searchTerm.trim().toLowerCase();
    return (allRegionsMatrix.rows || []).filter((row) => {
      if (!search) return true;
      return [row.category, row.uacsCode, row.accountingTitle]
        .some((value) => String(value || '').toLowerCase().includes(search));
    });
  }, [allRegionsMatrix.rows, consolidationType, searchTerm]);

  const matrixCategoryGroups = useMemo(() => {
    const categoryMap = new Map();
    filteredMatrixRows.forEach((row) => {
      const category = row.category || 'Uncategorized';
      if (!categoryMap.has(category)) categoryMap.set(category, []);
      categoryMap.get(category).push(row);
    });
    return [...categoryMap.entries()].map(([category, rows]) => ({
      id: `all-regions-${category}`,
      category,
      rows,
    }));
  }, [filteredMatrixRows]);

  const matrixExpansionKey = useMemo(
    () => (allRegionsMatrix.rows || []).map((row) => row.id).join("\u001e"),
    [allRegionsMatrix.rows]
  );

  useEffect(() => {
    if (consolidationType !== 'all' || !matrixExpansionKey || matrixExpansionKeyRef.current === matrixExpansionKey) {
      return;
    }

    const categoryIds = [...new Set((allRegionsMatrix.rows || []).map((row) => `all-regions-${row.category || 'Uncategorized'}`))];
    setExpandedRows(categoryIds);
    matrixExpansionKeyRef.current = matrixExpansionKey;
  }, [allRegionsMatrix.rows, consolidationType, matrixExpansionKey]);

  // const visibleTotals = useMemo(() => {
  //   let income = 0;
  //   let subsidy = 0;
  //   let amount = 0;

  //   if (consolidationType === 'all') {
  //     filteredMatrixRows.forEach((row) => {
  //       income += Number(row?.totals?.income || 0);
  //       subsidy += Number(row?.totals?.subsidy || 0);
  //       amount += Number(row?.totals?.amount || 0);
  //     });
  //   } else {
  //     filteredData.forEach((row) => {
  //       (row?.children || []).forEach((child) => {
  //         income += parseFloat(child?.income || 0);
  //         subsidy += parseFloat(child?.subsidy || 0);
  //         amount += parseFloat(child?.amount || 0);
  //       });
  //     });
  //   }

  //   return { income, subsidy, amount, total: income + subsidy + amount };
  // }, [consolidationType, filteredData, filteredMatrixRows]);

const visibleTotals = useMemo(() => {
  let income = 0;
  let subsidy = 0;

  if (consolidationType === 'all') {
    filteredMatrixRows.forEach((row) => {
      income += Number(row?.totals?.income || 0);
      subsidy += Number(row?.totals?.subsidy || 0);
    });
  } else {
    filteredData.forEach((row) => {
      (row?.children || []).forEach((child) => {
        income += parseFloat(child?.income || 0);
        subsidy += parseFloat(child?.subsidy || 0);
      });
    });
  }

  const grandTotal = income + subsidy;

  return {
    income,
    subsidy,
    amount: grandTotal, // Equal to Income + Subsidy
    total: grandTotal   // Equal to Income + Subsidy
  };
}, [consolidationType, filteredData, filteredMatrixRows]);

  const visibleCategoryCount = consolidationType === 'all' ? matrixCategoryGroups.length : filteredData.length;
  const visibleLineItemCount = consolidationType === 'all'
    ? filteredMatrixRows.length
    : filteredData.reduce((sum, row) => sum + (row.children?.length || 0), 0);
  const matrixVisibleTotalsByRegion = useMemo(() => {
    const totals = Object.fromEntries(
      (allRegionsMatrix.regions || []).map((regionName) => [regionName, { income: 0, subsidy: 0 }])
    );
    filteredMatrixRows.forEach((row) => {
      Object.entries(row.valuesByRegion || {}).forEach(([regionName, values]) => {
        if (!totals[regionName]) return;
        totals[regionName].income += Number(values.income || 0);
        totals[regionName].subsidy += Number(values.subsidy || 0);

      });
    });
    return totals;
  }, [allRegionsMatrix.regions, filteredMatrixRows]);

  const hasActiveViewFilter = Boolean(searchTerm.trim() || selectedFilters.dataTypes.length > 0);

  // Toggle expand row
  const toggleExpandRow = useCallback((rowId) => {
    setExpandedRows(prev => 
      prev.includes(rowId) 
        ? prev.filter(id => id !== rowId)
        : [...prev, rowId]
    );
  }, []);

  // Handle region selection
  const handleRegionChange = (event) => {
    setSelectedRegions(event.target.value);
  };

  // Handle consolidation type change
  const handleConsolidationTypeChange = (event) => {
    const value = event.target.value;
    setConsolidationType(value);
    if (value !== "custom") {
      setSelectedRegions([]);
    }
    if (value === "current" && regions?.length && !selectedCurrentRegion) {
      const name = activeRegion?.name || activeRegion?.Region;
      const match = regions.find(r => (r.name || r.Region) === name);
      setSelectedCurrentRegion(match ? (match.name || match.Region) : (regions[0]?.name || regions[0]?.Region || ""));
    }
  };

  const handleCurrentRegionChange = (event) => {
    setSelectedCurrentRegion(event.target.value);
  };

  // Refresh data
  const handleRefresh = () => {
    queryClient.invalidateQueries(["consolidatedReports"]);
    toast.info("Data refreshed");
  };

  // Expand/Collapse all
  const toggleExpandAll = () => {
    const visibleGroups = consolidationType === 'all' ? matrixCategoryGroups : filteredData;
    if (expandedRows.length === visibleGroups.length) {
      setExpandedRows([]);
    } else {
      setExpandedRows(visibleGroups.map(row => row.id));
    }
  };

  const isLoading = consolidatedLoading;
  const hasReportData = Array.isArray(consolidatedData) && consolidatedData.length > 0;
  const canPreviewPdf = !pdfLoading && !isLoading && hasReportData;
  const canExportExcel = !excelLoading && !isLoading && hasReportData;
  const hasVisibleRows = consolidationType === 'all' ? filteredMatrixRows.length > 0 : filteredData.length > 0;

  const buildReportParams = (format) => {
    let regionsToFetch;
    if (consolidationType === "current") {
      regionsToFetch = [effectiveCurrentRegion].filter(Boolean);
    } else if (consolidationType === "all") {
      regionsToFetch = null;
    } else {
      regionsToFetch = selectedRegions;
    }

    const params = new URLSearchParams();
    const fiscalYear = activeSettings?.fiscalYear || new Date().getFullYear();
    const budgetType = activeSettings?.budgetType || "INITIAL";
    if (format) params.append("format", format);
    params.append("consolidationType", consolidationType);
    params.append("fiscalYear", fiscalYear);
    params.append("budgetType", budgetType);
    if (regionsToFetch?.length) {
      regionsToFetch.forEach((region) => params.append("regions", region));
    }
    if (consolidationType === "current" && selectedDepartmentName) {
      params.append("department", selectedDepartmentName);
    }
    if (consolidationType === "current" && selectedDivisionName) {
      params.append("division", selectedDivisionName);
    }

    return { params, fiscalYear, budgetType };
  };

  const closePdfDialog = () => {
    setPdfDialogOpen(false);
    if (pdfPreviewUrl) {
      window.URL.revokeObjectURL(pdfPreviewUrl);
      setPdfPreviewUrl("");
    }
  };

  const handlePreviewPdf = async () => {
    try {
      setPdfLoading(true);
      const { params, fiscalYear } = buildReportParams();

      const response = await api.get(`/api/consolidated-reports/consolidated-data-pdf?${params.toString()}`, {
        responseType: "blob",
      });

      const filename = getResponseFilename(
        response.headers['content-disposition'],
        `Consolidated_MOOE_${fiscalYear}.pdf`
      );
      setPdfFilename(filename);

      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      if (pdfPreviewUrl) window.URL.revokeObjectURL(pdfPreviewUrl);
      setPdfPreviewUrl(url);
      setPdfDialogOpen(true);
    } catch (err) {
      console.error("Error generating consolidated MOOE PDF preview:", err);
      toast.error("Failed to generate PDF preview.");
    } finally {
      setPdfLoading(false);
    }
  };

  const handleExportExcel = async () => {
    try {
      setExcelLoading(true);
      const { params, fiscalYear, budgetType } = buildReportParams("xlsx");
      const response = await api.get(
        `/api/consolidated-reports/export?${params.toString()}`,
        { responseType: "blob" }
      );
      const filename = getResponseFilename(
        response.headers['content-disposition'],
        `Consolidated_MOOE_${fiscalYear}_${budgetType}.xlsx`
      );
      const blob = new Blob([response.data], { type: EXCEL_MIME_TYPE });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Excel report downloaded successfully.");
    } catch (err) {
      console.error("Error exporting consolidated MOOE report:", err);
      toast.error("Failed to export the Excel report. Please try again.");
    } finally {
      setExcelLoading(false);
    }
  };

  return (
    <ReportPageLayout
      title={getConsolidatedMooeTitle(activeSettings?.budgetType)}
      showNiaBranding={true}
      breadcrumbLabel="Consolidated MOOE"
      fiscalYear={activeSettings?.fiscalYear || new Date().getFullYear()}
    >
      <Paper
        className="report-no-print"
        elevation={0}
        sx={{ p: 2, mb: 2.5, border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}
      >
        <Grid container spacing={1.5} alignItems="center">
          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Consolidation Type</InputLabel>
              <Select
                value={consolidationType}
                onChange={handleConsolidationTypeChange}
                label="Consolidation Type"
                disabled={isRestricted}
              >
                <MenuItem value="current">Current Region Only</MenuItem>
                {!isRestricted && <MenuItem value="all">All Regions</MenuItem>}
                {!isRestricted && <MenuItem value="custom">Custom Selection</MenuItem>}
              </Select>
            </FormControl>
          </Grid>

          {consolidationType === "current" && (
            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Region</InputLabel>
                <Select
                  value={selectedCurrentRegion || effectiveCurrentRegion || ""}
                  onChange={handleCurrentRegionChange}
                  label="Region"
                  disabled={isRestricted}
                >
                  {(regions || []).map((region) => {
                    const name = region.name || region.Region || "";
                    return (
                      <MenuItem key={region.id || region._id || name} value={name}>
                        {name}
                      </MenuItem>
                    );
                  })}
                </Select>
              </FormControl>
            </Grid>
          )}

          {consolidationType === "custom" && (
            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Select Regions</InputLabel>
                <Select
                  multiple
                  value={selectedRegions}
                  onChange={handleRegionChange}
                  disabled={isRestricted}
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {selected.map((value) => (
                        <Chip key={value} label={value} size="small" />
                      ))}
                    </Box>
                  )}
                >
                  {regions.map((region, idx) => {
                    const regionName = region.name || region.Region || (typeof region === 'string' ? region : '');
                    const key = region.id || region._id || regionName || idx;
                    return (
                      <MenuItem key={key} value={regionName}>
                        <Checkbox checked={selectedRegions.indexOf(regionName) > -1} />
                        {regionName}
                      </MenuItem>
                    );
                  })}
                </Select>
              </FormControl>
            </Grid>
          )}

          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Department</InputLabel>
              <Select
                value={String(selectedDepartment ?? "")}
                onChange={(e) => {
                  setSelectedDepartment(e.target.value || "");
                  setSelectedDivision("");
                }}
                label="Department"
                disabled={consolidationType !== "current" || !effectiveCurrentRegion || departments.length === 0 || isDepartmentRestricted}
              >
                <MenuItem value=""><em>All Departments</em></MenuItem>
                {departments.map((dept, idx) => {
                  const val = dept._id != null ? String(dept._id) : `dept-${idx}`;
                  return (
                    <MenuItem key={val} value={val}>
                      {dept.Department || dept.name || "Unnamed Department"}
                    </MenuItem>
                  );
                })}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Division</InputLabel>
              <Select
                value={String(selectedDivision ?? "")}
                onChange={(e) => setSelectedDivision(e.target.value || "")}
                label="Division"
                disabled={consolidationType !== "current" || !selectedDepartment || divisions.length === 0 || isDivisionRestricted}
              >
                <MenuItem value=""><em>All Divisions</em></MenuItem>
                {divisions.map((div, idx) => {
                  const val = div.name != null && div.name !== "" ? String(div.name) : (div._id != null ? String(div._id) : `div-${idx}`);
                  return (
                    <MenuItem key={val} value={val}>
                      {div.name || "Unnamed Division"}
                    </MenuItem>
                  );
                })}
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search categories, titles, regions, or codes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
                endAdornment: searchTerm && (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setSearchTerm("")}>
                      <ClearIcon />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </Grid>

          <Grid item xs={12} md={8}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: { md: 'flex-end' }, gap: 1 }}>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={handleRefresh}
                disabled={isLoading}
                size="small"
              >
                Refresh
              </Button>
              <Button
                variant="outlined"
                color="error"
                startIcon={pdfLoading ? <CircularProgress size={16} color="inherit" /> : <PictureAsPdfIcon />}
                onClick={handlePreviewPdf}
                disabled={!canPreviewPdf}
                size="small"
              >
                PDF Preview
              </Button>
              <Button
                variant="contained"
                startIcon={excelLoading ? <CircularProgress size={16} color="inherit" /> : <FileDownloadIcon />}
                onClick={handleExportExcel}
                disabled={!canExportExcel}
                size="small"
              >
                {excelLoading ? "Exporting..." : "Export Excel"}
              </Button>
            </Box>
          </Grid>
        </Grid>

        {/* Action buttons */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, mt: 1.5 }}>
          <Button
            variant={consolidationType === 'all' ? "contained" : "outlined"}
            onClick={toggleExpandAll}
            size="small"
          >
            {expandedRows.length === visibleCategoryCount
              ? (consolidationType === 'all' ? "Collapse all details" : "Collapse All")
              : (consolidationType === 'all' ? "Expand all details" : "Expand All")}
          </Button>
          <Typography variant="body2" color="text.secondary" sx={{ ml: { sm: 1 } }}>
            Showing {visibleCategoryCount} categories
          </Typography>
        </Box>
      </Paper>

      <Paper
        className="report-summary"
        elevation={0}
        sx={{
          mb: 2.5,
          p: { xs: 2, md: 2.5 },
          border: '1px solid',
          borderColor: 'primary.light',
          borderLeft: '5px solid',
          borderLeftColor: 'primary.main',
          borderRadius: 1.5,
          bgcolor: 'rgba(55, 94, 56, 0.07)',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            justifyContent: 'space-between',
            alignItems: { xs: 'flex-start', md: 'center' },
            gap: 2,
          }}
        >
          <Box>
            <Typography variant="overline" sx={{ color: 'primary.dark', fontWeight: 700, letterSpacing: '0.08em' }}>
              Regional Total
            </Typography>
            <Typography
              variant="h4"
              sx={{ color: 'primary.dark', fontWeight: 700, fontVariantNumeric: 'tabular-nums', lineHeight: 1.15 }}
            >
              ₱{(visibleTotals.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {hasActiveViewFilter
                ? `Filtered view · Combined total for ${visibleCategoryCount} visible categories`
                : 'Combined Income and Subsidy'}
            </Typography>
          </Box>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'repeat(2, minmax(120px, 1fr))', sm: 'repeat(5, auto)' },
              gap: { xs: 1, sm: 2.5 },
              width: { xs: '100%', md: 'auto' },
            }}
          >
            {[
              ['Income', visibleTotals.income || 0, true],
              ['Subsidy', visibleTotals.subsidy || 0, true],
              ['Amount', visibleTotals.amount || 0, true],
              ['Categories', visibleCategoryCount, false],
              ['Line items', visibleLineItemCount, false],
            ].map(([label, value, isMoney]) => (
              <Box key={label}>
                <Typography variant="caption" color="text.secondary" display="block">
                  {label}
                </Typography>
                <Typography variant="body2" fontWeight={600} sx={{ fontVariantNumeric: 'tabular-nums' }}>
                  {isMoney
                    ? `₱${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : value.toLocaleString()}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      </Paper>

      {/* Main Table */}
      <Paper
        className="report-section"
        elevation={0}
        sx={{ borderRadius: 1.5, overflow: "hidden", border: '1px solid', borderColor: 'divider' }}
      >
        {isLoading ? (
          <Box sx={{ p: 3 }}>
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} variant="rectangular" height={40} sx={{ mb: 1, borderRadius: 1 }} />
            ))}
          </Box>
        ) : !hasVisibleRows ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', p: 4 }}>
            <Typography variant="h6" color="text.secondary">
              No data available
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {consolidationType === "all" 
                ? "No consolidated data found for all regions. Please check if regions have data."
                : consolidationType === "current" && !activeRegion
                ? "Please select a region first."
                : "No data found for the selected criteria."}
            </Typography>
            <Button 
              variant="outlined" 
              onClick={handleRefresh} 
              sx={{ mt: 2 }}
              startIcon={<RefreshIcon />}
            >
              Refresh Data
            </Button>
          </Box>
        ) : consolidationType === 'all' ? (
          <>
            <Box
              className="report-no-print"
              sx={{
                display: { xs: 'flex', sm: 'none' },
                alignItems: 'center',
                px: 1.5,
                py: 0.75,
                color: 'text.secondary',
                bgcolor: '#f8fafc',
                borderBottom: '1px solid',
                borderColor: 'divider',
                fontSize: '0.72rem',
              }}
            >
              Swipe horizontally to compare regions. The Particulars column scrolls on narrow screens.
            </Box>
            <TableContainer
              className="report-table-container"
              sx={{ maxHeight: { xs: 'none', md: 'calc(100vh - 340px)' }, overflow: 'auto' }}
            >
            <Table
              stickyHeader
              size="small"
              aria-label="All Regions MOOE comparison matrix"
              sx={{
                width: '100%',
                minWidth: `max(100%, ${getMooeMatrixScreenMinimumWidth(allRegionsMatrix.regions?.length)}px)`,
                tableLayout: 'fixed',
                fontVariantNumeric: 'tabular-nums',
                '& .matrix-sticky': { position: 'sticky', zIndex: 3, bgcolor: 'background.paper' },
                '& thead .matrix-sticky': { zIndex: 6, bgcolor: '#f4f7f5' },
                '& tfoot .matrix-sticky': { zIndex: 5, bgcolor: '#f4f7f5' },
                '@media (max-width: 599.95px)': {
                  '& .matrix-sticky': {
                    position: 'static',
                    left: 'auto',
                    zIndex: 'auto',
                  },
                },
              }}
            >
              <TableHead>
                <TableRow className="report-column-header" sx={{ height: 30 }}>
                  <TableCell
                    className="matrix-sticky"
                    rowSpan={2}
                    scope="col"
                    sx={{ left: 0, top: 0, width: MATRIX_PARTICULARS_WIDTH, minWidth: MATRIX_PARTICULARS_WIDTH, py: 0.5, fontWeight: 800, borderRight: '2px solid #94a3b8', borderBottom: '2px solid #94a3b8', verticalAlign: 'middle' }}
                  >
                    Particulars
                  </TableCell>
                  {(allRegionsMatrix.regions || []).map((regionName) => (
                    <TableCell
                      key={regionName}
                      colSpan={3}
                      scope="colgroup"
                      align="center"
                      sx={{
                        width: MATRIX_FINANCIAL_COLUMNS.length * MATRIX_SUBCOLUMN_MIN_WIDTH,
                        minWidth: MATRIX_FINANCIAL_COLUMNS.length * MATRIX_SUBCOLUMN_MIN_WIDTH,
                        bgcolor: '#f4f7f5',
                        borderLeft: '2px solid #94a3b8',
                        borderBottom: '1px solid #cbd5e1',
                        py: 0.5,
                      }}
                    >
                      <Typography variant="caption" sx={{ display: 'block', fontSize: '0.7rem', fontWeight: 800, lineHeight: 1.2, overflowWrap: 'anywhere' }}>
                        {regionName}
                      </Typography>
                    </TableCell>
                  ))}
                  <TableCell
                    colSpan={3}
                    scope="colgroup"
                    align="center"
                    sx={{
                      width: MATRIX_FINANCIAL_COLUMNS.length * MATRIX_SUBCOLUMN_MIN_WIDTH,
                      minWidth: MATRIX_FINANCIAL_COLUMNS.length * MATRIX_SUBCOLUMN_MIN_WIDTH,
                      bgcolor: 'rgba(55, 94, 56, 0.1)',
                      borderLeft: '2px solid #94a3b8',
                      borderBottom: '1px solid #cbd5e1',
                      py: 0.5,
                    }}
                  >
                    <Typography variant="caption" sx={{ display: 'block', fontSize: '0.7rem', fontWeight: 900, lineHeight: 1.2 }}>
                      REGIONAL TOTAL
                    </Typography>
                  </TableCell>
                </TableRow>
                <TableRow className="report-column-header">
                  {[...(allRegionsMatrix.regions || []), 'regional-total'].flatMap((groupName) => (
                    MATRIX_FINANCIAL_COLUMNS.map(({ key, label }, index) => (
                      <TableCell
                        key={`${groupName}-${key}`}
                        scope="col"
                        align="center"
                        sx={{
                          top: 30,
                          width: MATRIX_SUBCOLUMN_MIN_WIDTH,
                          minWidth: MATRIX_SUBCOLUMN_MIN_WIDTH,
                          px: 0.5,
                          py: 0.4,
                          bgcolor: groupName === 'regional-total' ? 'rgba(55, 94, 56, 0.1)' : '#f4f7f5',
                          borderLeft: index === 0 ? '2px solid #94a3b8' : undefined,
                          borderBottom: '2px solid #94a3b8',
                          color: 'text.secondary',
                          fontSize: '0.62rem',
                          fontWeight: 800,
                          letterSpacing: '0.04em',
                          textTransform: 'uppercase',
                        }}
                      >
                        {label}
                      </TableCell>
                    ))
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {matrixCategoryGroups.map((group) => {
                  const expanded = expandedRows.includes(group.id);
                  return (
                    <React.Fragment key={group.id}>
                      <TableRow
                        hover
                        onClick={() => toggleExpandRow(group.id)}
                        sx={{ height: 34, bgcolor: expanded ? 'rgba(55, 94, 56, 0.09)' : 'rgba(55, 94, 56, 0.05)', cursor: 'pointer' }}
                      >
                        <TableCell className="matrix-sticky" sx={{ left: 0, py: 0.55, fontWeight: 800, lineHeight: 1.25, bgcolor: 'inherit', borderRight: '2px solid #cbd5e1' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <IconButton className="report-expansion-control" size="small" sx={{ p: 0.15, color: 'primary.main' }}>
                              {expanded ? <RemoveCircleOutlineIcon fontSize="small" /> : <AddCircleOutlineIcon fontSize="small" />}
                            </IconButton>
                            {group.category}
                          </Box>
                        </TableCell>
                        {(allRegionsMatrix.regions || []).map((regionName) => (
                          <MatrixFinancialCells
                            key={regionName}
                            values={sumMatrixRows(group.rows, regionName)}
                            strong
                            groupStart
                            verticalPadding={0.55}
                          />
                        ))}
                        <MatrixFinancialCells
                          values={sumMatrixRows(group.rows)}
                          strong
                          groupStart
                          backgroundColor="rgba(55, 94, 56, 0.08)"
                          verticalPadding={0.55}
                        />
                      </TableRow>
                      {group.rows.map((row) => (
                        <TableRow
                          className="report-detail-row"
                          key={row.id}
                          sx={{ height: MATRIX_DETAIL_ROW_HEIGHT, display: expanded ? 'table-row' : 'none', '&:hover': { bgcolor: 'rgba(55, 94, 56, 0.025)' } }}
                        >
                          <TableCell className="matrix-sticky" sx={{ left: 0, pl: 4, py: 0.45, bgcolor: 'background.paper', borderRight: '2px solid #e2e8f0', fontSize: '0.76rem', fontWeight: 400, lineHeight: 1.3, overflowWrap: 'anywhere' }}>
                            {row.accountingTitle || '—'}
                          </TableCell>
                          {(allRegionsMatrix.regions || []).map((regionName) => (
                            <MatrixFinancialCells
                              key={regionName}
                              values={row.valuesByRegion?.[regionName]}
                              groupStart
                            />
                          ))}
                          <MatrixFinancialCells
                            values={row.totals}
                            strong
                            groupStart
                            backgroundColor="rgba(55, 94, 56, 0.035)"
                          />
                        </TableRow>
                      ))}
                    </React.Fragment>
                  );
                })}
              </TableBody>
              <TableFooter>
                <TableRow className="report-total-row" sx={{ height: 34 }}>
                  <TableCell className="matrix-sticky" sx={{ left: 0, py: 0.6, bgcolor: '#f4f7f5', fontWeight: 900, borderTop: '2px solid #64748b', borderRight: '2px solid #94a3b8' }}>
                    REGIONAL TOTAL
                  </TableCell>
                  {(allRegionsMatrix.regions || []).map((regionName) => (
                    <MatrixFinancialCells
                      key={regionName}
                      values={matrixVisibleTotalsByRegion[regionName]}
                      strong
                      groupStart
                      backgroundColor="#f4f7f5"
                      borderTop="2px solid #64748b"
                      verticalPadding={0.6}
                    />
                  ))}
                  <MatrixFinancialCells
                    values={visibleTotals}
                    strong
                    groupStart
                    backgroundColor="rgba(55, 94, 56, 0.1)"
                    borderTop="2px solid #64748b"
                    verticalPadding={0.6}
                  />
                </TableRow>
              </TableFooter>
            </Table>
            </TableContainer>
          </>
        ) : (
          <TableContainer
            className="report-table-container"
            sx={{ maxHeight: { xs: 'none', md: 'calc(100vh - 360px)' }, overflowX: 'auto' }}
          >
            <Table stickyHeader size="small" sx={{ minWidth: 900, fontVariantNumeric: 'tabular-nums' }}>
              <colgroup>
                <col style={{ width: '5%' }} />
                <col style={{ width: '18%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '30%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '11%' }} />
              </colgroup>
              <TableHead>
                <TableRow>
                  {[
                    "",
                    "REGION",
                    "UACS CODE",
                    "ACCOUNTING TITLE / LINE ITEM",
                    "INCOME",
                    "SUBSIDY",
                    "AMOUNT",
                  ].map((headCell, index) => (
                    <TableCell
                      key={index}
                      sx={{
                        backgroundColor: "#f8fafc",
                        color: "#475569",
                        fontWeight: 700,
                        padding: "9px 10px",
                        borderBottom: "2px solid #e2e8f0",
                        textAlign: index >= 4 ? "right" : "center",
                        fontSize: "0.75rem",
                        letterSpacing: "0.5px",
                        textTransform: "uppercase",
                      }}
                    >
                      {headCell}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredData?.map((row) => {
                  // Debug: Check if row and children exist
                  
                  if (!row) return null;
                  
                  return (
                  <React.Fragment key={row.id}>
                    {/* Parent row */}
                    <TableRow
                      sx={{
                        backgroundColor: expandedRows.includes(row.id) ? "rgba(55, 94, 56, 0.08)" : "rgba(55, 94, 56, 0.04)",
                        '&:hover': { backgroundColor: "rgba(55, 94, 56, 0.12)" }
                      }}
                    >
                      <TableCell sx={{ padding: "8px 12px" }}>
                        <IconButton
                          className="report-expansion-control"
                          size="small"
                          onClick={() => toggleExpandRow(row.id)}
                          sx={{ color: "#375e38" }}
                        >
                          {expandedRows.includes(row.id) ? <RemoveCircleOutlineIcon /> : <AddCircleOutlineIcon />}
                        </IconButton>
                      </TableCell>
                      <TableCell sx={{ fontWeight: "bold", textAlign: "center", padding: "8px 12px", fontSize: "0.875rem" }}>
                        {row.region}
                      </TableCell>
                      <TableCell sx={{ fontWeight: "bold", textAlign: "center", padding: "8px 12px" }}>
                        <Chip 
                          label="MOOE" 
                          size="small" 
                          color="primary"
                          sx={{ fontSize: "0.75rem" }}
                        />
                      </TableCell>
                      <TableCell sx={{ fontWeight: "bold", padding: "8px 12px", fontSize: "0.875rem" }}>
                        {row.category}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: "bold", padding: "8px 12px", fontSize: "0.875rem", fontVariantNumeric: 'tabular-nums' }}>
                        ₱{(row.children || []).reduce((sum, child) => sum + parseFloat(child.income || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: "bold", padding: "8px 12px", fontSize: "0.875rem", fontVariantNumeric: 'tabular-nums' }}>
                        ₱{(row.children || []).reduce((sum, child) => sum + parseFloat(child.subsidy || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: "bold", padding: "8px 12px", fontSize: "0.875rem", fontVariantNumeric: 'tabular-nums' }}>
                        ₱{(row.children || []).reduce((sum, child) => sum + parseFloat(child.amount || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>

                    {/* Child rows */}
                    {(row.children || []).map((child) => (
                      <TableRow
                        className="report-detail-row"
                        key={child.id}
                        sx={{
                          display: expandedRows.includes(row.id) ? 'table-row' : 'none',
                          '&:hover': { backgroundColor: "rgba(55, 94, 56, 0.04)" },
                        }}
                      >
                        <TableCell sx={{ padding: "6px 12px" }}></TableCell>
                        <TableCell sx={{ textAlign: "center", fontSize: "0.8rem", color: "#666", padding: "6px 12px" }}>
                          {child.region || row.region}
                        </TableCell>
                        <TableCell sx={{ textAlign: "center", fontSize: "0.8rem", color: "#666", padding: "6px 12px" }}>
                          {child.uacsCode || ""}
                        </TableCell>
                        <TableCell sx={{ fontSize: "0.8rem", paddingLeft: "20px", padding: "6px 12px 6px 20px" }}>
                          {child.accountingTitle || child.lineItem || child.name}
                        </TableCell>
                        <TableCell align="right" sx={{ fontSize: "0.8rem", padding: "6px 12px", color: "#333", fontVariantNumeric: 'tabular-nums' }}>
                          ₱{parseFloat(child.income || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell align="right" sx={{ fontSize: "0.8rem", padding: "6px 12px", color: "#333", fontVariantNumeric: 'tabular-nums' }}>
                          ₱{parseFloat(child.subsidy || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell align="right" sx={{ fontSize: "0.8rem", padding: "6px 12px", color: "#333", fontVariantNumeric: 'tabular-nums' }}>
                          ₱{parseFloat(child.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </React.Fragment>
                  );
                })}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell
                    colSpan={4}
                    align="right"
                    sx={{
                      bgcolor: '#f8fafc',
                      color: '#1e293b',
                      fontWeight: 800,
                      py: 1.5,
                      borderTop: '2px solid #94a3b8',
                      fontSize: '0.8rem',
                      letterSpacing: '0.04em',
                    }}
                  >
                    REGIONAL TOTAL
                  </TableCell>
                  {['income', 'subsidy', 'amount'].map((key) => (
                    <TableCell
                      key={key}
                      align="right"
                      sx={{
                        bgcolor: '#f8fafc',
                        color: '#1e293b',
                        fontWeight: 800,
                        py: 1.5,
                        borderTop: '2px solid #94a3b8',
                        fontSize: '0.8rem',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      ₱{(visibleTotals[key] || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                  ))}
                </TableRow>
              </TableFooter>
            </Table>
          </TableContainer>
        )}

      </Paper>

      <GenericPdfPreviewDialog
        open={pdfDialogOpen}
        onClose={closePdfDialog}
        pdfUrl={pdfPreviewUrl}
        title="Consolidated MOOE PDF Preview"
        downloadFilename={pdfFilename}
      />

    </ReportPageLayout>
  );
};

export default ConsolidatedReportsPage;
