export const invalidateDataList = async (queryClient, dataListName) => {
  if (!queryClient || !dataListName) {
    return;
  }

  await queryClient.invalidateQueries({ queryKey: [dataListName], exact: false });
  await queryClient.refetchQueries({ queryKey: [dataListName], type: "active" });

  const allowanceLists = ["meal-allowance", "medical-allowance", "children-allowance"];
  if (allowanceLists.includes(dataListName)) {
    await queryClient.invalidateQueries({ queryKey: ["personnelServices"], exact: false });
  }
};
