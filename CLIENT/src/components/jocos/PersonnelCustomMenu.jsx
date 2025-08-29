import { Button, MenuItem } from "@mui/material";
import Divider from "@mui/material/Divider";
import List from "@mui/material/List";
import Popover from "@mui/material/Popover";
import { alpha, styled } from "@mui/material/styles";
import * as React from "react";
import { IoMdClose } from "react-icons/io";
import { IoCaretDownSharp } from "react-icons/io5";
import CustomCreateUpdateDialog from "../../global/components/CustomCreateUpdateDialog";
import CustomDeleteDialog from "../../global/components/CustomDeleteDialog";

const StyledPopover = styled(Popover)(({ theme }) => ({
  "& .MuiPaper-root": {
    borderRadius: 6,
    marginTop: theme.spacing(1),
    minWidth: 180,
    color: "rgb(55, 65, 81)",
    boxShadow:
      "rgb(255, 255, 255) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 0px 0px 1px, rgba(0, 0, 0, 0.1) 0px 10px 15px -3px, rgba(0, 0, 0, 0.05) 0px 4px 6px -2px",
    "& .MuiList-root": {
      padding: "4px 0",
    },
    "& .MuiListItemButton-root": {
      "&:hover": {
        backgroundColor: alpha(
          theme.palette.primary.main,
          theme.palette.action.selectedOpacity
        ),
      },
    },
    ...theme.applyStyles?.("dark", {
      color: theme.palette.grey[300],
    }),
  },
}));

export default function CustomMenu({
  row,
  schema,
  endpoint,
  dataListName,
  hasEdit,
  hasDelete,
  customEditElement,
  additionalMenuOptions = [],
  disableEdit = false,
  disableDelete = false,
  activeFiscalYear, // bagong prop para sa active fiscalYear
}) {
  const [anchorEl, setAnchorEl] = React.useState(null);
  const open = Boolean(anchorEl);
  const handleClick = (event) => setAnchorEl(event.currentTarget);
  const handleClose = () => setAnchorEl(null);

  // Enhanced disable logic
  const isEditDisabled = disableEdit ||
    row.status === "Submitted" ||
    (activeFiscalYear && row.fiscalYear !== activeFiscalYear);

  const isDeleteDisabled = disableDelete ||
    row.status === "Submitted" ||
    (activeFiscalYear && row.fiscalYear !== activeFiscalYear);

  return (
    <div>
      <Button
        startIcon={<IoCaretDownSharp />}
        onClick={handleClick}
        size="small"
        variant="contained"
      >
        Actions
      </Button>

      <StyledPopover
        id="custom-menu"
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "right",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "right",
        }}
      >
        <List>
          {/* Edit Option */}
          {hasEdit && !isEditDisabled && (
            <CustomCreateUpdateDialog
              dataListName={dataListName}
              endpoint={endpoint}
              parentClose={handleClose}
              row={row}
              schema={schema}
            />
          )}

          {customEditElement && customEditElement}

          {/* Additional Options */}
          {additionalMenuOptions.map((Component, index) => (
            <Component
              key={index}
              row={row}
              endpoint={endpoint}
              parentClose={handleClose}
              dataListName={dataListName}
            />
          ))}

          <Divider />

          {/* Delete Option */}
          {hasDelete && !isDeleteDisabled && (
            <CustomDeleteDialog
              row={row}
              endpoint={endpoint}
              parentClose={handleClose}
              dataListName={dataListName}
            />
          )}

          {/* Close Option */}
          <MenuItem onClick={handleClose} sx={{ display: "flex", gap: 1 }}>
            <IoMdClose />
            Close
          </MenuItem>
        </List>
      </StyledPopover>
    </div>
  );
}
