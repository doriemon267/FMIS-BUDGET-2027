import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import api from "../config/api";
import { useRegion } from "../context/RegionContext";
import {
  Box,
  CircularProgress,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Paper,
  Button,
  Snackbar,
  Alert,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import TierTable from "../components/tier/TierTable";
import { useUser } from "../context/UserContext";
import SaveIcon from '@mui/icons-material/Save';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import TableChartIcon from '@mui/icons-material/TableChart';
import CloseIcon from '@mui/icons-material/Close';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import HistoryIcon from '@mui/icons-material/History';
import RestoreIcon from '@mui/icons-material/Restore';
import VisibilityIcon from '@mui/icons-material/Visibility';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import GenericPdfPreviewDialog from '../components/GenericPdfPreviewDialog';
import NEPCeilingSummary from "./ProposalOperationsHub/components/NEPCeilingSummary";

const TierPage = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const headerBg = theme.palette.mode === 'dark' ? '#0b2413' : '#2d5016';
  const queryClient = useQueryClient();
  const { currentUser } = useUser();
  const { activeRegion, availableRegions } = useRegion();
  const [searchParams, setSearchParams] = useSearchParams();
  const appliedUrlParamsRef = useRef(false);
  const proposalScopeHydratedRef = useRef(null);
  const pendingDepartmentParamRef = useRef(null);
  const pendingDivisionParamRef = useRef(null);
  const [activeFiscalYear, setActiveFiscalYear] = useState("");
  const [regions, setRegions] = useState([]);
  const [organizationStructure, setOrganizationStructure] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [selectedRegion, setSelectedRegion] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedDivision, setSelectedDivision] = useState("");
  const [tierData, setTierData] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreatingVersion, setIsCreatingVersion] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [lastSavedJson, setLastSavedJson] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [pdfViewerOpen, setPdfViewerOpen] = useState(false);
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null);
  const [pdfFilename, setPdfFilename] = useState("");
  const [tableKey, setTableKey] = useState(Date.now());
  const lastSavedJsonRef = useRef(null);
  const tierDataPrevRef = useRef(null);
  const [revisionsDrawerOpen, setRevisionsDrawerOpen] = useState(false);
  const [revisions, setRevisions] = useState([]);
  const [revisionsLoading, setRevisionsLoading] = useState(false);
  const [restoringId, setRestoringId] = useState(null);
  const [revisionComment, setRevisionComment] = useState('');
  const [currentVersion, setCurrentVersion] = useState(null);
  const [viewRevisionOpen, setViewRevisionOpen] = useState(false);
  const [viewRevisionDetail, setViewRevisionDetail] = useState(null);
  const [viewRevisionLoading, setViewRevisionLoading] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({ open: false, title: '', message: '', onConfirm: null });

  const [derivedProposal, setDerivedProposal] = useState(null);
  const [isProposalScopeLoading, setIsProposalScopeLoading] = useState(false);
  const [nepReportContext, setNepReportContext] = useState(null);

  const isNepFromUrl = searchParams.get("budgetType")?.toUpperCase() === "NEP";
  const proposalIdFromUrl = searchParams.get("proposalId");

  const proposalForCeiling = proposalIdFromUrl
    ? { _id: proposalIdFromUrl, modelType: "NEP" }
    : (derivedProposal ? { ...derivedProposal, modelType: "NEP" } : null);

  const liveCeilingTotals = useMemo(() => {
    const report = tierData?.reportSummary;
    if (!report) return null;

    const sources = report.sourcesOfFunds || {};
    const uses = report.usesOfFunds || {};
    const categoryIncome = report.usesCorporateIncome || {};
    const budgetarySupport = sources.budgetarySupport || {};
    const personnel = uses["Personnel Services"] || {};
    const mooe = uses["Maintenance and Other Operating Expenses"] || {};
    const capitalOutlay = uses["Capital Outlay"] || {};

    return {
      totalExpenses: Number(sources.proposedBudget || sources.total || 0),
      proposedBudget: Number(sources.proposedBudget || sources.total || 0),
      projectedSubsidy: Number(budgetarySupport.total || 0),
      personnelServices:
        Number(personnel.total || 0) + Number(categoryIncome["Personnel Services"] || 0),
      mooe:
        Number(mooe.total || 0) +
        Number(categoryIncome["Maintenance and Other Operating Expenses"] || 0),
      capitalOutlay:
        Number(capitalOutlay.total || 0) + Number(categoryIncome["Capital Outlay"] || 0),
      tier1: Number(budgetarySupport.tier1 || 0),
      tier2: Number(budgetarySupport.tier2 || 0),
      corporateIncome: Number(sources.corporateIncome || 0),
    };
  }, [tierData]);

  useEffect(() => {
    if (
      !proposalIdFromUrl ||
      String(proposalScopeHydratedRef.current || "") === String(proposalIdFromUrl)
    ) {
      return;
    }

    const hasPersistentScope =
      Boolean(searchParams.get("fiscalYear")) && Boolean(searchParams.get("region"));
    if (hasPersistentScope) {
      proposalScopeHydratedRef.current = String(proposalIdFromUrl);
      return;
    }

    const getScopeValue = (value, keys = []) => {
      if (value == null) return "";
      if (typeof value !== "object") return String(value);
      for (const key of keys) {
        if (value[key] != null && value[key] !== "") return String(value[key]);
      }
      return "";
    };

    let cancelled = false;
    const hydrateProposalScope = async () => {
      setIsProposalScopeLoading(true);
      try {
        const response = await api.get(`/api/allproposal/proposals/${proposalIdFromUrl}`);
        if (cancelled) return;

        const proposal = response?.data?.data || response?.data?.proposal || response?.data;
        const next = new URLSearchParams(searchParams);
        const fiscalYear = getScopeValue(proposal?.fiscalYear);
        const regionValue = getScopeValue(
          proposal?.region ||
            proposal?.regionName ||
            proposal?.Region ||
            proposal?.responsibilityCenter,
          [
          "_id",
          "id",
          "Region",
          "RegionName",
          "regionName",
          "name",
          ]
        );
        const departmentValue = getScopeValue(proposal?.department, [
          "_id",
          "id",
          "Department",
          "departmentName",
          "name",
        ]);
        const divisionValue = getScopeValue(
          proposal?.division || proposal?.responsibilityCenter,
          ["_id", "id", "Division", "divisionName", "name"]
        );

        if (fiscalYear && !next.get("fiscalYear")) next.set("fiscalYear", fiscalYear);
        if (regionValue && !next.get("region")) next.set("region", regionValue);
        if (departmentValue && !next.get("department")) {
          next.set("department", departmentValue);
        }
        if (divisionValue && !next.get("division")) next.set("division", divisionValue);

        proposalScopeHydratedRef.current = String(proposalIdFromUrl);
        if (next.toString() !== searchParams.toString()) {
          setSearchParams(next, { replace: true });
        }
      } catch (error) {
        if (cancelled) return;
        console.error("Error restoring Tier scope from proposal:", error);
        setSnackbar({
          open: true,
          message:
            error?.response?.data?.message ||
            "Unable to restore the proposal scope. Return to Proposals and open Tier again.",
          severity: "error",
        });
      } finally {
        if (!cancelled) setIsProposalScopeLoading(false);
      }
    };

    hydrateProposalScope();
    return () => {
      cancelled = true;
    };
  }, [proposalIdFromUrl, searchParams, setSearchParams]);

  useEffect(() => {
    // If we have a direct proposalId from URL, no need to derive
    if (proposalIdFromUrl) {
      setDerivedProposal(null);
      return;
    }

    // Only derive if it's explicitly NEP or if the current Tier data is finalized (indicating NEP phase)
    if (!isNepFromUrl && tierData?.isFinalized !== true) {
      setDerivedProposal(null);
      return;
    }

    if (!activeFiscalYear || !selectedRegion || selectedRegion === 'ALL') {
      setDerivedProposal(null);
      return;
    }

    const fetchDerivedProposal = async () => {
      try {
        const res = await api.get('/api/allproposal/proposals', {
          params: {
            fiscalYear: activeFiscalYear,
            region: selectedRegion,
            view: 'all-proposals'
          }
        });
        const proposals = res.data?.proposals || [];
        const matched = proposals.find(p => {
          const isNep = String(p.modelType || p.budgetType || "").toUpperCase() === "NEP";
          const selectedDepartmentRecord = departments.find(
            department => String(department._id) === String(selectedDepartment)
          );
          const selectedDepartmentValues = [
            selectedDepartment,
            selectedDepartmentRecord?.Department,
            selectedDepartmentRecord?.name,
          ].filter(Boolean).map(value => String(value).trim().toLowerCase());
          const proposalDepartment = String(p.department?._id || p.department || "")
            .trim()
            .toLowerCase();
          const selectedDivisionRecord = divisions.find(
            division =>
              String(division._id) === String(selectedDivision) ||
              String(division.name) === String(selectedDivision)
          );
          const selectedDivisionValues = [
            selectedDivision,
            selectedDivisionRecord?.name,
          ].filter(Boolean).map(value => String(value).trim().toLowerCase());
          const proposalDivision = String(
            p.division?._id || p.division || p.responsibilityCenter?._id || p.responsibilityCenter || ""
          ).trim().toLowerCase();
          const deptMatch =
            !selectedDepartment || selectedDepartmentValues.includes(proposalDepartment);
          const divMatch =
            !selectedDivision || selectedDivisionValues.includes(proposalDivision);
          return isNep && deptMatch && divMatch;
        });
        setDerivedProposal(matched || null);
      } catch (err) {
        console.error("Error fetching derived proposal:", err);
      }
    };
    fetchDerivedProposal();
  }, [
    isNepFromUrl,
    proposalIdFromUrl,
    activeFiscalYear,
    selectedRegion,
    selectedDepartment,
    selectedDivision,
    tierData?.isFinalized,
    departments,
    divisions,
  ]);

  // Budget Officer and Budget Manager: view only. Budget Planning Analyst (and Super Admin) can edit/save.
  const roles = currentUser?.Roles ?? currentUser?.workflowRoles ?? (currentUser?.hierarchicalAccess?.workflowRoles ?? []);
  const roleList = Array.isArray(roles) ? roles : [roles];
  const norm = (r) => String(r || '').toUpperCase().replace(/\s+/g, '_');
  const isAnalyst = roleList.some((r) => ['BUDGET_PLANNING_ANALYST', 'BUDGET PLANNING ANALYST', 'BUDGETANALYST', 'budgetAnalyst'].includes(norm(r)));
  const isOfficer = roleList.some((r) => ['BUDGET_OFFICER', 'BUDGET OFFICER'].includes(norm(r)));
  const isManager = roleList.some((r) => ['BUDGET_MANAGER', 'BUDGET MANAGER', 'OVERALL_BUDGET_APPROVER'].includes(norm(r)));
  const isSuperAdmin = roleList.some((r) => ['SUPER_ADMIN', 'SUPER ADMIN'].includes(norm(r)));
  const isPreparer = roleList.some((r) => ['BUDGET_PREPARER', 'BUDGET PREPARER'].includes(norm(r)));

  // Guard: If not a budget user, redirect to not-authorized
  const isAnyBudgetUser = isAnalyst || isOfficer || isManager || isSuperAdmin || isPreparer;

  useEffect(() => {
    if (currentUser && !isAnyBudgetUser) {
      navigate('/not-authorized');
    }
  }, [currentUser, isAnyBudgetUser, navigate]);

  const isTierViewOnly = (isOfficer || isManager) && !isAnalyst && !isSuperAdmin && !isPreparer;
  const isFinalized = tierData?.isFinalized === true;
  const isNepContext = Boolean(proposalForCeiling || isNepFromUrl);
  const reportContextAvailable = !isNepContext || Boolean(nepReportContext?.compliance);
  const reportType = isNepContext ? 'NEP_ALIGNMENT' : 'TIER';

  // Budget Preparers can edit even if "Finalized" if they are in the NEP adjustment phase.
  // "Finalized" in Tier tool usually means Tier 1 is locked, but Tier 2/NEP adjustments might still be needed.
  const effectiveReadOnly = (isTierViewOnly || isFinalized) && !isPreparer && !isSuperAdmin && !isAnalyst;

  // Compute dirty state without causing setState loops: only set lastSavedJson once when tierData first arrives
  useEffect(() => {
    if (!tierData) {
      setIsDirty(false);
      return;
    }
    const json = JSON.stringify(tierData);
    if (lastSavedJsonRef.current === null) {
      lastSavedJsonRef.current = json;
      setLastSavedJson(json);
      setIsDirty(false);
      tierDataPrevRef.current = json;
      return;
    }
    setIsDirty(json !== lastSavedJsonRef.current);
    tierDataPrevRef.current = json;
  }, [tierData]);

  // Keep lastSavedJson in sync when user saves (so next comparison uses updated baseline)
  useEffect(() => {
    if (lastSavedJson != null && lastSavedJson === lastSavedJsonRef.current) return;
    if (lastSavedJson != null) lastSavedJsonRef.current = lastSavedJson;
  }, [lastSavedJson]);

  const fetchCurrentVersion = useCallback(async () => {
    if (!activeFiscalYear || !selectedRegion || selectedRegion === 'ALL') {
      setCurrentVersion(null);
      return;
    }
    try {
      const params = new URLSearchParams({ fiscalYear: activeFiscalYear, region: selectedRegion });
      if (selectedDepartment) params.set('department', selectedDepartment);
      if (selectedDivision) params.set('division', selectedDivision);
      const res = await api.get(`/api/tier/current-version?${params.toString()}`);
      const version = Number(res.data?.version);
      setCurrentVersion(Number.isFinite(version) && version > 0 ? version : null);
    } catch (_err) {
      setCurrentVersion(null);
    }
  }, [activeFiscalYear, selectedRegion, selectedDepartment, selectedDivision]);

  useEffect(() => {
    fetchCurrentVersion();
  }, [fetchCurrentVersion]);

  useEffect(() => {
    const fyFromUrl = searchParams.get("fiscalYear");
    const fetchActiveSettings = async () => {
      try {
        const activeResponse = await api.get("/settings/active");
        if (activeResponse.data) {
          const fiscalYear = fyFromUrl || activeResponse.data.fiscalYear || "";
          setActiveFiscalYear(String(fiscalYear));
        } else if (fyFromUrl) {
          setActiveFiscalYear(fyFromUrl);
        }
      } catch (error) {
        console.error("Error fetching active settings:", error);
        if (fyFromUrl) setActiveFiscalYear(fyFromUrl);
      }
    };

    const fetchRegions = async () => {
      try {
        // Prefer regions provided by RegionContext (user's assigned regions)
        if (availableRegions && availableRegions.length > 0) {
          // RegionContext provides normalized region objects
          setRegions(availableRegions.map(r => ({ _id: r._id || r.id, Region: r.regionName || r.Region || r.name })));
          return;
        }

        // If user has FULL scope or is Budget Manager / Super Admin, fetch all regions
        const userScope = currentUser?.hierarchicalAccess?.scope || currentUser?.hierarchicalAccess?.assignmentLevel || '';
        const normRole = (r) => String(r || '').toUpperCase().replace(/\s+/g, '_');
        const isBM = (currentUser?.Roles || []).some((r) => {
          const n = normRole(r);
          return n === 'BUDGET_MANAGER' || n === 'OVERALL_BUDGET_APPROVER';
        });
        const isSuperAdmin = (currentUser?.Roles || []).some((r) => ['SUPER_ADMIN', 'SUPER ADMIN', 'SUPERADMIN'].includes(String(r || '').toUpperCase().replace(/\s+/g, '_')));
        if (userScope === 'FULL' || isBM || isSuperAdmin) {
          const response = await api.get("/api/regions");
          setRegions(response.data);
          return;
        }

        // Otherwise don't expose all regions — try to show nothing or only activeRegion
        if (activeRegion) {
          const activeRegionId =
            typeof activeRegion === "object"
              ? activeRegion._id || activeRegion.id
              : activeRegion;
          const activeRegionName =
            typeof activeRegion === "object"
              ? activeRegion.regionName || activeRegion.Region || activeRegion.name
              : activeRegion;
          setRegions([{ _id: activeRegionId || activeRegionName, Region: activeRegionName }]);
        } else {
          setRegions([]);
        }
      } catch (error) {
        console.error("Error fetching regions:", error);
      }
    };

    const fetchOrgStructure = async () => {
      try {
        const res = await api.get("/api/hierarchical-rbac/organization-structure", { params: { structure: "old" } });
        setOrganizationStructure(res.data?.data || res.data);
      } catch (error) {
        console.error("Error fetching organization structure:", error);
      }
    };

    fetchActiveSettings();
    fetchRegions();
    fetchOrgStructure();
  }, [searchParams, availableRegions, activeRegion, currentUser]);

  // Apply scope from URL params when coming from New Proposal Workflow (e.g. "Open Tier")
  useEffect(() => {
    if (appliedUrlParamsRef.current || regions.length === 0) return;
    const regionParam = searchParams.get("region");
    const departmentParam = searchParams.get("department");
    const divisionParam = searchParams.get("division");
    if (!regionParam && !departmentParam && !divisionParam) return;
    appliedUrlParamsRef.current = true;
    if (regionParam) {
      const found = regions.find(
        (r) => String(r._id) === String(regionParam) || String(r.Region) === regionParam
      );
      if (found) setSelectedRegion(found._id != null ? String(found._id) : String(regionParam));
      else setSelectedRegion(String(regionParam));
    }
    if (departmentParam) pendingDepartmentParamRef.current = departmentParam;
    if (divisionParam) pendingDivisionParamRef.current = divisionParam;
    // Keep proposal scope in the URL so a browser refresh can restore the
    // exact Tier context instead of falling back to empty selectors.
  }, [regions, searchParams]);

  // If the user only has a single region available, default the selector to that region
  useEffect(() => {
    if (selectedRegion) return; // respect existing selection (from URL or user action)

    // Check activeRegion from context first as it's the most reliable source for the current user session
    if (activeRegion) {
      const id =
        typeof activeRegion === "object"
          ? activeRegion._id ||
            activeRegion.id ||
            activeRegion.Region ||
            activeRegion.regionName ||
            activeRegion.name
          : activeRegion;
      const regionIdStr = String(id || '');

      // Ensure the ID exists in our fetched regions list before setting it
      const isValidRegion = regions.some(r =>
        String(r._id) === regionIdStr ||
        String(r.Region) === regionIdStr ||
        String(r.regionName) === regionIdStr
      );

      if (isValidRegion) {
        setSelectedRegion(regionIdStr);
        return;
      }
    }

    if (regions && regions.length === 1) {
      const only = regions[0];
      const id = only._id != null ? String(only._id) : (only.Region || "");
      if (id) setSelectedRegion(id);
    }
  }, [regions, activeRegion, selectedRegion]);

  useEffect(() => {
    if (departments.length === 0) return;
    const departmentParam = pendingDepartmentParamRef.current;
    if (!departmentParam) return;
    const found = departments.find(
      (d) => String(d._id) === String(departmentParam) || String(d.Department) === departmentParam || String(d.name) === departmentParam
    );
    pendingDepartmentParamRef.current = null;
    if (found) setSelectedDepartment(found._id);
    else setSelectedDepartment(departmentParam);
  }, [departments]);

  useEffect(() => {
    if (divisions.length === 0) return;
    const divisionParam = pendingDivisionParamRef.current;
    if (!divisionParam) return;
    const found = divisions.find(
      (d) => String(d._id) === String(divisionParam) || String(d.name) === divisionParam
    );
    pendingDivisionParamRef.current = null;
    if (found) setSelectedDivision(found._id || found.name);
    else setSelectedDivision(divisionParam);
  }, [divisions]);

  useEffect(() => {
    if (!selectedRegion || selectedRegion === 'ALL') {
      setDepartments([]);
      setSelectedDepartment("");
      setSelectedDivision("");
      return;
    }
    const data = organizationStructure;
    const allDepts = data?.availableUnits?.departments || [];
    const mappings = data?.mappings || [];
    const orgRegions = data?.availableUnits?.regions || [];
    const regionStr = String(selectedRegion);
    const selReg = regions.find((r) => String(r._id) === regionStr);
    const selectedRegionName = (selReg?.Region || selReg?.regionName || "").trim();
    const norm = (s) => String(s || "").trim().toUpperCase();
    const rn = norm(selectedRegionName);
    const isExcludeRegionalAndIMO = rn === "CENTRAL OFFICE" || rn === "MARIIS" || rn === "UPRIIS";
    const excludeNames = isExcludeRegionalAndIMO ? ["REGIONAL OFFICE", "IRRIGATION MANAGEMENT OFFICE"] : [];

    let regionMappings = mappings.filter((m) => m.regionId && String(m.regionId) === regionStr);
    if (regionMappings.length === 0) {
      regionMappings = mappings.filter((m) => {
        const mn = norm(m.regionName);
        const sn = rn;
        return mn && sn && mn === sn;
      });
    }
    if (regionMappings.length === 0 && isExcludeRegionalAndIMO) {
      const matchedOrgRegion = orgRegions.find((r) => norm(r.name || r.Region) === rn);
      if (matchedOrgRegion) {
        const altId = String(matchedOrgRegion.id || matchedOrgRegion._id);
        regionMappings = mappings.filter((m) => m.regionId && String(m.regionId) === altId);
      }
    }
    if (regionMappings.length === 0 && isExcludeRegionalAndIMO && allDepts.length > 0) {
      const coDeptIds = allDepts
        .filter((d) => !excludeNames.includes(norm(d.name || d.Department)))
        .map((d) => String(d.id || d._id));
      const depts = allDepts
        .filter((d) => coDeptIds.includes(String(d.id || d._id)))
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
      const name = norm(d.name || d.Department);
      const excluded = excludeNames.includes(name);
      return id && regionDeptIds.includes(String(id)) && !excluded;
    });

    const depts = regionDepts.map((d) => ({
      _id: d.id || d._id,
      Department: d.name || d.Department,
      name: d.name || d.Department,
    }));
    setDepartments(depts);
    setSelectedDepartment("");
    setSelectedDivision("");
  }, [selectedRegion, organizationStructure, regions]);

  useEffect(() => {
    if (selectedDepartment) {
      const fetchDivisions = async () => {
        try {
          const params = new URLSearchParams({ departmentId: selectedDepartment });
          // Always pass regionId when a specific region is selected (required for region-specific division filter)
          const r = selectedRegion;
          const regionId = (r && r !== 'ALL')
            ? (typeof r === 'object' && r?._id != null ? String(r._id) : String(r).trim())
            : null;
          if (regionId) params.set('regionId', regionId);
          const response = await api.get(`/api/hierarchical-rbac/divisions?${params.toString()}`);
          setDivisions(response.data.data || response.data || []);
        } catch (error) {
          console.error("Error fetching divisions:", error);
        }
      };
      fetchDivisions();
    }
    // Reset division when department changes
    setSelectedDivision("");
  }, [selectedDepartment, selectedRegion]);


  const handleSave = async () => {
    if (!tierData || !activeFiscalYear) return;
    if (!isDirty) {
      setSnackbar({ open: true, message: 'No changes to save', severity: 'info' });
      return;
    }

    setIsSaving(true);
    try {
      // Build normalizedItems array from displayedItems (preferred) or raw items
      const source = tierData.displayedItems || tierData.items || {};
      
      // Transform object to array format expected by backend
      const itemsArray = Object.entries(source).map(([key, v]) => {
        const lineItemId = key;
        let category = v.category || '';
        if (category === 'Capital Outlay') {
          category = 'Capital Outlay';
        } else if (category === 'Maintenance and Other Operating Expenses') {
          category = 'MOOE';
        } else {
          category = 'Personnel';
        }
        return {
          lineItemId,
          category,
          tier1: Number(v.tier1) || 0,
          tier2: Number(v.tier2) || 0,
          description: v.description || key,
        };
      });

      const saveData = {
        fiscalYear: String(activeFiscalYear),
        region: String(selectedRegion),
        department: String(selectedDepartmentName ?? ''),
        division: String(selectedDivisionName ?? ''),
        items: itemsArray,
        ...(proposalForCeiling?._id && { proposalId: String(proposalForCeiling._id) }),
        createNewVersion: false,
        ...(revisionComment.trim() && { revisionComment: revisionComment.trim() }),
      };

      const saveRes = await api.post('/tier/data', saveData);
      const saved = JSON.stringify(tierData);
      setLastSavedJson(saved);
      lastSavedJsonRef.current = saved;
      setIsDirty(false);
      const version = saveRes?.data?.version ?? saveRes?.data?.versionNumber;
      setSnackbar({
        open: true,
        message: version != null ? `Tier data saved (Version ${version} updated).` : 'Tier data saved successfully.',
        severity: 'success',
      });
      setRevisionComment('');
      queryClient.invalidateQueries({ queryKey: ['tierSavedItems', activeFiscalYear, selectedRegion, selectedDepartmentName, selectedDivisionName] });
      if (proposalForCeiling?._id) {
        queryClient.invalidateQueries({
          queryKey: ['nepCeilingContext', String(proposalForCeiling._id)],
        });
      }
      try { await fetchCurrentVersion(); } catch (_) { /* ignore */ }
      if (revisionsDrawerOpen) fetchRevisions();
    } catch (error) {
      console.error('Error saving tier data:', error);
      setSnackbar({ open: true, message: 'Error saving tier data. Please try again.', severity: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateNewVersion = () => {
    if (!tierData || !activeFiscalYear) return;
    setConfirmDialog({
      open: true,
      title: 'Create New Version',
      message: `Ile-lock ang kasalukuyang Version ${currentVersion ?? ''}. Malilikha ng bagong version na maaari pang i-edit. Ituloy?`,
      onConfirm: () => _doCreateNewVersion(),
    });
  };

  const _doCreateNewVersion = async () => {

    setIsCreatingVersion(true);
    try {
      const source = tierData.displayedItems || tierData.items || {};
      const itemsArray = Object.entries(source).map(([key, v]) => {
        const lineItemId = key;
        let category = v.category || '';
        if (category === 'Capital Outlay') {
          category = 'Capital Outlay';
        } else if (category === 'Maintenance and Other Operating Expenses') {
          category = 'MOOE';
        } else {
          category = 'Personnel';
        }
        return {
          lineItemId,
          category,
          tier1: Number(v.tier1) || 0,
          tier2: Number(v.tier2) || 0,
          description: v.description || key,
        };
      });

      const saveData = {
        fiscalYear: String(activeFiscalYear),
        region: String(selectedRegion),
        department: String(selectedDepartmentName ?? ''),
        division: String(selectedDivisionName ?? ''),
        items: itemsArray,
        ...(proposalForCeiling?._id && { proposalId: String(proposalForCeiling._id) }),
        createNewVersion: true,
        ...(revisionComment.trim() && { revisionComment: revisionComment.trim() }),
      };

      const saveRes = await api.post('/tier/data', saveData);
      const saved = JSON.stringify(tierData);
      setLastSavedJson(saved);
      lastSavedJsonRef.current = saved;
      setIsDirty(false);
      const version = saveRes?.data?.version ?? saveRes?.data?.versionNumber;
      setSnackbar({
        open: true,
        message: `New version created (Version ${version}). Previous version is now locked.`,
        severity: 'success',
      });
      setRevisionComment('');
      queryClient.invalidateQueries({ queryKey: ['tierSavedItems', activeFiscalYear, selectedRegion, selectedDepartmentName, selectedDivisionName] });
      if (proposalForCeiling?._id) {
        queryClient.invalidateQueries({
          queryKey: ['nepCeilingContext', String(proposalForCeiling._id)],
        });
      }
      try { await fetchCurrentVersion(); } catch (_) { /* ignore */ }
      if (revisionsDrawerOpen) fetchRevisions();
    } catch (error) {
      console.error('Error creating new version:', error);
      setSnackbar({ open: true, message: 'Error creating new version. Please try again.', severity: 'error' });
    } finally {
      setIsCreatingVersion(false);
    }
  };

  const fetchRevisions = async () => {
    if (!activeFiscalYear || !selectedRegion || selectedRegion === 'ALL') return;
    setRevisionsLoading(true);
    try {
      // Single region param (ID only): backend normalizes to name. Do not add region name to avoid duplicate query keys.
      const regionVal = typeof selectedRegion === 'object' ? (selectedRegion?._id != null ? String(selectedRegion._id) : '') : String(selectedRegion ?? '');
      const params = new URLSearchParams();
      params.set('fiscalYear', String(activeFiscalYear));
      params.set('region', regionVal);
      params.set('department', String(selectedDepartmentName ?? ''));
      params.set('division', String(selectedDivisionName ?? ''));
      const res = await api.get(`/api/tier/revisions?${params.toString()}`);
      const data = res.data;
      setRevisions(Array.isArray(data?.revisions) ? data.revisions : (Array.isArray(data) ? data : []));
    } catch (err) {
      console.error('Error fetching revisions:', err);
      setRevisions([]);
      setSnackbar({ open: true, message: 'Failed to load version history', severity: 'error' });
    } finally {
      setRevisionsLoading(false);
    }
  };

  const handleOpenRevisions = () => {
    setRevisionsDrawerOpen(true);
    fetchRevisions();
  };

  const handleViewRevision = async (revisionId) => {
    setViewRevisionOpen(true);
    setViewRevisionDetail(null);
    setViewRevisionLoading(true);
    try {
      const res = await api.get(`/api/tier/revisions/${revisionId}`);
      setViewRevisionDetail(res.data);
    } catch (err) {
      console.error('Error fetching revision:', err);
      setSnackbar({ open: true, message: err?.response?.data?.message || 'Failed to load revision', severity: 'error' });
      setViewRevisionOpen(false);
    } finally {
      setViewRevisionLoading(false);
    }
  };

  const handleCloseViewRevision = () => {
    setViewRevisionOpen(false);
    setViewRevisionDetail(null);
  };

  const handleRestoreRevision = async (revisionId) => {
    setRestoringId(revisionId);
    try {
      const res = await api.post(`/api/tier/revisions/${revisionId}/restore`, { saveAsNewRevision: true });
      setSnackbar({ open: true, message: 'Revision restored. Refreshing table.', severity: 'success' });
      setRevisionsDrawerOpen(false);
      setViewRevisionOpen(false);
      setViewRevisionDetail(null);
      // Set cache directly from restore response so table shows the exact restored data (key must match TierTable: fiscalYear, region, departmentName, divisionName)
      const restoredItems = Array.isArray(res?.data?.tier?.items) ? res.data.tier.items : [];
      const savedItemsKey = ['tierSavedItems', activeFiscalYear, selectedRegion, selectedDepartmentName, selectedDivisionName];
      // Restore creates a new revision, so get the latest version (which will be the restored one)
      // The version will be updated via onVersionChange when saved-items query refetches
      queryClient.setQueryData(savedItemsKey, { items: restoredItems });
      queryClient.invalidateQueries({ queryKey: ['tierSavedItems'] });
      setTableKey(Date.now());
      setTierData(null);
      lastSavedJsonRef.current = null;
      setLastSavedJson(null);
      // Fetch latest version (restore creates new revision, so this will be the restored version)
      try { await fetchCurrentVersion(); } catch (_) { /* ignore */ }
    } catch (err) {
      console.error('Error restoring revision:', err);
      setSnackbar({ open: true, message: err?.response?.data?.message || 'Failed to restore revision', severity: 'error' });
    } finally {
      setRestoringId(null);
    }
  };

  const formatRevisionDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleString('en-PH', { dateStyle: 'short', timeStyle: 'short' });
    } catch (_) {
      return dateStr;
    }
  };

  const formatCurrency = (val) => {
    const n = Number(val);
    if (isNaN(n)) return '₱0.00';
    return `₱${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getRegionDisplayName = () =>
    !selectedRegion || selectedRegion === 'ALL' ? 'All' : (regions.find(r => r._id === selectedRegion || String(r._id) === String(selectedRegion))?.Region ?? selectedRegion);
  const getDepartmentDisplayName = () => {
    if (!selectedDepartment) return 'All';
    const dept = departments.find(d => d._id === selectedDepartment || String(d._id) === String(selectedDepartment));
    return dept ? (dept.Department || dept.name) : selectedDepartment;
  };
  const getDivisionDisplayName = () =>
    !selectedDivision ? 'All' : (divisions.find(d => d.name === selectedDivision || d._id === selectedDivision)?.name ?? selectedDivision);

  // Names for API scope (backend stores department/division as names). Empty string when not selected.
  const selectedDepartmentName = selectedDepartment
    ? (departments.find(d => String(d._id) === String(selectedDepartment))?.Department || departments.find(d => String(d._id) === String(selectedDepartment))?.name || '')
    : '';
  const selectedDivisionName = selectedDivision
    ? (divisions.find(d => d.name === selectedDivision || String(d._id) === String(selectedDivision))?.name ?? selectedDivision)
    : '';

  // Persist the resolved proposal scope so refresh/back-forward navigation can
  // restore the exact Tier view without depending on transient React state.
  useEffect(() => {
    if (!proposalIdFromUrl) return;

    const next = new URLSearchParams(searchParams);
    if (activeFiscalYear) next.set("fiscalYear", String(activeFiscalYear));
    if (selectedRegion && selectedRegion !== "ALL") {
      next.set("region", String(selectedRegion));
    }
    if (selectedDepartmentName) next.set("department", String(selectedDepartmentName));
    if (selectedDivisionName) next.set("division", String(selectedDivisionName));

    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [
    proposalIdFromUrl,
    activeFiscalYear,
    selectedRegion,
    selectedDepartmentName,
    selectedDivisionName,
    searchParams,
    setSearchParams,
  ]);

  const handleViewPDF = async () => {
    if (!tierData?.reportSummary || !activeFiscalYear) {
      setSnackbar({ open: true, message: 'Load tier data first, then view PDF.', severity: 'warning' });
      return;
    }
    setIsGeneratingPdf(true);
    try {
      setSnackbar({ open: true, message: 'Generating PDF...', severity: 'info' });
      const response = await api.post('/tier/generate-pdf', {
        reportType,
        proposalId: isNepContext ? proposalForCeiling?._id : undefined,
        fiscalYear: activeFiscalYear,
        region: selectedRegion,
        department: selectedDepartment,
        division: selectedDivision,
        regionName: getRegionDisplayName(),
        departmentName: getDepartmentDisplayName(),
        divisionName: getDivisionDisplayName(),
        reportSummary: tierData.reportSummary,
        isFinalized: tierData.isFinalized === true,
        version: currentVersion,
        hasUnsavedChanges: isDirty,
        reportContext: isNepContext ? nepReportContext : undefined,
      }, { responseType: 'blob' });

      // Extract filename from Content-Disposition header
      let filename = isNepContext
        ? `NEP_Budget_Alignment_${activeFiscalYear}.pdf`
        : `Tier_Budget_Proposal_${activeFiscalYear}.pdf`;
      const contentDisposition = response.headers['content-disposition'];
      if (contentDisposition) {
        const filenameStarMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
        if (filenameStarMatch && filenameStarMatch[1]) {
          filename = decodeURIComponent(filenameStarMatch[1]);
        } else {
          const filenameMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
          if (filenameMatch && filenameMatch[1]) {
            filename = filenameMatch[1];
          }
        }
      }
      setPdfFilename(filename);

      if (pdfBlobUrl) window.URL.revokeObjectURL(pdfBlobUrl);
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      setPdfBlobUrl(url);
      setPdfViewerOpen(true);
      setSnackbar({ open: true, message: 'PDF ready. View in window below.', severity: 'success' });
    } catch (error) {
      console.error('Error generating PDF:', error);
      setSnackbar({ open: true, message: 'Error generating PDF. Please try again.', severity: 'error' });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleClosePdfViewer = () => {
    setPdfViewerOpen(false);
    if (pdfBlobUrl) {
      window.URL.revokeObjectURL(pdfBlobUrl);
      setPdfBlobUrl(null);
    }
  };

  const handleExportExcel = async () => {
    if (!tierData?.reportSummary || !activeFiscalYear) {
      setSnackbar({ open: true, message: 'Load tier data first, then export Excel.', severity: 'warning' });
      return;
    }
    setIsExportingExcel(true);
    try {
      setSnackbar({ open: true, message: 'Generating Excel...', severity: 'info' });
      const response = await api.post('/tier/export-excel', {
        reportType,
        proposalId: isNepContext ? proposalForCeiling?._id : undefined,
        fiscalYear: activeFiscalYear,
        region: selectedRegion,
        department: selectedDepartment,
        division: selectedDivision,
        regionName: getRegionDisplayName(),
        departmentName: getDepartmentDisplayName(),
        divisionName: getDivisionDisplayName(),
        reportSummary: tierData.reportSummary,
        version: currentVersion,
        hasUnsavedChanges: isDirty,
        reportContext: isNepContext ? nepReportContext : undefined,
      }, { responseType: 'blob' });

      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      const link = document.createElement('a');
      link.href = url;
      let filename = isNepContext
        ? `NEP_Budget_Alignment_${activeFiscalYear}_${getRegionDisplayName()}_V${currentVersion ?? 'Unversioned'}.xlsx`
        : `Tier_Budget_Proposal_${activeFiscalYear}_${getRegionDisplayName()}_V${currentVersion ?? 'Unversioned'}.xlsx`;
      const contentDisposition = response.headers['content-disposition'];
      const filenameStarMatch = contentDisposition?.match(/filename\*=UTF-8''([^;]+)/i);
      const filenameMatch = contentDisposition?.match(/filename="?([^";]+)"?/i);
      if (filenameStarMatch?.[1]) filename = decodeURIComponent(filenameStarMatch[1]);
      else if (filenameMatch?.[1]) filename = filenameMatch[1];
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setSnackbar({ open: true, message: 'Excel report downloaded.', severity: 'success' });
    } catch (error) {
      console.error('Error exporting Excel:', error);
      setSnackbar({ open: true, message: 'Error exporting Excel. Please try again.', severity: 'error' });
    } finally {
      setIsExportingExcel(false);
    }
  }; 

  return (
    <Box
      sx={{
        p: { xs: 1.5, sm: 2, lg: 3 },
        bgcolor: 'background.default',
        minHeight: "100vh",
      }}
    >
      <Paper
        elevation={2}
        sx={{
          p: { xs: 2, sm: 2.5, lg: 3 },
          mb: 2,
          background: headerBg,
          color: "white",
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            justifyContent: 'space-between',
            alignItems: { xs: 'stretch', sm: 'center' },
            gap: 2,
          }}
        >
          <Box>
            <Typography
              variant="h4"
              component="h1"
              sx={{ fontWeight: 800, fontSize: { xs: '1.6rem', sm: '2rem' }, lineHeight: 1.2 }}
            >
              {isNepContext ? 'NEP Tier Adjustment' : 'Tier Management'}
            </Typography>
            <Typography variant="body1" sx={{ mt: 0.75, color: 'rgba(255,255,255,0.82)' }}>
              {isNepContext
                ? 'Align Tier 1 and Tier 2 allocations with the approved BRD ceiling.'
                : 'View and manage Tier data by region, department, and division.'}
            </Typography>
          </Box>
          <Button
            variant="outlined"
            onClick={() => navigate("/allproposal")}
            sx={{
              color: "white",
              borderColor: "rgba(255,255,255,0.5)",
              "&:hover": { borderColor: "white", bgcolor: "rgba(255,255,255,0.1)" },
              alignSelf: { xs: 'flex-start', sm: 'center' },
              whiteSpace: 'nowrap',
            }}
            startIcon={<ArrowBackRoundedIcon />}
          >
            Back to Proposals
          </Button>
        </Box>
      </Paper>

      <Paper variant="outlined" sx={{ mb: 3, p: { xs: 1.5, sm: 2 }, borderColor: 'divider' }}>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: 'block', mb: 1, fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase' }}
        >
          Reporting scope
        </Typography>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(190px, 1fr))', lg: 'repeat(3, minmax(200px, 1fr))' },
            gap: 1.5,
          }}
        >
        <FormControl fullWidth>
          <InputLabel id="region-select-label">Region</InputLabel>
          <Select
            labelId="region-select-label"
            value={typeof selectedRegion === 'string' ? selectedRegion : (selectedRegion?._id != null ? String(selectedRegion._id) : '')}
            label="Region"
            onChange={(e) => setSelectedRegion(e.target.value || '')}
          >
            <MenuItem value="ALL">
              <em>ALL</em> — Consolidate all regions
            </MenuItem>
            {regions.map((region, idx) => {
              const val = region._id != null ? String(region._id) : (region.Region || `region-${idx}`);
              return (
                <MenuItem key={val} value={val}>
                  {region.Region || "Unnamed Region"}
                </MenuItem>
              );
            })}
          </Select>
        </FormControl>
        <FormControl fullWidth>
          <InputLabel id="department-select-label">Department</InputLabel>
          <Select
            labelId="department-select-label"
            value={String(selectedDepartment ?? "")}
            label="Department"
            onChange={(e) => setSelectedDepartment(e.target.value || "")}
            disabled={!selectedRegion || selectedRegion === 'ALL'}
          >
            {(() => {
              const selRegion = regions.find(r => String(r._id) === String(selectedRegion));
              const regionName = (selRegion?.Region || selRegion?.regionName || '').trim().toUpperCase();
              const excludeROandIMO = regionName === 'CENTRAL OFFICE' || regionName === 'MARIIS' || regionName === 'UPRIIS';
              const displayDepts = excludeROandIMO
                ? departments.filter(d => {
                    const name = (d.Department || d.name || d.departmentName || '').trim().toUpperCase();
                    return name !== 'REGIONAL OFFICE' && name !== 'IRRIGATION MANAGEMENT OFFICE';
                  })
                : departments;
              return displayDepts.map((dept, idx) => {
                const val = dept._id != null ? String(dept._id) : (dept.Department || dept.name || `dept-${idx}`);
                return (
                  <MenuItem key={val} value={val}>
                    {dept.Department || dept.name || "Unnamed Department"}
                  </MenuItem>
                );
              });
            })()}
          </Select>
        </FormControl>
        <FormControl fullWidth>
          <InputLabel id="division-select-label">Division</InputLabel>
          <Select
            labelId="division-select-label"
            value={String(selectedDivision ?? "")}
            label="Division"
            onChange={(e) => setSelectedDivision(e.target.value || "")}
            disabled={!selectedDepartment || selectedRegion === 'ALL'}
          >
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
        </Box>
        <Box
          sx={{
            mt: 2,
            pt: 2,
            borderTop: 1,
            borderColor: 'divider',
          }}
        >
          <Box
            component="section"
            aria-label="Tier status"
            sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}
          >
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ mr: 0.5, fontWeight: 800, letterSpacing: 0.45, textTransform: 'uppercase' }}
            >
              Status
            </Typography>
            {isTierViewOnly && (
              <Chip label="View only (Budget Officer / Manager)" color="default" variant="outlined" size="small" />
            )}
            {isNepContext ? (
              <Chip label="NEP Adjustment" color="primary" variant="outlined" size="small" sx={{ fontWeight: 700 }} />
            ) : isFinalized ? (
              <Chip
                label={effectiveReadOnly ? "Finalized · Read only" : "Finalized"}
                color="default"
                variant="outlined"
                size="small"
              />
            ) : null}
            {Number(currentVersion) > 0 && (
              <Chip label={`Version ${currentVersion}`} color="primary" variant="outlined" size="small" />
            )}
            {!effectiveReadOnly && (
              <Chip
                label={isDirty ? 'Unsaved changes' : 'All changes saved'}
                color={isDirty ? 'warning' : 'success'}
                variant={isDirty ? 'filled' : 'outlined'}
                size="small"
                sx={{ fontWeight: 700 }}
              />
            )}
          </Box>

          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block', mt: 1.75, mb: 0.75, fontWeight: 800, letterSpacing: 0.45, textTransform: 'uppercase' }}
          >
            Actions
          </Typography>
          <Box
            component="section"
            aria-label="Tier actions"
            sx={{ display: 'flex', alignItems: 'stretch', gap: 1.25, flexWrap: 'wrap' }}
          >
            {!effectiveReadOnly && (
              <Button
                variant="contained"
                color="success"
                startIcon={<SaveIcon />}
                onClick={handleSave}
                disabled={isSaving || isCreatingVersion || !tierData || !isDirty}
                sx={{ width: { xs: '100%', sm: 'auto' }, minWidth: 140, fontWeight: 750 }}
              >
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
            )}
            {!effectiveReadOnly && (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  flex: '1 1 590px',
                  flexWrap: 'wrap',
                }}
              >
                <Button
                  variant="outlined"
                  color="warning"
                  startIcon={<AddCircleOutlineIcon />}
                  onClick={handleCreateNewVersion}
                  disabled={isSaving || isCreatingVersion || !tierData || Number(currentVersion) <= 0}
                  sx={{ minWidth: 150 }}
                  title="Lock the current version and create a new one"
                >
                  {isCreatingVersion ? 'Creating...' : 'New Version'}
                </Button>
                <TextField
                  size="small"
                  placeholder="Version note (optional)"
                  value={revisionComment}
                  onChange={(e) => setRevisionComment(e.target.value)}
                  sx={{ minWidth: { xs: '100%', sm: 210 }, maxWidth: { sm: 280 }, flexGrow: { sm: 1 } }}
                />
                <Button
                  variant="outlined"
                  color="primary"
                  startIcon={<HistoryIcon />}
                  onClick={handleOpenRevisions}
                  disabled={!activeFiscalYear || !selectedRegion || selectedRegion === 'ALL'}
                  sx={{ minWidth: 140 }}
                >
                  Version history
                </Button>
                <Button
                  variant="outlined"
                  color="inherit"
                  onClick={() => {
                    if (!tierData) return;
                    setConfirmDialog({
                      open: true,
                      title: 'I-reset ang Tier Inputs',
                      message: 'Ire-reset ang lahat ng Tier inputs. Hindi na ito maibabalik. Ituloy?',
                      onConfirm: () => {
                        setTableKey(Date.now());
                        setTierData(null);
                        lastSavedJsonRef.current = null;
                        setLastSavedJson(null);
                        setIsDirty(false);
                        setSnackbar({ open: true, message: 'Inputs reset', severity: 'info' });
                      },
                    });
                  }}
                  sx={{ minWidth: 120 }}
                >
                  Reset
                </Button>
              </Box>
            )}

            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                flexWrap: 'wrap',
                ml: { lg: 'auto' },
                pl: { lg: 1.5 },
                borderLeft: { lg: 1 },
                borderColor: 'divider',
              }}
            >
              {isNepContext && (
                <Box
                  component="aside"
                  aria-label="NEP report readiness"
                  sx={{
                    minWidth: { xs: '100%', sm: 245 },
                    maxWidth: { sm: 310 },
                    pr: { sm: 0.75 },
                  }}
                >
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block', fontWeight: 800, letterSpacing: 0.45, textTransform: 'uppercase' }}
                  >
                    Report readiness
                  </Typography>
                  <Chip
                    size="small"
                    color={nepReportContext?.readiness?.color || 'default'}
                    variant={nepReportContext?.readiness?.key === 'OVER_CEILING' ? 'filled' : 'outlined'}
                    label={nepReportContext?.readiness?.label || 'Loading ceiling context…'}
                    sx={{ mt: 0.4, maxWidth: '100%', fontWeight: 750 }}
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.35, lineHeight: 1.3 }}>
                    {nepReportContext?.readiness?.helper || 'Report actions become available after the approved ceiling loads.'}
                  </Typography>
                </Box>
              )}
              <Button
                variant="outlined"
                color="primary"
                startIcon={<PictureAsPdfIcon />}
                onClick={handleViewPDF}
                disabled={!tierData?.reportSummary || !reportContextAvailable || isGeneratingPdf}
                sx={{ minWidth: isNepContext ? 210 : 160 }}
              >
                {isGeneratingPdf
                  ? 'Generating...'
                  : isNepContext
                    ? 'View NEP Alignment Report'
                    : 'View Tier Report'}
              </Button>
              <Button
                variant="outlined"
                color="primary"
                startIcon={<TableChartIcon />}
                onClick={handleExportExcel}
                disabled={!tierData?.reportSummary || !reportContextAvailable || isExportingExcel}
                sx={{ minWidth: isNepContext ? 190 : 160 }}
              >
                {isExportingExcel
                  ? 'Exporting...'
                  : isNepContext
                    ? 'Export NEP Alignment'
                    : 'Export Tier Excel'}
              </Button>
            </Box>
          </Box>
        </Box>
      </Paper>

      {isProposalScopeLoading ? (
        <Box sx={{ p: 3, textAlign: "center", backgroundColor: "action.hover", borderRadius: 1 }}>
          <CircularProgress size={28} sx={{ mb: 1.5 }} />
          <Typography variant="body1" sx={{ fontWeight: 700 }}>
            Restoring proposal scope…
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Loading the fiscal year, region, department, and division for this NEP proposal.
          </Typography>
        </Box>
      ) : !activeFiscalYear ? (
        <Box sx={{ p: 3, textAlign: "center", backgroundColor: "#f5f5f5", borderRadius: 1 }}>
          <CircularProgress sx={{ mb: 2 }} />
          <Typography variant="body2" color="textSecondary">Loading Tier data...</Typography>
        </Box>
      ) : !selectedRegion ? (
        <Box sx={{ p: 4, textAlign: "center", backgroundColor: "#f5f5f5", borderRadius: 1 }}>
          <Typography variant="body1" color="textSecondary" gutterBottom>
            Select Region to view Tier data
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Please select a Region (and optionally Department/Division) from the filters above to display the Tier table.
          </Typography>
        </Box>
      ) : (
        <>
      {proposalForCeiling && (
        <NEPCeilingSummary
          proposal={proposalForCeiling}
          liveTotals={liveCeilingTotals}
          hasUnsavedChanges={isDirty}
          showStickyTracker
          onReportContextChange={setNepReportContext}
        />
      )}
          {!effectiveReadOnly && (
            <Box sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Chip size="small" label="Modified rows are highlighted" sx={{ backgroundColor: 'warning.light', fontWeight: 500 }} />
            </Box>
          )}
          <TierTable
            key={tableKey}
            fiscalYear={activeFiscalYear}
            region={selectedRegion}
            regionName={selectedRegion !== 'ALL' && regions?.find(r => r._id === selectedRegion || String(r._id) === String(selectedRegion))?.Region}
            department={selectedDepartment}
            division={selectedDivision}
            departmentName={selectedDepartmentName}
            divisionName={selectedDivisionName}
            onTierDataChange={setTierData}
            onVersionChange={setCurrentVersion}
            independentTierEditing={Boolean(proposalForCeiling)}
            readOnly={effectiveReadOnly}
          />
        </>
      )}

      <GenericPdfPreviewDialog
        open={pdfViewerOpen}
        onClose={handleClosePdfViewer}
        pdfUrl={pdfBlobUrl}
        title={isNepContext ? "NEP Budget Alignment Report Preview" : "Tier Budget Proposal Report Preview"}
        downloadFilename={pdfFilename}
      />

      <Dialog
        open={revisionsDrawerOpen}
        onClose={() => setRevisionsDrawerOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: 1, borderColor: 'divider', py: 1.5 }}>
          <Box>
            <Typography variant="h6">Version history</Typography>
            <Typography variant="caption" color="text.secondary" display="block">
              Only the latest 3 saves are kept. Version number = save count. <strong>Restore</strong> = ilalagay sa table ang <strong>exact data ng version na iyon</strong> (hindi babalik sa &quot;original&quot; o pinakauna — makikita mo kung ano ang na-save sa version na pinili mo).
            </Typography>
          </Box>
          <IconButton onClick={() => setRevisionsDrawerOpen(false)} aria-label="close" size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 0, overflow: 'auto', maxHeight: '70vh' }}>
          {revisionsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={32} />
            </Box>
          ) : revisions.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ p: 3 }}>
              No revisions yet. Each time you save, that version is stored here (latest 3 only). Add a revision note when saving so you can tell them apart when restoring.
            </Typography>
          ) : (
            <List dense>
              {revisions.map((rev, index) => (
                <ListItem key={rev._id} divider>
                  <ListItemText
                    primary={
                      <Typography variant="subtitle1" fontWeight={600}>
                        {rev.comment && rev.comment.trim() ? rev.comment : `Saved revision v${rev.version}`}
                      </Typography>
                    }
                    secondary={
                      <>
                        <Typography component="span" variant="body2" color="text.secondary">
                          Version {rev.version}
                          {rev.fiscalYear ? ` · FY ${rev.fiscalYear}` : ''}
                          {index === 0 && ' (newest)'}
                          {' · '}
                          {formatRevisionDate(rev.createdAt)}
                        </Typography>
                        {(rev.createdBy || rev.createdByName) && (
                          <Typography component="span" variant="caption" display="block" color="text.secondary" sx={{ mt: 0.25 }}>
                            By {rev.createdBy ? (rev.createdBy.name || rev.createdBy.username) : rev.createdByName || '—'}
                          </Typography>
                        )}
                      </>
                    }
                  />
                  <ListItemSecondaryAction sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<VisibilityIcon />}
                      onClick={() => handleViewRevision(rev._id)}
                      disabled={viewRevisionLoading}
                    >
                      View
                    </Button>
                    <Button
                      size="small"
                      startIcon={<RestoreIcon />}
                      onClick={() => handleRestoreRevision(rev._id)}
                      disabled={restoringId != null}
                    >
                      {restoringId === rev._id ? 'Restoring...' : 'Restore'}
                    </Button>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
      </Dialog>

      {/* View revision dialog — view contents before restoring */}
      <Dialog
        open={viewRevisionOpen}
        onClose={handleCloseViewRevision}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: 1, borderColor: 'divider', py: 1.5 }}>
          <Typography variant="h6">View revision</Typography>
          <IconButton onClick={handleCloseViewRevision} aria-label="close" size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {viewRevisionLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={32} />
            </Box>
          ) : viewRevisionDetail ? (
            <>
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle1" fontWeight={600}>
                  {viewRevisionDetail.comment && viewRevisionDetail.comment.trim() ? viewRevisionDetail.comment : `Saved revision v${viewRevisionDetail.version}`}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Version {viewRevisionDetail.version} · {formatRevisionDate(viewRevisionDetail.createdAt)}
                  {((viewRevisionDetail.createdBy || viewRevisionDetail.createdByName)) && ` · By ${viewRevisionDetail.createdBy ? (viewRevisionDetail.createdBy.name || viewRevisionDetail.createdBy.username) : viewRevisionDetail.createdByName || '—'}`}
                </Typography>
              </Box>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>Line items (Tier 1 / Tier 2)</Typography>
              <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 360, overflow: 'auto' }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>Line item</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>Tier 1</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>Tier 2</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>Total</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(Array.isArray(viewRevisionDetail.items) ? viewRevisionDetail.items : []).map((it, i) => {
                      const t1 = Number(it.tier1) || 0;
                      const t2 = Number(it.tier2) || 0;
                      return (
                        <TableRow key={it.lineItemId || i}>
                          <TableCell sx={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis' }} title={it.lineItemId}>{it.lineItemId || it.description || '—'}</TableCell>
                          <TableCell align="right">{formatCurrency(t1)}</TableCell>
                          <TableCell align="right">{formatCurrency(t2)}</TableCell>
                          <TableCell align="right">{formatCurrency(t1 + t2)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
              {(!viewRevisionDetail.items || viewRevisionDetail.items.length === 0) && (
                <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>No line items in this revision.</Typography>
              )}
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 2 }}>
                <Button variant="outlined" onClick={handleCloseViewRevision}>Close</Button>
                <Button variant="contained" color="primary" startIcon={<RestoreIcon />} onClick={() => handleRestoreRevision(viewRevisionDetail._id)} disabled={restoringId != null}>
                  {restoringId === viewRevisionDetail._id ? 'Restoring...' : 'Restore this version'}
                </Button>
              </Box>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Reusable Confirm Dialog */}
      <Dialog
        open={confirmDialog.open}
        onClose={() => setConfirmDialog((s) => ({ ...s, open: false }))}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        <DialogTitle sx={{ fontWeight: 700, pb: 0.5 }}>
          {confirmDialog.title}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>{confirmDialog.message}</DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button
            variant="outlined"
            onClick={() => setConfirmDialog((s) => ({ ...s, open: false }))}
            sx={{ minWidth: 90 }}
          >
            Kanselahin
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={() => {
              setConfirmDialog((s) => ({ ...s, open: false }));
              confirmDialog.onConfirm?.();
            }}
            sx={{ minWidth: 90 }}
            autoFocus
          >
            OK, Ituloy
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setSnackbar(s => ({ ...s, open: false }))} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default TierPage;
