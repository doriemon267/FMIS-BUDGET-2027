/**
 * Shared layout for all Reports & Analytics pages.
 * Ensures uniform theme, spacing, header style, and optional breadcrumbs.
 */
import React from 'react';
import {
  Container,
  GlobalStyles,
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
    <>
      <GlobalStyles
        styles={{
          '@media print': {
            '@page': {
              margin: '10mm',
              size: 'A4 landscape',
            },
            'html, body': {
              backgroundColor: '#fff !important',
              color: '#000 !important',
            },
            '.report-page-layout': {
              width: '100% !important',
              maxWidth: 'none !important',
              padding: '0 !important',
              margin: '0 !important',
            },
            '.report-breadcrumbs, .report-no-print, .Toastify, .Toastify__toast-container, .MuiDialog-root': {
              display: 'none !important',
            },
            '.report-header, .report-page-layout .MuiPaper-root, .report-page-layout .MuiCard-root': {
              color: '#000 !important',
              background: '#fff !important',
              backgroundImage: 'none !important',
              boxShadow: 'none !important',
            },
            '.report-header': {
              padding: '0 0 8px !important',
              marginBottom: '10px !important',
              borderBottom: '1px solid #000 !important',
              borderRadius: '0 !important',
            },
            '.report-page-layout .MuiTypography-root, .report-page-layout .MuiTableCell-root, .report-page-layout .MuiChip-root': {
              color: '#000 !important',
              textShadow: 'none !important',
            },
            '.report-page-layout .MuiButtonBase-root, .report-expansion-control': {
              display: 'none !important',
            },
            '.report-table-container': {
              width: '100% !important',
              maxHeight: 'none !important',
              overflow: 'visible !important',
            },
            '.report-table-container > *': {
              minWidth: '0 !important',
            },
            '.report-detail-row': {
              display: 'table-row !important',
            },
            '.report-page-layout .MuiCollapse-root, .report-page-layout .MuiCollapse-wrapper, .report-page-layout .MuiCollapse-wrapperInner': {
              height: 'auto !important',
              minHeight: '0 !important',
              overflow: 'visible !important',
              visibility: 'visible !important',
            },
            '.report-page-layout thead': {
              display: 'table-header-group',
            },
            '.report-page-layout tfoot': {
              display: 'table-row-group',
            },
            '.report-page-layout tr, .report-summary, .report-section-header': {
              breakInside: 'avoid',
              pageBreakInside: 'avoid',
            },
            '.report-section-header': {
              breakAfter: 'avoid',
              pageBreakAfter: 'avoid',
              paddingBottom: '5px !important',
              marginBottom: '5px !important',
              gap: '4px !important',
            },
            '.report-section': {
              padding: '6px !important',
              marginBottom: '8px !important',
              borderRadius: '0 !important',
              breakInside: 'auto',
              pageBreakInside: 'auto',
            },
            '.report-section-header .MuiTypography-h6': {
              fontSize: '10pt !important',
              lineHeight: '1.2 !important',
            },
            '.report-section-header .MuiTypography-body2': {
              fontSize: '8pt !important',
              lineHeight: '1.25 !important',
              overflowWrap: 'anywhere',
            },
            '.report-summary': {
              padding: '7px !important',
              marginTop: '8px !important',
              marginBottom: '8px !important',
              borderRadius: '0 !important',
            },
            '.report-summary .MuiTypography-root': {
              fontSize: '8.5pt !important',
              lineHeight: '1.25 !important',
              overflowWrap: 'anywhere',
            },
            '.report-summary .MuiTypography-h4, .report-summary .MuiTypography-h5': {
              fontSize: '11pt !important',
              lineHeight: '1.2 !important',
            },
            '.report-column-header .MuiTableCell-root': {
              fontSize: '7.5pt !important',
              lineHeight: '1.15 !important',
              whiteSpace: 'normal !important',
              overflowWrap: 'anywhere',
            },
            '.report-total-row .MuiTableCell-root': {
              fontSize: '8.25pt !important',
              paddingTop: '5px !important',
              paddingBottom: '5px !important',
            },
            '.report-page-layout .MuiTableCell-root': {
              padding: '4px 5px !important',
              fontSize: '8pt !important',
              borderColor: '#777 !important',
            },
            '.report-page-layout .MuiChip-root': {
              height: 'auto !important',
              border: '1px solid #555 !important',
              backgroundColor: '#fff !important',
            },
            '.report-page-layout .MuiChip-label': {
              padding: '1px 4px !important',
              fontSize: '7.5pt !important',
            },
          },
        }}
      />
      <Container
        className="report-page-layout"
        maxWidth={maxWidth}
        sx={{ py: { xs: 2, md: 3 }, ...containerSx }}
      >
      {breadcrumbLabel != null && (
        <Breadcrumbs className="report-breadcrumbs" aria-label="breadcrumb" sx={{ mb: 2 }}>
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
        className="report-header"
        elevation={0}
        sx={{
          p: { xs: 2, md: 2.5 },
          mb: 3,
          borderRadius: 1.5,
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
          borderTop: '4px solid',
          borderTopColor: 'primary.main',
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
            variant="body2"
            sx={{
              color: 'text.secondary',
              textAlign: 'center',
              mt: 0.5,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
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
    </>
  );
};

export default ReportPageLayout;
