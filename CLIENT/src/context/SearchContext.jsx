import { createContext, useContext, useState } from "react";

const SearchContext = createContext({
  searchValue: "",
  setSearchValue: () => {},
  handleSetSearchValue: () => {},
  handleClearSearchValue: () => {},
});

const SearchProvider = ({ children }) => {
  const [searchValue, setSearchValue] = useState("");

  const handleSetSearchValue = (e) => {
    setSearchValue(e.target.value);
  };

  const handleClearSearchValue = () => setSearchValue("");

  return (
    <SearchContext.Provider
      value={{
        searchValue,
        setSearchValue,
        handleSetSearchValue,
        handleClearSearchValue,
      }}
    >
      {children}
    </SearchContext.Provider>
  );
};

export const useSearch = () => useContext(SearchContext);
export default SearchProvider;
