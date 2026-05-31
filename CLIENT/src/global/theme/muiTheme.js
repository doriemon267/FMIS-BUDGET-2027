import { createTheme, responsiveFontSizes } from "@mui/material/styles";
import { red } from "@mui/material/colors";

// Create theme with both light and dark modes
export const getTheme = (mode) => {
  let theme = createTheme({
    palette: {
      mode,
      ...(mode === 'light' 
        ? {
          // Light mode colors
          primary: {
            main: "#264524",
            contrastText: "#ffffff",
          },
          secondary: {
            main: "#375e38", // This is your table header color
            contrastText: "#ffffff",
          },
          background: {
            default: "#ffffff",
            paper: "#ffffff",
          },
          text: {
            primary: "#000000",
            secondary: "#333333",
            customColor: "#000000",
          },
        } 
        : {
          // Dark mode colors
          primary: {
            main: "#375e38",
            contrastText: "#ffffff",
          },
          secondary: {
            main: "#264524",
            contrastText: "#ffffff",
          },
          background: {
            default: "#121212",
            paper: "#1e1e1e",
          },
          text: {
            primary: "#ffffff",
            secondary: "#cccccc",
            customColor: "#ffffff",
          },
        }),
      error: {
        main: red[400],
        contrastText: "#eee",
      },
      // Custom colors for the app
      custom: {
        headerBg: mode === 'light' ? "#264524" : "#1e1e1e",
        categoryBg: mode === 'light' ? "#375e38" : "#264524",
        buttonBg: mode === 'light' ? "#4caf50" : "#375e38",
        buttonHover: mode === 'light' ? "#388e3c" : "#264524",
        totalBg: mode === 'light' ? "#1b5e20" : "#264524",
        totalGradient: mode === 'light' 
          ? "linear-gradient(to right, #1b5e20, #2e7d32)" 
          : "linear-gradient(to right, #264524, #375e38)",
      },
    },
    typography: {
      fontFamily: "Roboto, Arial, sans-serif",
      h1: {
        fontSize: "2.5rem",
        fontWeight: 700,
        letterSpacing: "0.1rem",
      },
      h2: {
        fontSize: "2rem",
        fontWeight: 600,
      },
      body1: {
        fontSize: "1rem",
        fontWeight: 500,
      },
      body2: {
        fontWeight: 500,
      },
    },
    components: {
      MuiTableHead: {
        styleOverrides: {
          root: {
            "& .MuiTableCell-head": {
              backgroundColor: mode === 'light' ? "#375e38" : "#264524",
              color: "#ffffff",
              fontWeight: "bold",
            }
          }
        }
      },
      MuiButton: {
        styleOverrides: {
          root: {
            padding: "6px 17px",
            fontWeight: 600,
          },
          containedPrimary: {
            backgroundColor: mode === 'light' ? "#375e38" : "#264524",
            color: "#ffffff",
            "&:hover": {
              backgroundColor: mode === 'light' ? "#264524" : "#1b5e20",
            },
          },
        },
      },
      MuiTableSortLabel: {
        styleOverrides: {
          root: {
            color: "#ffffff",
            "&:hover": {
              color: "#ffffff",
            },
            "&.Mui-active": {
              color: "#ffffff",
            },
            "& .MuiTableSortLabel-icon": {
              color: "#ffffff !important",
            },
          },
        },
      },
      MuiTabs: {
        styleOverrides: {
          root: {
            backgroundColor: mode === 'light' ? "#2d5016" : "#0b2413",
            borderTopLeftRadius: "8px",
            borderTopRightRadius: "8px",
            minHeight: "48px",
            padding: "6px 6px 0 6px",
            "& .MuiTabs-indicator": {
              display: "none !important",
            },
          },
          flexContainer: {
            gap: "4px",
          },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: {
            color: "rgba(255, 255, 255, 0.75)",
            textTransform: "none",
            fontWeight: 700,
            fontSize: "0.85rem",
            minHeight: "38px",
            borderRadius: "6px 6px 0 0",
            margin: "0 2px 0 2px",
            transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
            padding: "6px 16px",
            "&:hover": {
              color: "#ffffff",
              backgroundColor: "rgba(255, 255, 255, 0.08)",
            },
            "&.Mui-selected": {
              color: mode === 'light' ? "#2d5016" : "#0b2413",
              backgroundColor: "#ffffff",
              fontWeight: 800,
              boxShadow: "0 -2px 6px rgba(0, 0, 0, 0.08)",
              "& .tab-icon-wrapper": {
                color: mode === 'light' ? "#2d5016 !important" : "#0b2413 !important",
              }
            },
          },
        },
      },
      MuiDialog: {
        defaultProps: {
          slotProps: {
            backdrop: {
              sx: {
                backdropFilter: "blur(6px)",
                backgroundColor: "rgba(0, 0, 0, 0.4)",
              },
            },
          },
        },
        styleOverrides: {
          paper: {
            borderRadius: "16px !important",
            boxShadow: "0 20px 48px rgba(0,0,0,0.16) !important",
            border: "1px solid rgba(255,255,255,0.08) !important",
          },
        },
      },
    },
  });

  return responsiveFontSizes(theme);
};

// Default theme (light mode)
const theme = getTheme('light');
export default theme;
