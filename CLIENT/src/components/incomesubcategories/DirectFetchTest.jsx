import React, { useEffect, useState } from 'react';
import api from '../../config/api';
import { Box, Button, Typography, Paper, List, ListItem, ListItemText, CircularProgress } from '@mui/material';

const DirectFetchTest = () => {
  const [subcategories, setSubcategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/income-subcategories');
      const data = response.data;
      
      if (data && data.incomeSubcategories) {
        setSubcategories(data.incomeSubcategories);
      } else if (Array.isArray(data)) {
        setSubcategories(data);
      } else {
        setError('Invalid response format');
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <Box sx={{ p: 3 }}>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h5" gutterBottom>
          Direct Fetch Test
        </Typography>
        
        <Button 
          variant="contained" 
          onClick={fetchData} 
          disabled={loading}
          sx={{ mb: 2 }}
        >
          Refresh Data
        </Button>
        
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}>
            <CircularProgress />
          </Box>
        )}
        
        {error && (
          <Typography color="error" sx={{ my: 2 }}>
            Error: {error}
          </Typography>
        )}
        
        <Typography variant="subtitle1" gutterBottom>
          Total Subcategories: {subcategories.length}
        </Typography>
        
        <Paper sx={{ maxHeight: 400, overflow: 'auto', mt: 2 }}>
          <List dense>
            {subcategories.map((item, index) => (
              <ListItem key={item._id || index} divider>
                <ListItemText
                  primary={item.incomeSubcategoryName || item.name}
                  secondary={
                    <>
                      <Typography variant="body2" component="span">
                        ID: {item._id}
                      </Typography>
                      <br />
                      <Typography variant="body2" component="span">
                        Global: {item.isGlobal ? 'Yes' : 'No'}
                      </Typography>
                      <br />
                      <Typography variant="body2" component="span">
                        Regions: {item.regions && item.regions.length > 0 
                          ? item.regions.join(', ') 
                          : 'None'}
                      </Typography>
                    </>
                  }
                />
              </ListItem>
            ))}
          </List>
        </Paper>
      </Paper>
    </Box>
  );
};

export default DirectFetchTest;