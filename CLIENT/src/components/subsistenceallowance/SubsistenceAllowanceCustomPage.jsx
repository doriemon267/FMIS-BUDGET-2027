import React from "react";
import CustomCreateUpdateDialog from "../subsistenceallowance/SubsistenceAllowanceDialog";
import CustomMenu from "../../global/components/CustomMenu";
import CustomTable from "../subsistenceallowance/SubsistenceAllowanceCustomTable";
import PropTypes from "prop-types";
import { Box, Paper, Typography, Chip, Zoom } from "@mui/material";
import { LocalDining as DiningIcon } from "@mui/icons-material";

const CustomPage = ({
  dataListName,
  schema,
  title = "",
  description = "",
  searchable = true,
  hasEdit = true,
  hasDelete = true,
  hasAdd = true,
  customAddElement = null,
  customEditElement = null,
  additionalMenuOptions = [],
  ROWS_PER_PAGE = 20,
}) => {
  const pageTitle = title || "Subsistence Allowance";
  const pageDescription = description || "Manage subsistence allowance (amount from Compensation Management monthly × 12).";
  const apiPath = `/${dataListName}`;
  return (
    <Box sx={{ p: 0 }}>
      <Paper sx={{
        p: 3,
        mb: 3,
        mx: 3,
        borderRadius: 2,
        background: "linear-gradient(135deg, #375e38 0%, #2e4d30 100%)",
        color: "white",
        boxShadow: "0 8px 32px rgba(0,0,0,0.1)",
        transition: "all 0.3s ease",
        "&:hover": {
          boxShadow: "0 12px 40px rgba(0,0,0,0.2)",
          transform: "translateY(-2px)",
        },
      }}>
        <Box display="flex" alignItems="center" gap={2}>
          <DiningIcon sx={{ fontSize: "2rem", transition: "transform 0.3s ease", "&:hover": { transform: "rotate(20deg) scale(1.2)" } }} />
          <Box>
            <Typography variant="h4" fontWeight="bold" gutterBottom>
              Subsistence Allowance
            </Typography>
            <Typography variant="body1" sx={{ opacity: 0.9 }}>
              {pageDescription}
            </Typography>
            <Box display="flex" gap={1} mt={2}>
              <Chip label="Compensation-based" size="small" sx={{ backgroundColor: "rgba(255,255,255,0.2)", color: "white", fontWeight: "bold" }} />
              <Chip label="Monthly rate in Compensation" size="small" sx={{ backgroundColor: "rgba(255,255,255,0.2)", color: "white", fontWeight: "bold" }} />
            </Box>
          </Box>
        </Box>
        {hasAdd && (
          <Box sx={{ mt: 2, display: "flex", justifyContent: "flex-end" }}>
            {customAddElement || (
              <CustomCreateUpdateDialog endpoint={apiPath} schema={schema} dataListName={dataListName} />
            )}
          </Box>
        )}
      </Paper>

      <Box sx={{ mx: 3 }}>
        <Zoom in={true} timeout={600}>
          <Paper sx={{ width: "100%", overflow: "hidden", borderRadius: 2, boxShadow: "0 8px 32px rgba(0,0,0,0.1)" }}>
            <CustomTable
              dataListName={dataListName}
              apiPath={apiPath}
              ROWS_PER_PAGE={ROWS_PER_PAGE}
              columns={Object.keys(schema)
                .filter((key) => schema[key].show === true || key === "action")
                .map((key) => {
                  const fieldSchema = schema[key];
                  const column = { field: key, label: fieldSchema.label, type: fieldSchema.type, searchable: fieldSchema.searchable || false };
                  if (fieldSchema.type === "action") {
                    column.render = (row) => (
                      <CustomMenu
                        additionalMenuOptions={additionalMenuOptions}
                        customEditElement={customEditElement}
                        hasEdit={hasEdit}
                        hasDelete={hasDelete}
                        row={row}
                        schema={schema}
                        endpoint={apiPath}
                        dataListName={dataListName}
                      />
                    );
                  }
                  if (fieldSchema.customRender) column.render = (row) => fieldSchema.customRender(row);
                  return column;
                })}
            />
          </Paper>
        </Zoom>
      </Box>
    </Box>
  );
};

CustomPage.propTypes = {
  dataListName: PropTypes.string.isRequired,
  schema: PropTypes.object.isRequired,
  title: PropTypes.string,
  description: PropTypes.string,
  searchable: PropTypes.bool,
  hasEdit: PropTypes.bool,
  hasDelete: PropTypes.bool,
  hasAdd: PropTypes.bool,
  customAddElement: PropTypes.element,
  customEditElement: PropTypes.element,
  additionalMenuOptions: PropTypes.arrayOf(PropTypes.elementType),
};

export default CustomPage;
