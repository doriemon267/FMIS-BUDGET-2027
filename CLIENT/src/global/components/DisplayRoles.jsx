import * as React from "react";
import { Box, IconButton, Collapse, List, ListItem, Tooltip } from "@mui/material";
import { FaUserCircle } from "react-icons/fa";
import { IoMdArrowDropdown, IoMdArrowDropup } from "react-icons/io";
import { useUser } from "../../context/UserContext";

const DisplayRoles = ({ collapsed = false }) => {
  const { currentUser } = useUser();
  const [open, setOpen] = React.useState(false);

  const handleClick = () => {
    setOpen(!open);
  };

  const isOneRole = currentUser.Roles.length === 1;
  const displayRole = currentUser.Roles[0]?.toLowerCase()?.includes("super")
    ? "ADMIN"
    : currentUser.Roles[0] || "User";

  const renderContent = () => (
    <Box
      p={collapsed ? 1 : 2}
      color="white"
      display="flex"
      gap={collapsed ? 0 : 2}
      borderBottom={1}
      borderColor="secondary.main"
      alignItems="center"
      onClick={!collapsed && !isOneRole ? handleClick : undefined}
      sx={{
        cursor: !collapsed && !isOneRole ? "pointer" : "default",
        justifyContent: collapsed ? "center" : "flex-start",
      }}
    >
      <Box
        display="flex"
        fontWeight={600}
        alignItems="center"
        justifyContent={collapsed ? "center" : (!isOneRole ? "space-between" : "flex-start")}
        width="100%"
        gap={collapsed ? 0 : 2}
      >
        <FaUserCircle size={collapsed ? 28 : 25} />
        {!collapsed && (
          <>
            <span>{displayRole}</span>
            {!isOneRole && (
              <IconButton size="small" sx={{ color: "white" }}>
                {open ? <IoMdArrowDropup /> : <IoMdArrowDropdown />}
              </IconButton>
            )}
          </>
        )}
      </Box>
    </Box>
  );

  return (
    <>
      {collapsed ? (
        <Tooltip
          title={`Role: ${displayRole}`}
          placement="right"
          arrow
          componentsProps={{
            tooltip: {
              sx: {
                bgcolor: 'rgba(0, 0, 0, 0.9)',
                fontSize: '0.875rem',
                fontWeight: 500,
                '& .MuiTooltip-arrow': {
                  color: 'rgba(0, 0, 0, 0.9)',
                },
              },
            },
          }}
        >
          {renderContent()}
        </Tooltip>
      ) : (
        renderContent()
      )}
      {!isOneRole && !collapsed && (
        <Box color="white" mt={-0.7}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <List
              component="nav"
              sx={{ borderBottom: 1, borderColor: "secondary.main" }}
            >
              {currentUser.Roles.length > 0 ? (
                currentUser.Roles.map((role, index) => (
                  <ListItem key={index} sx={{ fontWeight: 600 }}>
                    {role.toLowerCase().includes("super") ? "Admin" : role}
                  </ListItem>
                ))
              ) : (
                <ListItem key={1}>User</ListItem>
              )}
            </List>
          </Collapse>
        </Box>
      )}
    </>
  );
};
export default DisplayRoles;