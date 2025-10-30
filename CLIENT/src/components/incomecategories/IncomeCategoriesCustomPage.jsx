import React from "react";
import CustomCreateUpdateDialog from "../../global/components/CustomCreateUpdateDialog";
import CustomMenu from "../../global/components/CustomMenu";
import CustomTable from "./IncomeCategoriesCustomTable";
import DashboardHeader from "../../global/components/DashboardHeader";
import PropTypes from "prop-types";

const IncomeCategoriesCustomPage = ({
  dataListName,
  schema,
  title = "INCOME CATEGORIES",
  description = "",
  searchable = true,
  hasEdit = true,
  hasDelete = true,
  hasAdd = true,
  customAddElement = null,
  customEditElement = null,
  additionalMenuOptions = [],
  ROWS_PER_PAGE = 20,
  customEmptyMessage = null,
}) => {
  const pageTitle =
    title || dataListName.charAt(0).toUpperCase() + dataListName.slice(1);
  const pageDescription = description || `Manage Income Categories`;
  const apiPath = `/${dataListName}`;
  return (
    <>
      <DashboardHeader
        title={pageTitle}
        description={pageDescription}
        searchable={searchable}
        childElement={
          customAddElement || (hasAdd && (
            <CustomCreateUpdateDialog
              endpoint={apiPath}
              schema={schema}
              dataListName={dataListName}
            />
          ))
        }
      />

      <CustomTable
        dataListName={dataListName}
        apiPath={apiPath}
        ROWS_PER_PAGE={ROWS_PER_PAGE}
        customEmptyMessage={customEmptyMessage}
        columns={Object.keys(schema)
          .filter((key) => schema[key].show === true || key === "action") // Always include "action"
          .map((key) => {
            const fieldSchema = schema[key];
            const column = {
              field: key,
              label: fieldSchema.label,
              type: fieldSchema.type,
              searchable: fieldSchema.searchable || false,
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
      />
    </>
  );
};

IncomeCategoriesCustomPage.propTypes = {
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
  customEmptyMessage: PropTypes.element,
};

export default IncomeCategoriesCustomPage;
