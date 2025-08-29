import React from "react";
import CustomCreateUpdateDialog from "../ps_annexes/PS_AnnexesCustomAdd";
import CustomMenu from "../../global/components/CustomMenu";
import CustomTable from "../../global/components/CustomTable";
import DashboardHeader from "../../global/components/DashboardHeader";
import PropTypes from "prop-types";

const PS_AnnexesCustomPage = ({
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
  const pageTitle =
    title || dataListName.charAt(0).toUpperCase() + dataListName.slice(1);
  const pageDescription = description || `Manage ${dataListName}`;
  const apiPath = `/${dataListName}`;

  return (
    <>
      <DashboardHeader
        title={pageTitle}
        description={pageDescription}
        searchable={searchable}
        childElement={
          (hasAdd && customAddElement) || (
            <CustomCreateUpdateDialog
              endpoint={apiPath}
              schema={schema}
              dataListName={dataListName}
            />
          )
        }
      />

      <CustomTable
        ROWS_PER_PAGE={ROWS_PER_PAGE}
        dataListName={dataListName}
        apiPath={apiPath}
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

PS_AnnexesCustomPage.propTypes = {
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

export default PS_AnnexesCustomPage;
