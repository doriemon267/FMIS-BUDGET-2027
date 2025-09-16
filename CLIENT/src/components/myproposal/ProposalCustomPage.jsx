import React from "react";
import CustomCreateUpdateDialog from "../../global/components/CustomCreateUpdateDialog";
import CustomMenu from "../../global/components/CustomMenu";
import CustomTable from "../myproposal/ProposalCustomTable";
import DashboardHeader from "../../global/components/DashboardHeader";
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
  ROWS_PER_PAGE = 20,
  refreshData,
  tableRef,
  extraParams = {},
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
      />

      <CustomTable
        ref={tableRef}
        dataListName={dataListName}
        apiPath={apiPath}
        ROWS_PER_PAGE={ROWS_PER_PAGE}
        columns={Object.keys(schema)
          .filter((key) => schema[key].show === true || key === "action")
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
                  refreshData={refreshData}
                />
              );
            }

            if (fieldSchema.customRender) {
              column.render = (row) => fieldSchema.customRender(row);
            }

            return column;
          })}
        extraParams={extraParams}
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
      default: PropTypes.any,
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
  additionalMenuOptions: PropTypes.arrayOf(PropTypes.elementType),
  refreshData: PropTypes.func,
  tableRef: PropTypes.any,
  extraParams: PropTypes.object,
};

export default CustomPage;
