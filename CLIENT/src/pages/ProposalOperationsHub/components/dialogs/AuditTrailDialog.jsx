import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  CircularProgress,
  Box,
  Button,
  useTheme,
} from "@mui/material";
import { ExpandMore as ExpandMoreIcon } from "@mui/icons-material";

const AuditTrailDialog = ({ open, onClose, auditTrailLoading, auditTrailData = [] }) => {
  const theme = useTheme();
  const headerBg = theme.palette.mode === "dark" ? "#0b2413" : "#2d5016";

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: "12px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
        },
      }}
    >
      <DialogTitle
        sx={{
          bgcolor: headerBg,
          color: "white",
          fontWeight: "bold",
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          fontSize: "1.1rem",
          py: 2.5,
          px: 3,
        }}
      >
        <Box
          sx={{
            width: 28,
            height: 28,
            bgcolor: "rgba(255,255,255,0.15)",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <ExpandMoreIcon sx={{ fontSize: "1.2rem" }} />
        </Box>
        Change Log
      </DialogTitle>
      <DialogContent sx={{ p: 3, bgcolor: "#f8fafb" }}>
        {auditTrailLoading ? (
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              p: 6,
            }}
          >
            <CircularProgress />
          </Box>
        ) : auditTrailData && auditTrailData.length > 0 ? (
          <Box sx={{ overflowX: "auto", maxHeight: 600, overflowY: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr
                  style={{
                    backgroundColor: "#f5f5f5",
                    borderBottom: "2px solid #ddd",
                  }}
                >
                  <th
                    style={{
                      padding: "10px",
                      textAlign: "left",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      borderRight: "1px solid #ddd",
                    }}
                  >
                    Date/Time
                  </th>
                  <th
                    style={{
                      padding: "10px",
                      textAlign: "left",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      borderRight: "1px solid #ddd",
                    }}
                  >
                    User
                  </th>
                  <th
                    style={{
                      padding: "10px",
                      textAlign: "left",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      borderRight: "1px solid #ddd",
                    }}
                  >
                    Proposal Type
                  </th>
                  <th
                    style={{
                      padding: "10px",
                      textAlign: "left",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      borderRight: "1px solid #ddd",
                    }}
                  >
                    Category
                  </th>
                  <th
                    style={{
                      padding: "10px",
                      textAlign: "left",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      borderRight: "1px solid #ddd",
                    }}
                  >
                    Field Changed
                  </th>
                  <th
                    style={{
                      padding: "10px",
                      textAlign: "left",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                    }}
                  >
                    Old Value → New Value
                  </th>
                </tr>
              </thead>
              <tbody>
                {auditTrailData.map((change, index) => (
                  <tr
                    key={index}
                    style={{
                      borderBottom: "1px solid #e0e0e0",
                      backgroundColor: index % 2 === 0 ? "#ffffff" : "#fafafa",
                    }}
                  >
                    <td
                      style={{
                        padding: "10px",
                        fontSize: "0.75rem",
                        borderRight: "1px solid #ddd",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {new Date(change.timestamp).toLocaleString()}
                    </td>
                    <td
                      style={{
                        padding: "10px",
                        fontSize: "0.75rem",
                        borderRight: "1px solid #ddd",
                      }}
                    >
                      <div style={{ fontWeight: 600 }}>
                        {change.performedBy || "System"}
                      </div>
                    </td>
                    <td
                      style={{
                        padding: "10px",
                        fontSize: "0.75rem",
                        borderRight: "1px solid #ddd",
                      }}
                    >
                      {change.proposalType || "-"}
                    </td>
                    <td
                      style={{
                        padding: "10px",
                        fontSize: "0.75rem",
                        borderRight: "1px solid #ddd",
                      }}
                    >
                      {change.actionType?.replace(/([A-Z])/g, " $1").trim() || "-"}
                    </td>
                    <td
                      style={{
                        padding: "10px",
                        fontSize: "0.75rem",
                        borderRight: "1px solid #ddd",
                      }}
                    >
                      {change.changedFields && change.changedFields.length > 0
                        ? change.changedFields.join(", ")
                        : "-"}
                    </td>
                    <td
                      style={{
                        padding: "10px",
                        fontSize: "0.75rem",
                        maxWidth: "200px",
                      }}
                    >
                      {change.details && change.details.length > 0 ? (
                        <div>
                          {change.details.map((detail, i) => (
                            <div key={i} style={{ marginBottom: "4px" }}>
                              <span style={{ color: "#d32f2f" }}>
                                {detail.oldValue != null
                                  ? Number(detail.oldValue)
                                      .toLocaleString(undefined, {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      })
                                      .substring(0, 20)
                                  : "-"}
                              </span>

                              {" → "}
                              <span style={{ color: "#388e3c" }}>
                                {detail.newValue != null
                                  ? Number(detail.newValue)
                                      .toLocaleString(undefined, {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      })
                                      .substring(0, 20)
                                  : "-"}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Box>
        ) : (
          <Box sx={{ textAlign: "center", p: 4 }}>
            <Typography sx={{ color: "#666" }}>No changes recorded</Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions
        sx={{
          p: 3,
          borderTop: "1px solid #e0e0e0",
          bgcolor:
            theme.palette.mode === "dark" ? "background.paper" : "#f9fafb",
        }}
      >
        <Button
          onClick={onClose}
          variant="contained"
          sx={{
            bgcolor: headerBg,
            color: "white",
            textTransform: "none",
            fontWeight: 600,
            px: 4,
            py: 1.2,
            borderRadius: "6px",
            "&:hover": {
              bgcolor: theme.palette.mode === "dark" ? "#14331d" : "#1e3a0f",
              boxShadow:
                theme.palette.mode === "dark"
                  ? "none"
                  : "0 4px 12px rgba(45, 80, 22, 0.2)",
            },
          }}
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AuditTrailDialog;
