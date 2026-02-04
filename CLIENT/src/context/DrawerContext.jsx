import { createContext, useContext, useState } from "react";

const DrawerContext = createContext();

export const DrawerProvider = ({ children }) => {
  const [open, setOpen] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [expandedMenuKey, setExpandedMenuKey] = useState(null);

  const toggleDrawer = () => setOpen((prev) => !prev);
  const toggleCollapsed = () => {
    setCollapsed((prev) => !prev);
    setExpandedMenuKey(null);
  };

  return (
    <DrawerContext.Provider
      value={{
        open,
        setOpen,
        toggleDrawer,
        collapsed,
        setCollapsed,
        toggleCollapsed,
        expandedMenuKey,
        setExpandedMenuKey,
      }}
    >
      {children}
    </DrawerContext.Provider>
  );
};

// Optional: custom hook for easier access
export const useDrawer = () => useContext(DrawerContext);