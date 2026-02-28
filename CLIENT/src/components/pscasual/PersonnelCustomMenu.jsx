import { Button, MenuItem } from "@mui/material";
import Divider from "@mui/material/Divider";
import List from "@mui/material/List";
import Popover from "@mui/material/Popover";
import { alpha, styled } from "@mui/material/styles";
import * as React from "react";
import { IoMdClose } from "react-icons/io";
import { IoCaretDownSharp } from "react-icons/io5";
import VisibilityIcon from '@mui/icons-material/Visibility'; // Import the visibility icon
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
  onAfterInvalidate,
  disableEdit = false,
  disableDelete = false,
}) {
  const [anchorEl, setAnchorEl] = React.useState(null);
  const open = Boolean(anchorEl);
  const handleClick = (event) => setAnchorEl(event.currentTarget);
  const handleClose = () => setAnchorEl(null);

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
          {hasEdit && !disableEdit && (
            <CustomCreateUpdateDialog
              dataListName={dataListName}
              endpoint={endpoint}
              parentClose={handleClose}
              row={row}
              schema={schema}
              onAfterInvalidate={onAfterInvalidate}
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
          {hasDelete && !disableDelete && (
            <CustomDeleteDialog
              row={row}
              endpoint={endpoint}
              parentClose={handleClose}
              dataListName={dataListName}
              onAfterInvalidate={onAfterInvalidate}
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
