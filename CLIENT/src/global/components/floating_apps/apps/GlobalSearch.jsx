import { useState, useEffect, useRef } from 'react';
import { Box, TextField, List, ListItem, ListItemText, Paper, CircularProgress, Chip, Typography, Divider } from '@mui/material';
import { FiSearch, FiFileText, FiUsers, FiCheckCircle, FiZap } from 'react-icons/fi';
import { useTheme, useMediaQuery } from '@mui/material';
import { api } from '../../../services/api';

export default function GlobalSearch() {
  const theme = useTheme();
  const isSmall = useMediaQuery(theme.breakpoints.down('sm'));
  
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const searchInputRef = useRef(null);

  // Focus on mount
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (!searchQuery) {
      setResults([]);
      return;
    }

    const search = async () => {
      try {
        setLoading(true);
        const response = await api.get('/api/search', { params: { q: searchQuery, limit: 10 } });
        if (response?.data?.results) {
          setResults(response.data.results);
        }
      } catch (e) {
        console.error('[GlobalSearch] Search failed:', e);
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(search, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleResultClick = (result) => {
    // Navigate or execute based on result type
    if (result.type === 'budget') {
      window.location.href = `/budgets/${result.id}`;
    } else if (result.type === 'proposal') {
      window.location.href = `/proposals/${result.id}`;
    } else if (result.type === 'user') {
      window.dispatchEvent(new CustomEvent('open-app', { detail: { appId: 'chat', peerId: result.id } }));
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      setSelectedIndex(prev => Math.max(prev - 1, -1));
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      handleResultClick(results[selectedIndex]);
    }
  };

  const getResultIcon = (type) => {
    const props = { size: 16 };
    switch (type) {
      case 'budget': return <FiFileText {...props} />;
      case 'proposal': return <FiCheckCircle {...props} />;
      case 'user': return <FiUsers {...props} />;
      default: return <FiZap {...props} />;
    }
  };

  const getResultColor = (type) => {
    switch (type) {
      case 'budget': return '#0066cc';
      case 'proposal': return '#43a047';
      case 'user': return '#f57c00';
      default: return '#9c27b0';
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: '#1a1a1e', color: '#eee', p: 0 }}>
      {/* Search Input */}
      <Box sx={{ p: 1.5, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <TextField
          ref={searchInputRef}
          placeholder='Search budgets, proposals, users... (Ctrl+K)'
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          fullWidth
          size='small'
          sx={{
            '& .MuiOutlinedInput-root': {
              bgcolor: 'rgba(255,255,255,0.05)',
              color: '#eee',
              '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
              '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.2)' }
            }
          }}
          InputProps={{
            startAdornment: <FiSearch style={{ marginRight: 8, opacity: 0.5 }} />
          }}
        />
      </Box>

      {/* Results */}
      <Box sx={{ flex: 1, overflowY: 'auto' }}>
        {searchQuery === '' ? (
          <Box sx={{ p: 2, textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>
            <FiSearch size={32} style={{ marginBottom: 8, opacity: 0.5 }} />
            <Typography variant='body2'>Type to search...</Typography>
            <Typography variant='caption' sx={{ display: 'block', mt: 1 }}>Budgets • Proposals • Users • Recent Actions</Typography>
          </Box>
        ) : loading ? (
          <Box sx={{ p: 2, display: 'flex', justifyContent: 'center' }}>
            <CircularProgress size={24} />
          </Box>
        ) : results.length === 0 ? (
          <Box sx={{ p: 2, textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>
            <Typography variant='body2'>No results found</Typography>
          </Box>
        ) : (
          <List sx={{ p: 0 }}>
            {results.map((result, idx) => (
              <Box key={result.id}>
                <ListItem
                  onClick={() => handleResultClick(result)}
                  sx={{
                    bgcolor: idx === selectedIndex ? 'rgba(0,102,204,0.2)' : 'transparent',
                    cursor: 'pointer',
                    p: 1.5,
                    transition: 'all 0.1s',
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' }
                  }}
                >
                  <Box sx={{ display: 'flex', gap: 1.5, width: '100%', alignItems: 'center' }}>
                    <Box sx={{ color: getResultColor(result.type), mt: 0.5 }}>
                      {getResultIcon(result.type)}
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant='body2' sx={{ fontWeight: 500, mb: 0.25 }}>
                        {result.title}
                      </Typography>
                      <Typography variant='caption' sx={{ color: 'rgba(255,255,255,0.6)' }}>
                        {result.description}
                      </Typography>
                    </Box>
                    <Chip
                      label={result.type}
                      size='small'
                      sx={{
                        height: 20,
                        fontSize: '10px',
                        bgcolor: getResultColor(result.type),
                        color: '#fff'
                      }}
                    />
                  </Box>
                </ListItem>
                {idx < results.length - 1 && <Divider sx={{ bgcolor: 'rgba(255,255,255,0.05)' }} />}
              </Box>
            ))}
          </List>
        )}
      </Box>

      {/* Footer */}
      <Box sx={{ p: 1, borderTop: '1px solid rgba(255,255,255,0.1)', bgcolor: 'rgba(0,0,0,0.2)', fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}><Typography variant='caption'>↑↓</Typography> Navigate</Box>
          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}><Typography variant='caption'>↵</Typography> Select</Box>
          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}><Typography variant='caption'>ESC</Typography> Close</Box>
        </Box>
      </Box>
    </Box>
  );
}
