export const invalidateDataList = async (queryClient, dataListName) => {
  if (!queryClient || !dataListName) {
    return;
  }

  await queryClient.invalidateQueries({ queryKey: [dataListName], exact: false });
  await queryClient.refetchQueries({ queryKey: [dataListName], type: "active" });
};
