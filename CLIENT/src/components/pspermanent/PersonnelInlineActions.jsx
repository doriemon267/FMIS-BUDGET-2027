import React from "react";
import { IconButton, Tooltip } from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import VisibilityIcon from "@mui/icons-material/Visibility";

export default function PersonnelInlineActions({
  row,
  endpoint,
  dataListName,
  hasEdit,
  hasDelete,
  customEditElement,
  additionalMenuOptions = [],
  refreshData,
}) {
  const handleEdit = () => {
    // I-trigger ang edit dialog o customEditElement kung available.
    // Halimbawa: kung customEditElement ay isang function, tawagin ito
    if (customEditElement && typeof customEditElement === "function") {
      customEditElement(row);
    }
  };

  const handleView = () => {
    // I-trigger ang view functionality
  };

  const handleDelete = () => {
    // I-trigger ang delete functionality; maaaring magbukas ng confirmation dialog.
  };

  return (
    <>
      {hasEdit && (
        <Tooltip title="Edit">
          <IconButton onClick={handleEdit} size="small">
            <EditIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
      <Tooltip title="View">
        <IconButton onClick={handleView} size="small">
          <VisibilityIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      {hasDelete && (
        <Tooltip title="Delete">
          <IconButton onClick={handleDelete} size="small">
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
      {additionalMenuOptions &&
        additionalMenuOptions.map((OptionComponent, index) => (
          <OptionComponent
            key={index}
            row={row}
            endpoint={endpoint}
            dataListName={dataListName}
            refreshData={refreshData}
          />
        ))}
    </>
  );
}
