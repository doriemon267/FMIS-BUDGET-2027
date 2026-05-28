import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  LinearProgress,
} from '@mui/material';
import {
  TrendingUp,
  AccountBalance,
  Assessment,
  PieChart,
} from '@mui/icons-material';

const IncomeReportSummary = ({ reportData, showPercentages = false }) => {
  if (!reportData || !reportData.regionData) {
    return null;
  }

  // Calculate summary statistics
  const totalRegions = reportData.regions?.length || 0;
  const totalCategories = reportData.hierarchicalData?.length || 0;
  const totalSubcategories = reportData.hierarchicalData?.reduce((count, category) => 
    count + (category.subcategories?.length || 0), 0) || 0;

  // Determine region context
  const isSingleRegion = (reportData.regions?.length || 0) === 1;

  // Find top performing region when comparing multiple regions
  const topRegion = isSingleRegion ? reportData.regions?.[0] : reportData.regions?.reduce((top, region) => {
    const regionTotal = reportData.regionData[region]?.total || 0;
    const topTotal = reportData.regionData[top]?.total || 0;
    return regionTotal > topTotal ? region : top;
  }, reportData.regions[0]);

  // Find top performing category
  const topCategory = reportData.hierarchicalData?.reduce((top, category) => {
    const categoryTotal = reportData.categoryTotals[category.id] || 0;
    const topTotal = reportData.categoryTotals[top?.id] || 0;
    return categoryTotal > topTotal ? category : top;
  }, reportData.hierarchicalData[0]);

  // Calculate regional distribution
  const regionalDistribution = reportData.regions?.map(region => {
    const regionTotal = reportData.regionData[region]?.total || 0;
    const percentage = reportData.grandTotal > 0 ? (regionTotal / reportData.grandTotal * 100) : 0;
    return {
      region,
      total: regionTotal,
      percentage
    };
  }).sort((a, b) => b.total - a.total) || [];

  // Calculate category distribution
  const categoryDistribution = reportData.hierarchicalData?.map(category => {
    const categoryTotal = reportData.categoryTotals[category.id] || 0;
    const percentage = reportData.grandTotal > 0 ? (categoryTotal / reportData.grandTotal * 100) : 0;
    return {
      ...category,
      total: categoryTotal,
      percentage
    };
  }).sort((a, b) => b.total - a.total) || [];

  const SummaryCard = ({ icon, title, value, subtitle, color = 'primary' }) => {
    // Map basic color names to gradient backgrounds
    const gradients = {
      primary: "linear-gradient(135deg, #4776E6 0%, #8E54E9 100%)",
      secondary: "linear-gradient(135deg, #11998e 0%, #38ef7d 100%)",
      info: "linear-gradient(135deg, #3a7bd5 0%, #3a6073 100%)",
      success: "linear-gradient(135deg, #1f4037 0%, #99f2c8 100%)",
      warning: "linear-gradient(135deg, #f2994a 0%, #f2c94c 100%)",
      error: "linear-gradient(135deg, #ee0979 0%, #ff6a00 100%)",
    };
    
    return (
      <Card 
        sx={{ 
          height: '100%', 
          background: gradients[color] || gradients.primary,
          color: '#fff',
          borderRadius: 2,
          boxShadow: '0 4px 20px 0 rgba(0,0,0,0.1)',
          transition: 'transform 0.2s',
          '&:hover': { transform: 'translateY(-4px)' }
        }}
      >
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 500, opacity: 0.9, mb: 1 }}>
                {title}
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1.2, mb: 0.5 }}>
                {value}
              </Typography>
              {subtitle && (
                <Typography variant="caption" sx={{ opacity: 0.8 }}>
                  {subtitle}
                </Typography>
              )}
            </Box>
            <Box sx={{ opacity: 0.8, '& svg': { fontSize: 40, color: '#e2e8f0' } }}>
              {icon}
            </Box>
          </Box>
        </CardContent>
      </Card>
    );
  };

  // Safe number formatting function
  const formatCurrency = (amount, options = {}) => {
    // Normalize amount to a finite number
    const n = Number(amount);
    if (!isFinite(n)) return '₱0.00';

    // Coerce fraction options safely within valid range 0..20
    let { minimumFractionDigits = 2, maximumFractionDigits = 2 } = options;
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, Number.isFinite(v) ? v : 2));
    minimumFractionDigits = clamp(minimumFractionDigits, 0, 20);
    maximumFractionDigits = clamp(maximumFractionDigits, minimumFractionDigits, 20);

    try {
      return `₱${n.toLocaleString('en-US', {
        minimumFractionDigits,
        maximumFractionDigits
      })}`;
    } catch (error) {
      console.warn('Error formatting currency:', error);
      return `₱${n.toFixed(Math.max(0, Math.min(20, minimumFractionDigits)))}`;
    }
  };

  return (
    <Box>
      {/* Key Metrics Cards */}
      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <SummaryCard
            icon={<AccountBalance />}
            title="Total Income"
            value={formatCurrency(reportData.grandTotal, { minimumFractionDigits: 2, maximumFractionDigits: 0 })}
            subtitle={`FY ${reportData.fiscalYear} - ${reportData.budgetType}`}
            color="primary"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <SummaryCard
            icon={<Assessment />}
            title="Regions"
            value={totalRegions}
            subtitle={`${regionalDistribution.filter(r => r.total > 0).length} with income data`}
            color="secondary"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <SummaryCard
            icon={<PieChart />}
            title="Categories"
            value={totalCategories}
            subtitle={`${totalSubcategories} subcategories`}
            color="info"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <SummaryCard
            icon={<TrendingUp />}
            title={isSingleRegion ? "Region" : "Top Region"}
            value={isSingleRegion ? (reportData.regions?.[0] || 'N/A') : (topRegion || 'N/A')}
            subtitle={(() => {
              const regionKey = isSingleRegion ? reportData.regions?.[0] : topRegion;
              if (!regionKey) return '';
              return formatCurrency(reportData.regionData[regionKey]?.total || 0, { minimumFractionDigits: 2, maximumFractionDigits: 0 });
            })()}
            color="success"
          />
        </Grid>
      </Grid>

      {/* Regional Performance */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ color: 'primary.main' }}>
                Regional Performance
              </Typography>
              <Box sx={{ mt: 2 }}>
                {regionalDistribution.slice(0, 5).map((region, index) => (
                  <Box key={region.region} sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                        {region.region}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'success.main' }}>
                          {formatCurrency(region.total, { minimumFractionDigits: 2, maximumFractionDigits: 0 })}
                        </Typography>
                        {showPercentages && (
                          <Chip 
                            label={`${region.percentage.toFixed(1)}%`} 
                            size="small" 
                            color={index === 0 ? 'primary' : 'default'}
                            variant={index === 0 ? 'filled' : 'outlined'}
                          />
                        )}
                      </Box>
                    </Box>
                    <LinearProgress 
                      variant="determinate" 
                      value={region.percentage} 
                      sx={{ 
                        height: 8, 
                        borderRadius: 4,
                        backgroundColor: '#e0e0e0',
                        '& .MuiLinearProgress-bar': {
                          backgroundColor: index === 0 ? 'primary.main' : 'secondary.main'
                        }
                      }} 
                    />
                  </Box>
                ))}
                {regionalDistribution.length > 5 && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    ... and {regionalDistribution.length - 5} more regions
                  </Typography>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ color: 'primary.main' }}>
                Category Performance
              </Typography>
              <Box sx={{ mt: 2 }}>
                {categoryDistribution.slice(0, 5).map((category, index) => (
                  <Box key={category.id} sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                        {category.name}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'success.main' }}>
                          {formatCurrency(category.total, { minimumFractionDigits: 2, maximumFractionDigits: 0 })}
                        </Typography>
                        {showPercentages && (
                          <Chip 
                            label={`${category.percentage.toFixed(1)}%`} 
                            size="small" 
                            color={index === 0 ? 'primary' : 'default'}
                            variant={index === 0 ? 'filled' : 'outlined'}
                          />
                        )}
                      </Box>
                    </Box>
                    <LinearProgress 
                      variant="determinate" 
                      value={category.percentage} 
                      sx={{ 
                        height: 8, 
                        borderRadius: 4,
                        backgroundColor: '#e0e0e0',
                        '& .MuiLinearProgress-bar': {
                          backgroundColor: index === 0 ? 'warning.main' : 'info.main'
                        }
                      }} 
                    />
                  </Box>
                ))}
                {categoryDistribution.length > 5 && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    ... and {categoryDistribution.length - 5} more categories
                  </Typography>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default IncomeReportSummary;
