import React, { useState, useEffect } from "react";
//import OvertimePayEditableRow from "./OvertimePayEditableRow";
import api from "../../config/api";

const ParentComponent = () => {
  const [activeSettings, setActiveSettings] = useState(null);
  const [rows, setRows] = useState([]);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await api.get("/settings/active");
        if (res.data) {
          setActiveSettings(res.data);
        } else {
          console.error("No active settings found.");
        }
      } catch (err) {
        console.error("Error fetching active settings:", err);
      }
    };

    const fetchRows = async () => {
      try {
        const res = await api.get("/overtime-pay");
        setRows(res.data);
      } catch (err) {
        console.error("Error fetching rows:", err);
      }
    };

    fetchSettings();
    fetchRows();
  }, []);

  if (!activeSettings) {
    return <div>Loading settings...</div>; // Fallback while settings are loading
  }

  return (
    <div>
      {rows.map((row) => (
        <OvertimePayEditableRow
          key={row._id}
          row={row}
          refreshData={() => fetchRows()}
          activeSettings={activeSettings}
        />
      ))}
    </div>
  );
};

export default ParentComponent;