import { useState, useCallback, useEffect } from "react";
import api from "../../config/api";
import { useRegion } from "../../context/RegionContext";
import { toast } from "react-toastify";

export const useCapitalOutlayData = (onDataChange) => {
  const [capitalOutlays, setCapitalOutlays] = useState([]);
  const [categories, setCategories] = useState([]);
  const [accountingTitles, setAccountingTitles] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fiscalYear, setFiscalYear] = useState("");
  const [budgetType, setBudgetType] = useState("");
  const [regionFilter, setRegionFilter] = useState("");
  const [status, setStatus] = useState("");
  const [dueDateStatus, setDueDateStatus] = useState(null);
  const [capitalOutlayDetails, setCapitalOutlayDetails] = useState({});
  const { activeRegion } = useRegion();

  // Update region filter when active region changes
  useEffect(() => {
    if (activeRegion) {
      const regionName = activeRegion.name || activeRegion.regionName;
      setRegionFilter(regionName);
    } else {
      setRegionFilter("");
    }
  }, [activeRegion]);

  // Function to fetch details for all capital outlays
  const fetchAllCapitalOutlayDetails = useCallback(async (outlays) => {
    const detailsPromises = outlays.map(async (outlay) => {
      try {
        const response = await api.get(`/api/capital-outlay/${outlay._id}/details`);
        setCapitalOutlayDetails(prev => ({
          ...prev,
          [outlay._id]: response.data.details || []
        }));
      } catch (error) {
        console.error(`Error fetching details for outlay ${outlay._id}:`, error);
      }
    });
    await Promise.allSettled(detailsPromises);
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      const params = new URLSearchParams();
      if (regionFilter) {
        params.append('region', regionFilter);
      }

      const [outlaysRes, categoriesRes, dueDateRes] = await Promise.all([
        api.get(`/capital-outlays?${params.toString()}`),
        api.get("/categories"),
        api.get("/due-date-status").catch(err => {
          console.warn("Could not fetch due date status:", err);
          return null;
        })
      ]);

      const outlaysWithStatus = outlaysRes.data.capitalOutlays.map((item) => ({
        ...item,
        status: item.status || "Not Submitted",
      }));

      setCapitalOutlays(outlaysWithStatus);
      const categoriesData = categoriesRes.data.categories || [];
      setCategories(categoriesData);

      if (dueDateRes && dueDateRes.data) {
        setDueDateStatus(dueDateRes.data);
      }

      await fetchAllCapitalOutlayDetails(outlaysWithStatus);

      setStatus(outlaysRes.data.status || "Not Submitted");
      onDataChange?.(outlaysWithStatus);
    } catch (error) {
      console.error("Error fetching data:", error);
      setError("Failed to retrieve data.");
      toast.error("Failed to retrieve data.");
    } finally {
      setLoading(false);
    }
  }, [regionFilter, fetchAllCapitalOutlayDetails, onDataChange]);

  const fetchFiscalYear = useCallback(async () => {
    try {
      const response = await api.get("/settings/active");
      if (response.data && response.data.fiscalYear) {
        setFiscalYear(response.data.fiscalYear);
        setBudgetType(response.data.budgetType);
      }
    } catch (error) {
      console.error("Error fetching active fiscal year:", error);
      toast.error("Error fetching active fiscal year.");
    }
  }, []);

  const refreshData = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  const handleDetailsSaved = useCallback(async (capitalOutlayId, totals) => {
    try {
      // Fetch the updated details
      const detailsResponse = await api.get(`/api/capital-outlay/${capitalOutlayId}/details`);
      const details = detailsResponse.data.details || [];

      setCapitalOutlayDetails(prev => ({
        ...prev,
        [capitalOutlayId]: details
      }));

      // Extract particulars from the details - combine all particulars from breakdown items
      const particularsFromDetails = details
        .map(d => d.particulars)
        .filter(Boolean)
        .join('; ');

      // Update the main capital outlay record with new totals and particulars
      setCapitalOutlays(prev => {
        const updatedOutlays = prev.map(item =>
          item._id === capitalOutlayId
            ? {
                ...item,
                income: totals.income,
                subsidy: totals.subsidy,
                cost: totals.cost,
                particulars: particularsFromDetails || item.particulars // Update particulars from details
              }
            : item
        );

        // Notify parent component of data change
        onDataChange?.(updatedOutlays);
        return updatedOutlays;
      });
    } catch (error) {
      console.error("Error fetching capital outlay details:", error);
    }
  }, [onDataChange]);

  // Initial data fetch
  useEffect(() => {
    fetchData();
    fetchFiscalYear();
  }, [fetchData, fetchFiscalYear]);

  return {
    capitalOutlays,
    categories,
    accountingTitles,
    loading,
    error,
    fiscalYear,
    budgetType,
    regionFilter,
    status,
    dueDateStatus,
    capitalOutlayDetails,
    setCapitalOutlays,
    setCategories,
    setAccountingTitles,
    setCapitalOutlayDetails,
    refreshData,
    handleDetailsSaved,
    fetchAllCapitalOutlayDetails,
  };
};