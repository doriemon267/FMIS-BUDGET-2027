import React from "react";
import CustomCreateUpdateDialog from "./CustomCreateUpdateDialog";
import CustomMenu from "./CustomMenu";
import CustomTable from "./CustomTable";
import DashboardHeader from "./DashboardHeader";
import PropTypes from "prop-types";

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
  hasNotification = false,
  ROWS_PER_PAGE = 20,
  filter = {}, // Added filter prop
  orderByDefault = "updatedAt",
}) => {
  const pageTitle =
    title || dataListName.charAt(0).toUpperCase() + dataListName.slice(1);
  const pageDescription = description || `Manage ${dataListName}`;
  const apiPath = `/${dataListName}`;

  return (
    <>
            
         <DashboardHeader
        hasNotification={hasNotification}
        title={pageTitle}
        description={pageDescription}
        searchable={searchable}
        childElement={
          hasAdd
            ? customAddElement || (
                <CustomCreateUpdateDialog
                  endpoint={apiPath}
                  schema={schema}
                  dataListName={dataListName}
                />
              )
            : null
        }
      />

      <CustomTable
        dataListName={dataListName}
        apiPath={apiPath}
        ROWS_PER_PAGE={ROWS_PER_PAGE}
        columns={Object.keys(schema)
          .filter((key) => schema[key].show === true || key === "action") // Always include "action"
          .map((key) => {
            const fieldSchema = schema[key];
            const column = {
              field: key,
              label: fieldSchema.label,
              type: fieldSchema.type,
              searchable: fieldSchema.searchable || false,
              isChip: fieldSchema.isChip,
              width: fieldSchema.width,
            };

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

            if (fieldSchema.customRender) {
              column.render = (row) => fieldSchema.customRender(row);
            }

            return column;
          })}
        filter={filter} // Pass filter prop to CustomTable
        orderByDefault={orderByDefault}
      />
    </>
  );
};

CustomPage.propTypes = {
  dataListName: PropTypes.string.isRequired,
  schema: PropTypes.objectOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      type: PropTypes.string.isRequired,
      show: PropTypes.bool,
      searchable: PropTypes.bool,
      customRender: PropTypes.func,
      default: PropTypes.any, // You can use PropTypes.any if default can be of any type
    })
  ).isRequired,
  title: PropTypes.string,
  description: PropTypes.string,
  searchable: PropTypes.bool,
  hasEdit: PropTypes.bool,
  hasDelete: PropTypes.bool,
  hasAdd: PropTypes.bool,
  customAddElement: PropTypes.element,
  customEditElement: PropTypes.element,
  additionalMenuOptions: PropTypes.arrayOf(PropTypes.elementType), // Accepts React components and with automatically passing this props:   row={row} endpoint={endpoint} parentClose={handleClose} dataListName={dataListName}
};

export default CustomPage;
