/**
 * Shared layout for all Reports & Analytics pages.
 * Ensures uniform theme, spacing, header style, and optional breadcrumbs.
 */
import React from 'react';
import {
  Container,
  Paper,
  Typography,
  Breadcrumbs,
  Link,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import HomeIcon from '@mui/icons-material/Home';
import AssessmentIcon from '@mui/icons-material/Assessment';

const ReportPageLayout = ({
  title,
  subtitle,
  showNiaBranding = true,
  breadcrumbLabel,
  fiscalYear,
  children,
  maxWidth = 'xl',
  containerSx = {},
}) => {
  const navigate = useNavigate();

  return (
    <Container maxWidth={maxWidth} sx={{ py: 3, ...containerSx }}>
      {breadcrumbLabel != null && (
        <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 2 }}>
          <Link
            component="button"
            variant="body2"
            underline="hover"
            sx={{ display: 'flex', alignItems: 'center', color: 'text.secondary', cursor: 'pointer' }}
            onClick={() => navigate('/dashboard')}
          >
            <HomeIcon sx={{ mr: 0.5 }} fontSize="inherit" />
            Dashboard
          </Link>
          <Typography sx={{ display: 'flex', alignItems: 'center' }} color="text.primary">
            <AssessmentIcon sx={{ mr: 0.5 }} fontSize="inherit" />
            {breadcrumbLabel}
          </Typography>
        </Breadcrumbs>
      )}

      <Paper
        elevation={2}
        sx={{
          p: 3,
          mb: 3,
          borderRadius: 2,
          bgcolor: 'background.paper',
        }}
      >
        {showNiaBranding && (
          <Typography
            variant="h5"
            gutterBottom
            sx={{ color: 'primary.main', fontWeight: 'bold', textAlign: 'center' }}
          >
            NATIONAL IRRIGATION ADMINISTRATION
          </Typography>
        )}
        <Typography
          variant={showNiaBranding ? 'h6' : 'h5'}
          gutterBottom
          sx={{ color: 'primary.main', fontWeight: 'bold', textAlign: 'center' }}
          component={showNiaBranding ? 'h2' : 'h1'}
        >
          {title}
        </Typography>
        {fiscalYear != null && fiscalYear !== '' && (
          <Typography
            variant="subtitle1"
            gutterBottom
            sx={{ color: 'text.secondary', textAlign: 'center' }}
          >
            BUDGET PROPOSAL FOR FISCAL YEAR {fiscalYear}
          </Typography>
        )}
        {subtitle != null && (
          <Typography
            variant="body1"
            sx={{ color: 'text.secondary', textAlign: 'center', mt: 1 }}
          >
            {subtitle}
          </Typography>
        )}
      </Paper>

      {children}
    </Container>
  );
};

export default ReportPageLayout;
