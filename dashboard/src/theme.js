import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#818cf8', // Indigo-400: Lighter for better contrast on dark bg
      light: '#a5b4fc',
      dark: '#4f46e5',
      contrastText: '#0f172a',
    },
    secondary: {
      main: '#f472b6', // Pink-400
      light: '#fbcfe8',
      dark: '#db2777',
      contrastText: '#0f172a',
    },
    background: {
      default: '#020617', // Slate-950 (darker)
      paper: '#1e293b',   // Slate-800
    },
    text: {
      primary: '#f1f5f9', // Slate-100 (crisper white)
      secondary: '#cbd5e1', // Slate-300 (more readable gray)
    },
    divider: 'rgba(148, 163, 184, 0.15)', // Slightly higher contrast
    success: {
      main: '#34d399', // Emerald-400
      light: '#6ee7b7',
      dark: '#059669',
      contrastText: '#020617',
    },
    error: {
      main: '#f87171', // Red-400
      light: '#fca5a5',
      dark: '#dc2626',
      contrastText: '#020617',
    },
    warning: {
      main: '#fbbf24', // Amber-400
      light: '#fcd34d',
      dark: '#d97706',
      contrastText: '#020617',
    },
    info: {
      main: '#38bdf8', // Sky-400
      light: '#7dd3fc',
      dark: '#0284c7',
      contrastText: '#020617',
    },
  },
  typography: {
    fontFamily: [
      '"Google Sans"',
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
      '"Apple Color Emoji"',
      '"Segoe UI Emoji"',
      '"Segoe UI Symbol"',
    ].join(','),
    h1: {
      fontWeight: 700,
      letterSpacing: '-0.02em',
    },
    h2: {
      fontWeight: 600,
      letterSpacing: '-0.01em',
    },
    h3: {
      fontWeight: 600,
    },
    h4: {
      fontWeight: 600,
    },
    h5: {
      fontWeight: 600,
    },
    h6: {
      fontWeight: 600,
    },
    subtitle1: {
      fontWeight: 500,
    },
    subtitle2: {
      fontWeight: 500,
    },
    body1: {
      fontWeight: 400,
      lineHeight: 1.6,
    },
    body2: {
      fontWeight: 400,
      lineHeight: 1.5,
    },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          scrollbarColor: '#475569 #0f172a',
          '&::-webkit-scrollbar, & *::-webkit-scrollbar': {
            backgroundColor: '#0f172a',
            width: 8,
            height: 8,
          },
          '&::-webkit-scrollbar-thumb, & *::-webkit-scrollbar-thumb': {
            borderRadius: 8,
            backgroundColor: '#475569',
            minHeight: 24,
            border: '2px solid #0f172a',
          },
          '&::-webkit-scrollbar-thumb:focus, & *::-webkit-scrollbar-thumb:focus': {
            backgroundColor: '#64748b',
          },
          '&::-webkit-scrollbar-thumb:active, & *::-webkit-scrollbar-thumb:active': {
            backgroundColor: '#64748b',
          },
          '&::-webkit-scrollbar-thumb:hover, & *::-webkit-scrollbar-thumb:hover': {
            backgroundColor: '#64748b',
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 8,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        rounded: {
          borderRadius: 12,
          backgroundImage: 'none', // Remove elevation overlay for cleaner look
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: '#1e293b', // Ensure consistent background
          border: '1px solid rgba(148, 163, 184, 0.1)',
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: '1px solid rgba(148, 163, 184, 0.12)',
        },
        head: {
          fontWeight: 600,
          color: '#cbd5e1',
          backgroundColor: '#0f172a', // Darker header for contrast
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 500,
        },
      },
    },
  },
});

export default theme;
