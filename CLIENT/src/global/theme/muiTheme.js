import { createTheme, responsiveFontSizes } from "@mui/material/styles";
import { grey, red } from "@mui/material/colors";

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
            default: "#f4f6f8",
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
    },
  });

  return responsiveFontSizes(theme);
};

// Default theme (light mode)
const theme = getTheme('light');
export default theme;
