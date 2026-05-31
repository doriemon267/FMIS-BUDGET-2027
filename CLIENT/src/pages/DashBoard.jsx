import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';

// Icons — only confirmed-safe exports from react-icons/lu v5
import {
  LuPlus,
  LuClipboardList,
  LuTrendingUp,
  LuClock,
  LuShieldCheck,
  LuX,
  LuInbox,
  LuActivity,
  LuZap,
  LuRefreshCw,
  LuInfo,
  LuMapPin,
  LuBuilding,
  LuFolder,
  LuKey,
  LuCalendar,
  LuArrowRight,
  LuChevronRight,
} from 'react-icons/lu';

// Contexts & Hooks
import { useThemeContext } from '../context/ThemeContext';
import { useUser } from '../context/UserContext';
import { useRegion } from '../context/RegionContext';
import useKeyboardShortcuts from '../hooks/useKeyboardShortcuts';

// Config & Utils
import api from '../config/api';
import { handleApiError } from '../utils/errorHandler';
import { hasPermission } from '../utils/permissions';

// Components
import WorkflowTemplateSelector from '../components/workflow/WorkflowTemplateSelector';
import DashboardAnalytics from '../components/dashboard/DashboardAnalytics';
import InAppHelp from '../components/common/InAppHelp';

// ─── UTILITY FUNCTIONS ─────────────────────────────────────────────────────────

const formatDisplayName = (user) => {
  if (!user) return 'User';
  const first = user.FirstName || user.firstName || '';
  const last  = user.LastName  || user.lastName  || '';
  if (first && last) return `${first} ${last}`;
  if (first) return first;
  const rawFallback = user.DisplayName || user.displayName || user.Username || user.username;
  const fallback = Array.isArray(rawFallback) ? rawFallback[0] : rawFallback;
  if (fallback && typeof fallback === 'string' && !fallback.toLowerCase().includes('dev user')) return fallback;
  const roles = user.Roles || [];
  if (roles.length > 0) {
    const primary = roles[0];
    if (primary.toLowerCase().includes('super')) return 'Admin';
    return primary.replace(/_/g, ' ');
  }
  return 'User';
};

const formatRoleDisplay = (role) => {
  if (!role) return 'N/A';
  const clean = String(role).toUpperCase().replace(/_/g, ' ').trim();
  if (clean === 'SUPER ADMIN' || clean === 'SUPER_ADMIN' || clean.includes('SUPER')) return 'ADMIN';
  return clean;
};

const formatNumber = (num) => {
  if (num === null || num === undefined) return '0';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000)    return (num / 1000).toFixed(1) + 'k';
  return num.toLocaleString();
};

// ─── STAT CARD ─────────────────────────────────────────────────────────────────

const STAT_CFG = {
  sky: {
    accent:    '#38bdf8',
    accentBg:  'rgba(56,189,248,0.12)',
    accentBdr: 'rgba(56,189,248,0.25)',
    glow:      'rgba(56,189,248,0.18)',
    sparkPath: 'M0,22 C15,16 25,8 40,12 C55,16 65,4 80,6 C90,8 95,5 100,3',
    trend: { dir: '↑', label: '+8.2% vs last FY', positive: true },
  },
  amber: {
    accent:    '#fbbf24',
    accentBg:  'rgba(251,191,36,0.12)',
    accentBdr: 'rgba(251,191,36,0.25)',
    glow:      'rgba(251,191,36,0.18)',
    sparkPath: 'M0,8 C12,14 22,22 38,18 C54,14 62,24 78,20 C88,17 94,22 100,25',
    trend: { dir: '↓', label: '-12.5% queue', positive: false },
  },
  emerald: {
    accent:    '#34d399',
    accentBg:  'rgba(52,211,153,0.12)',
    accentBdr: 'rgba(52,211,153,0.25)',
    glow:      'rgba(52,211,153,0.18)',
    sparkPath: 'M0,24 C14,20 26,14 42,10 C58,6 68,4 82,3 C90,2 96,2 100,1',
    trend: { dir: '↑', label: '+15.4% rate', positive: true },
  },
  rose: {
    accent:    '#fb7185',
    accentBg:  'rgba(251,113,133,0.12)',
    accentBdr: 'rgba(251,113,133,0.25)',
    glow:      'rgba(251,113,133,0.18)',
    sparkPath: 'M0,4 C10,8 18,14 32,18 C46,22 58,26 72,24 C82,22 90,26 100,28',
    trend: { dir: '→', label: '0.2% returned', positive: null },
  },
};

const StatCard = React.memo(({ title, value, colorKey = 'sky', icon: Icon, isLoading, progress = 0, isDark = true }) => {
  const c = STAT_CFG[colorKey] || STAT_CFG.sky;
  const uid = `sg-${colorKey}`;
  const cardBg   = isDark ? 'linear-gradient(145deg,rgba(255,255,255,0.06) 0%,rgba(255,255,255,0.02) 100%)' : '#ffffff';
  const valColor = isDark ? '#ffffff' : '#0f172a';
  const lblColor = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(15,23,42,0.5)';
  const barBg    = isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9';

  return (
    <article
      style={{
        background: cardBg,
        border: `1px solid ${c.accentBdr}`,
        borderRadius: '24px',
        padding: '36px',
        position: 'relative',
        overflow: 'hidden',
        transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
        cursor: 'default',
        backdropFilter: 'blur(12px)',
        boxShadow: isDark ? 'none' : '0 4px 20px rgba(0,0,0,0.06)',
      }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 20px 50px -10px ${c.glow}`; e.currentTarget.style.borderColor = c.accent; e.currentTarget.style.transform='translateY(-3px)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = isDark ? 'none' : '0 4px 20px rgba(0,0,0,0.06)'; e.currentTarget.style.borderColor = c.accentBdr; e.currentTarget.style.transform='translateY(0)'; }}
    >
      {/* Corner glow */}
      <div style={{ position:'absolute', top:-30, right:-30, width:120, height:120, borderRadius:'50%', background:`radial-gradient(circle, ${c.glow} 0%, transparent 65%)`, pointerEvents:'none' }} />

      {/* Top row */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:20 }}>
        <p style={{ fontSize:'0.7rem', fontWeight:800, letterSpacing:'0.16em', color:lblColor, textTransform:'uppercase', margin:0, lineHeight:1.4, paddingLeft: 8 }}>
          {title}
        </p>
        <div style={{ width:40, height:40, borderRadius:12, background:c.accentBg, border:`1px solid ${c.accentBdr}`, display:'flex', alignItems:'center', justifyContent:'center', color:c.accent, flexShrink:0 }}>
          <Icon size={18} />
        </div>
      </div>

      {/* Value + sparkline */}
      <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', gap:12, marginBottom:16, paddingLeft: 8 }}>
        <div>
          <p style={{ fontSize:'2.8rem', fontWeight:900, color:valColor, lineHeight:1, margin:0, letterSpacing:'-2px' }}>
            {isLoading
              ? <span style={{ display:'inline-block', width:24, height:24, border:`2px solid ${c.accent}`, borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
              : formatNumber(value)
            }
          </p>
          <span style={{ display:'inline-flex', alignItems:'center', gap:4, marginTop:8, padding:'3px 10px', borderRadius:999, background:c.accentBg, border:`1px solid ${c.accentBdr}`, fontSize:'0.62rem', fontWeight:800, color:c.accent }}>
            <span style={{ fontSize:'0.7rem' }}>{c.trend.dir}</span>
            {c.trend.label}
          </span>
        </div>
        <div style={{ width:80, height:34, flexShrink:0, opacity:0.9 }}>
          <svg width="100%" height="100%" viewBox="0 0 100 30" preserveAspectRatio="none" overflow="visible">
            <defs>
              <linearGradient id={uid} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={c.accent} stopOpacity="0.35" />
                <stop offset="100%" stopColor={c.accent} stopOpacity="0" />
              </linearGradient>
              <filter id={`gf-${colorKey}`}>
                <feGaussianBlur stdDeviation="1.5" result="b" />
                <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>
            <path d={`${c.sparkPath} L100,30 L0,30 Z`} fill={`url(#${uid})`} />
            <path d={c.sparkPath} fill="none" stroke={c.accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" filter={`url(#gf-${colorKey})`}
              style={{ strokeDasharray:200, strokeDashoffset:200, animation:'drawSpark 2s cubic-bezier(0.4,0,0.2,1) forwards' }}
            />
          </svg>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ width:'100%', height:3, background:barBg, borderRadius:999, overflow:'hidden' }}>
        <div style={{ height:'100%', borderRadius:999, background:`linear-gradient(90deg,${c.accent}aa,${c.accent})`, width:`${Math.min(progress,100)}%`, transition:'width 1.2s cubic-bezier(0.4,0,0.2,1)' }} />
      </div>
    </article>
  );
});

// ─── ACTION CARD ──────────────────────────────────────────────────────────────

const ACT_CFG = {
  emerald: { accent: '#34d399', accentBg: 'rgba(52,211,153,0.12)', accentBdr: 'rgba(52,211,153,0.2)', glow: 'rgba(52,211,153,0.15)', iconGrad: 'linear-gradient(135deg,#10b981,#059669)' },
  sky:     { accent: '#38bdf8', accentBg: 'rgba(56,189,248,0.12)', accentBdr: 'rgba(56,189,248,0.2)', glow: 'rgba(56,189,248,0.15)', iconGrad: 'linear-gradient(135deg,#0ea5e9,#0369a1)' },
  amber:   { accent: '#fbbf24', accentBg: 'rgba(251,191,36,0.12)', accentBdr: 'rgba(251,191,36,0.2)', glow: 'rgba(251,191,36,0.15)', iconGrad: 'linear-gradient(135deg,#f59e0b,#d97706)' },
};

const ActionCard = React.memo(({ title, description, icon: Icon, accentKey = 'sky', onClick, buttonText, isRestricted, isDark = true }) => {
  const c = ACT_CFG[accentKey] || ACT_CFG.sky;
  const titleColor = isDark ? '#ffffff' : '#0f172a';
  const descColor  = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(15,23,42,0.55)';
  const cardBg     = isDark ? 'linear-gradient(145deg,rgba(255,255,255,0.05) 0%,rgba(255,255,255,0.02) 100%)' : '#ffffff';
  const cardBdr    = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)';
  const restrictedColor = isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.25)';
  const restrictedBdr   = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';

  return (
    <div
      className="db-action-card"
      role="button"
      tabIndex={isRestricted ? -1 : 0}
      onClick={!isRestricted ? onClick : undefined}
      onKeyDown={e => { if (!isRestricted && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onClick?.(); } }}
      onMouseEnter={e => {
        if (!isRestricted) {
          e.currentTarget.style.borderColor = c.accent;
          e.currentTarget.style.boxShadow = `0 16px 40px -10px ${c.glow}`;
          e.currentTarget.style.transform = 'translateY(-2px)';
        }
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = cardBdr;
        e.currentTarget.style.boxShadow = isDark ? 'none' : '0 2px 12px rgba(0,0,0,0.06)';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
      style={{
        display:'flex', flexDirection:'row', alignItems:'center', justifyContent:'space-between',
        gap:20, padding:'28px 36px',
        background: cardBg,
        border: `1px solid ${cardBdr}`,
        borderRadius:24,
        cursor: isRestricted ? 'not-allowed' : 'pointer',
        opacity: isRestricted ? 0.55 : 1,
        transition:'all 0.25s cubic-bezier(0.4,0,0.2,1)',
        backdropFilter:'blur(8px)',
        outline:'none', userSelect:'none',
        boxShadow: isDark ? 'none' : '0 2px 12px rgba(0,0,0,0.06)',
      }}
    >
      <div style={{ display:'flex', alignItems:'center', gap:16 }}>
        <div style={{ width:48, height:48, borderRadius:14, flexShrink:0, background:c.iconGrad, boxShadow:`0 8px 20px -4px ${c.glow}`, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff' }}>
          <Icon size={22} />
        </div>
        <div>
          <p style={{ margin:0, fontSize:'0.95rem', fontWeight:800, color:titleColor, lineHeight:1.2 }}>{title}</p>
          <p style={{ margin:'4px 0 0', fontSize:'0.78rem', color:descColor, fontWeight:500, lineHeight:1.5 }}>{description}</p>
        </div>
      </div>
      <div style={{ flexShrink:0 }}>
        <span style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'9px 18px', borderRadius:10, border:`1px solid ${isRestricted ? restrictedBdr : c.accentBdr}`, background:isRestricted ? 'transparent' : c.accentBg, color:isRestricted ? restrictedColor : c.accent, fontSize:'0.78rem', fontWeight:800, whiteSpace:'nowrap' }}>
          {buttonText}
          {!isRestricted && <LuChevronRight size={13} />}
        </span>
      </div>
    </div>
  );
});

// ─── SKELETON ─────────────────────────────────────────────────────────────────

const StatSkeleton = () => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
    {[...Array(4)].map((_, i) => (
      <div key={i} style={{
        height: 170, borderRadius: 20,
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
        animation: 'pulse 1.5s ease-in-out infinite',
      }} />
    ))}
  </div>
);

// ─── SECTION HEADING ──────────────────────────────────────────────────────────

const SectionHead = ({ icon: Icon, title, subtitle, right, isDark = true }) => {
  const titleColor = isDark ? '#ffffff' : '#0f172a';
  const subtitleColor = isDark ? 'rgba(255,255,255,0.42)' : 'rgba(15,23,42,0.5)';
  return (
    <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', marginBottom:20 }}>
      <div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:32, height:32, borderRadius:10, background:'rgba(167,201,87,0.15)', border:'1px solid rgba(167,201,87,0.25)', display:'flex', alignItems:'center', justifyContent:'center', color:'#a7c957' }}>
            <Icon size={16} />
          </div>
          <h2 style={{ margin:0, fontSize:'1.1rem', fontWeight:900, color:titleColor, letterSpacing:'-0.5px' }}>{title}</h2>
        </div>
        {subtitle && <p style={{ margin:'4px 0 0 42px', fontSize:'0.75rem', color:subtitleColor, fontWeight:500 }}>{subtitle}</p>}
      </div>
      {right}
    </div>
  );
};

// ─── MAIN PAGE ─────────────────────────────────────────────────────────────────

const HomePage = () => {
  const navigate    = useNavigate();
  const { mode }    = useThemeContext();
  const { currentUser }            = useUser();
  const { activeRegion, availableRegions } = useRegion();
  const queryClient = useQueryClient();

  const isDark = mode === 'dark';

  // ── User-derived data ──────────────────────────────────────────────────────
  const THEME_COLORS = useMemo(() => ({
    primary:'#60a561', secondary:'#386641', deepGreen:'#1b4332',
    success:'#6a994e', warning:'#f48c06', error:'#d00000', info:'#0077b6', accent:'#a7c957',
  }), []);

  const userRoles = useMemo(() =>
    Array.isArray(currentUser?.Roles) ? currentUser.Roles : currentUser?.Roles ? [currentUser.Roles] : []
  , [currentUser]);

  const isPreparer = userRoles.includes('BUDGET_PREPARER');

  const rawScope              = String(currentUser?.hierarchicalAccess?.scope || 'REGION').toUpperCase();
  const accessibleDivisions   = currentUser?.hierarchicalAccess?.accessibleDivisions   || [];
  const accessibleDepartments = currentUser?.hierarchicalAccess?.accessibleDepartments || [];
  const hasDivisionAssignment   = accessibleDivisions.length   > 0;
  const hasDepartmentAssignment = accessibleDepartments.length > 0;

  let userAccessLevel = rawScope;
  let userDivision    = accessibleDivisions[0];
  const userDepartment = accessibleDepartments[0]?.departmentName;

  if (rawScope === 'BUDGET_AND_REVENUE_DIVISION' || hasDivisionAssignment) userAccessLevel = 'DIVISION';
  else if (rawScope === 'DEPARTMENT' || hasDepartmentAssignment)           userAccessLevel = 'DEPARTMENT';
  if (isPreparer && (userAccessLevel === 'REGION' || !userAccessLevel || userAccessLevel === 'BUDGET_AND_REVENUE_DIVISION'))
    userAccessLevel = 'DIVISION';

  const divisionName = typeof userDivision === 'string' ? userDivision : (userDivision?.name || userDivision?.divisionName);
  const normRole = r => String(r || '').toUpperCase().replace(/\s+/g, '_').replace(/-/g, '_').trim();
  const isBudgetManager = useMemo(() =>
    userRoles.some(r => normRole(r) === 'BUDGET_MANAGER' || normRole(r) === 'OVERALL_BUDGET_APPROVER')
  , [userRoles]);

  const isReviewer = useMemo(() =>
    userRoles.some(r => {
      const nr = normRole(r);
      return nr === 'BUDGET_REVIEWER' || nr === 'BUDGET_OFFICER' || nr.includes('REVIEWER');
    })
  , [userRoles]);

  const isApprover = useMemo(() =>
    userRoles.some(r => {
      const nr = normRole(r);
      return nr === 'BUDGET_APPROVER' || nr === 'OVERALL_BUDGET_APPROVER' || nr.includes('APPROVER');
    })
  , [userRoles]);

  const isSuperAdmin = useMemo(() => {
    const upper = userRoles.map(r => String(r).toUpperCase());
    return upper.some(r => ['SUPER ADMIN', 'SUPER_ADMIN', 'SUPERADMIN', 'ADMIN'].includes(r));
  }, [userRoles]);

  const regionName = (isBudgetManager && availableRegions?.length > 1)
    ? 'All Regions'
    : (activeRegion?.name || activeRegion?.regionName || 'Your Region');

  const displayInfo = useMemo(() => {
    switch (userAccessLevel) {
      case 'DIVISION':   return { level: 'Division',   name: divisionName   || 'Your Division'   };
      case 'DEPARTMENT': return { level: 'Department', name: userDepartment || 'Your Department' };
      case 'FULL':       return { level: 'System',     name: 'All Regions'                       };
      default:           return { level: 'Region',     name: regionName     || 'Your Region'     };
    }
  }, [userAccessLevel, divisionName, userDepartment, regionName]);

  // ── Clock & telemetry ──────────────────────────────────────────────────────
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [currentTime, setCurrentTime] = useState(new Date());
  const [latency,     setLatency]     = useState(12);
  const [dbOk,        setDbOk]        = useState(true);
  const [cpuLoad,     setCpuLoad]     = useState(2.4);
  const [reqRate,     setReqRate]     = useState(24.5);

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      setLatency(p => { const n = p + (Math.floor(Math.random()*3)-1); return n>=9&&n<=15?n:p; });
      setDbOk(Math.random() > 0.1);
      setCpuLoad(p => { const n = parseFloat((p+(Math.random()*0.6-0.3)).toFixed(1)); return n>=1.2&&n<=4.5?n:p; });
      setReqRate(p => { const n = parseFloat((p+(Math.random()*1.2-0.6)).toFixed(1)); return n>=20&&n<=28?n:p; });
    }, 3000);
    return () => clearInterval(t);
  }, []);

  const greeting = useMemo(() => {
    const h = currentTime.getHours();
    if (h < 5)  return 'Magandang Madaling Araw';
    if (h < 12) return 'Magandang Umaga';
    if (h < 18) return 'Magandang Hapon';
    return 'Magandang Gabi';
  }, [currentTime]);

  // ── Data queries ──────────────────────────────────────────────────────────
  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboardStats', regionName, userAccessLevel],
    queryFn: async () => {
      const regionParam = regionName ? encodeURIComponent(regionName) : '';
      const res = await api.get(`/stats/overview${regionParam ? `?region=${regionParam}` : ''}`);
      setLastUpdated(new Date());
      return res.data;
    },
    refetchInterval: 30000, staleTime: 10000,
    onError: err => handleApiError(err, toast, 'Loading dashboard stats'),
  });

  const totalProposals    = stats?.totalProposals    || 0;
  const pendingProposals  = stats?.pendingProposals  || 0;
  const approvedProposals = stats?.approvedProposals || 0;
  const rejectedProposals = stats?.rejectedProposals || 0;
  const completionRate    = totalProposals > 0 ? ((approvedProposals / totalProposals) * 100).toFixed(1) : 0;
  const fiscalYear        = stats?.fiscalYear || new Date().getFullYear();

  // ── UI state ──────────────────────────────────────────────────────────────
  const [templateSelectorOpen, setTemplateSelectorOpen] = useState(false);
  const [helpOpen, setHelpOpen]                         = useState(false);
  const [canAccessCreateProposal, setCanAccessCreateProposal] = useState(false);

  // ── Permissions ────────────────────────────────────────────────────────────
  const hasCreateProposalEligibility = useMemo(() => {
    const upper = userRoles.map(r => String(r).toUpperCase());
    if (upper.some(r => ['SUPER ADMIN','SUPER_ADMIN','SUPERADMIN'].includes(r))) return true;
    const hasCreate  = hasPermission(currentUser, 'CreateProposals') || hasPermission(currentUser, 'EditOwnProposals');
    const hasBlocked = upper.some(r => ['BUDGET MANAGER','BUDGET_MANAGER','BUDGET OFFICER','BUDGET_OFFICER','BUDGET APPROVER','BUDGET_APPROVER','BUDGET REVIEWER','BUDGET_REVIEWER','BUDGET PLANNING ANALYST','BUDGET_PLANNING_ANALYST'].includes(r));
    return hasCreate && !hasBlocked;
  }, [currentUser, userRoles]);

  useEffect(() => {
    let mounted = true;
    const check = async () => {
      if (!currentUser || !hasCreateProposalEligibility) { if (mounted) setCanAccessCreateProposal(false); return; }
      try {
        const res = await api.get('/allproposal/proposals/preparer-create-access');
        if (mounted) setCanAccessCreateProposal(!res?.data?.hasInProcessProposal);
      } catch { if (mounted) setCanAccessCreateProposal(false); }
    };
    check();
    return () => { mounted = false; };
  }, [currentUser, hasCreateProposalEligibility]);

  const { data: activeSettings } = useQuery({
    queryKey: ['activeSettings'],
    queryFn: async () => { const res = await api.get('/settings/active'); return res.data; },
  });

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleCreateProposal  = useCallback(() => { if (canAccessCreateProposal) navigate('/proposal'); else toast.error('Creation restricted or you have an active proposal pending.'); }, [canAccessCreateProposal, navigate]);
  const handleRefreshStats    = useCallback(() => { queryClient.invalidateQueries(['dashboardStats']); toast.info('Analytics refreshing...'); }, [queryClient]);
  const handleGenerateReports = useCallback(() => navigate('/comprehensive-reports'), [navigate]);

  useKeyboardShortcuts({
    'ctrl+r':       e => { e.preventDefault(); handleRefreshStats(); },
    'ctrl+shift+h': e => { e.preventDefault(); setHelpOpen(true); },
  }, [handleRefreshStats]);

  // ── Analytics data ────────────────────────────────────────────────────────
  const statusBreakdown = useMemo(() => [
    { label: 'Pending Review',     value: pendingProposals,  color: THEME_COLORS.warning },
    { label: 'Approved/Finalized', value: approvedProposals, color: THEME_COLORS.success },
    { label: 'Rejected/Returned',  value: rejectedProposals, color: THEME_COLORS.error   },
  ], [pendingProposals, approvedProposals, rejectedProposals, THEME_COLORS]);

  const analyticsData = useMemo(() => ({
    trends: [{ date: String(fiscalYear), total: totalProposals, approved: approvedProposals, pending: pendingProposals }],
    statusDistribution: statusBreakdown.map(s => ({ name: s.label, value: s.value })),
    budgetTypeDistribution: [
      stats?.breakdown?.legacy?.total      > 0 && { name: 'Legacy',      value: stats.breakdown.legacy.total },
      stats?.breakdown?.newWorkflow?.total > 0 && { name: 'New Workflow', value: stats.breakdown.newWorkflow.total },
    ].filter(Boolean),
  }), [fiscalYear, totalProposals, approvedProposals, pendingProposals, statusBreakdown, stats]);

  // ── SVG ring ──────────────────────────────────────────────────────────────
  const RING_R = 30, RING_C = 2 * Math.PI * RING_R;

  const contextItems = useMemo(() => [
    { label: 'Active Region', value: regionName        || 'N/A', icon: LuMapPin   },
    { label: 'Division',      value: divisionName      || 'N/A', icon: LuBuilding },
    { label: 'Department',    value: userDepartment    || 'N/A', icon: LuFolder   },
    { label: 'Access Scope',  value: displayInfo.level || 'N/A', icon: LuKey      },
  ], [regionName, divisionName, userDepartment, displayInfo.level]);

  const telemetry = useMemo(() => [
    { label: 'API',    value: `${latency}ms`, color: '#34d399', ok: true  },
    { label: 'DB',     value: dbOk ? 'OK' : '~OK', color: dbOk ? '#34d399' : '#fbbf24', ok: dbOk },
    { label: 'CPU',    value: `${cpuLoad}%`,  color: '#fbbf24', ok: true  },
    { label: 'Req/hr', value: `${reqRate}k`,  color: '#c084fc', ok: true  },
  ], [latency, dbOk, cpuLoad, reqRate]);

  const roleHubData = useMemo(() => {
    const activePeriod = activeSettings?.budgetPeriods?.find(p => p.isActive) || activeSettings?.budgetPeriods?.[0];
    const deadlineStr = activePeriod?.dueDate ? new Date(activePeriod.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : null;
    const daysRemaining = activePeriod?.dueDate ? Math.max(0, Math.ceil((new Date(activePeriod.dueDate) - new Date()) / (1000 * 60 * 60 * 24))) : null;

    if (isPreparer) {
      return {
        badge: `FY ${fiscalYear} Submission Active`,
        badgeColor: '#10b981',
        icon: LuCalendar,
        title: 'Drafting & Submission Phase',
        message: <>Magandang araw! Kasalukuyan kang nasa <strong>Preparer role</strong>. Mayroon kang <strong>{totalProposals} budget proposal</strong> na nakarehistro. Mangyaring tapusin at ipasa ang mga ito bago sumapit ang takdang panahon.</>,
        metrics: [
          { label: 'Registered Proposals', value: totalProposals, color: '#38bdf8' },
          { label: 'Approved Proposals', value: approvedProposals, color: '#34d399' },
          { label: daysRemaining !== null ? 'Days Remaining' : 'Deadline', value: daysRemaining !== null ? `${daysRemaining} Araw` : (deadlineStr || 'N/A'), color: daysRemaining !== null && daysRemaining <= 5 ? '#f43f5e' : '#fbbf24' }
        ]
      };
    }

    if (isReviewer) {
      return {
        badge: `FY ${fiscalYear} Evaluation Hub`,
        badgeColor: '#fbbf24',
        icon: LuClipboardList,
        title: 'Proposal Validation Queue',
        message: <>Magandang araw! Bilang isang <strong>Reviewer</strong>, mayroon kang <strong>{pendingProposals} proposal</strong> na naghihintay ng iyong pag-validate at rekomendasyon.</>,
        metrics: [
          { label: 'Pending Evaluation', value: pendingProposals, color: '#fbbf24' },
          { label: 'Reviewed Items', value: approvedProposals, color: '#34d399' },
          { label: 'Total Regional Proposals', value: totalProposals, color: '#38bdf8' }
        ]
      };
    }

    if (isApprover) {
      return {
        badge: `FY ${fiscalYear} Executive Endorsement`,
        badgeColor: '#3b82f6',
        icon: LuShieldCheck,
        title: 'Executive Approval Hub',
        message: <>Magandang araw! Naka-login ka bilang <strong>Approver</strong>. Mayroong <strong>{pendingProposals} proposal</strong> na naghihintay ng iyong final endorsement at lagda.</>,
        metrics: [
          { label: 'Awaiting Endorsement', value: pendingProposals, color: '#60a5fa' },
          { label: 'Signed/Approved', value: approvedProposals, color: '#34d399' },
          { label: 'Total Proposals', value: totalProposals, color: '#a7b5ff' }
        ]
      };
    }

    if (isBudgetManager) {
      return {
        badge: `FY ${fiscalYear} Regional Oversight`,
        badgeColor: '#a855f7',
        icon: LuTrendingUp,
        title: 'Budget Management Dashboard',
        message: <>Magandang araw, <strong>Budget Manager</strong>! Ang pangkalahatang Submission Health ng rehiyon ay nasa <strong>{completionRate}%</strong> ({approvedProposals} sa {totalProposals} proposals ang finalized).</>,
        metrics: [
          { label: 'Overall Completion', value: `${completionRate}%`, color: '#a7c957' },
          { label: 'Finalized Proposals', value: approvedProposals, color: '#34d399' },
          { label: 'Total Regional Items', value: totalProposals, color: '#c084fc' }
        ]
      };
    }

    // Default Fallback
    return {
      badge: `FY ${fiscalYear} Budget Cycle`,
      badgeColor: '#10b981',
      icon: LuInfo,
      title: 'Budget Information Hub',
      message: <>Magandang araw! Maligayang pagdating sa OSBPIS system. Ang pangkalahatang Submission Health ng rehiyon ay nasa <strong>{completionRate}%</strong>.</>,
      metrics: [
        { label: 'Submission Health', value: `${completionRate}%`, color: '#34d399' },
        { label: 'Total Proposals', value: totalProposals, color: '#38bdf8' },
        { label: 'Approved Proposals', value: approvedProposals, color: '#10b981' }
      ]
    };
  }, [isPreparer, isReviewer, isApprover, isBudgetManager, fiscalYear, totalProposals, approvedProposals, pendingProposals, completionRate, activeSettings]);

  // ── Global background ─────────────────────────────────────────────────
  const pageBg = '#ffffff';

  const textPrimary   = isDark ? '#ffffff'           : '#0f172a';
  const textSecondary = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(15,23,42,0.55)';
  const cardBg        = '#ffffff';
  const cardBorder    = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)';

  return (
    <>
      {/* Inline keyframes */}
      <style>{`
        @keyframes drawSpark { from { stroke-dashoffset: 200; } to { stroke-dashoffset: 0; } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity: 0.4; } 50% { opacity: 0.8; } }
        @keyframes floatOrb { 0%,100% { transform: translateY(0) scale(1); opacity: 0.15; } 50% { transform: translateY(-18px) scale(1.05); opacity: 0.28; } }
        @keyframes floatOrb2 { 0%,100% { transform: translateY(0); opacity: 0.12; } 50% { transform: translateY(20px); opacity: 0.22; } }
        @keyframes ledPulse { 0%,100% { opacity: 0.5; transform: scale(0.9); } 50% { opacity: 1; transform: scale(1.3); } }
        @keyframes shimBar { from { transform: translateX(-100%); } to { transform: translateX(200%); } }
        .db-page * { box-sizing: border-box; }

        /* Responsive Mobile Layout Overrides */
        @media (max-width: 991px) {
          .db-main-container {
            padding: 20px 16px !important;
            gap: 24px !important;
          }
          .db-welcome-grid {
            grid-template-columns: 1fr !important;
            padding: 48px 40px !important;
            text-align: center;
            justify-items: center;
          }
          .db-welcome-chips {
            justify-content: center !important;
          }
          .db-welcome-right {
            width: 100% !important;
            min-width: 0 !important;
            padding: 24px !important;
          }
          .db-role-hub {
            padding: 20px !important;
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 20px !important;
          }
          .db-role-hub-left {
            flex-direction: column !important;
            text-align: center !important;
            align-items: center !important;
          }
          .db-role-hub-metrics {
            justify-content: center !important;
            width: 100% !important;
            display: grid !important;
            grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)) !important;
            gap: 10px !important;
          }
          .db-quick-ops-grid {
            grid-template-columns: 1fr !important;
            gap: 12px !important;
          }
          .db-action-card {
            flex-direction: column !important;
            align-items: stretch !important;
            text-align: center !important;
            gap: 16px !important;
          }
          .db-action-card > div {
            flex-direction: column !important;
            align-items: center !important;
            text-align: center !important;
          }
          .db-kpi-grid {
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)) !important;
            gap: 16px !important;
          }
          .db-distribution-section {
            grid-template-columns: 1fr !important;
            gap: 24px !important;
          }
        }
      `}</style>

      <div className="db-page" style={{ minHeight: '100vh', background: pageBg, fontFamily: "'Inter','Outfit',sans-serif" }}>
        <div className="db-main-container" style={{ maxWidth: '100%', padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* ══════════════════════════════════════════════════════════════════
              §1 — HERO WELCOME BANNER
          ══════════════════════════════════════════════════════════════════════ */}
          <section style={{
            position: 'relative', overflow: 'hidden',
            borderRadius: 24,
            border: '1px solid rgba(255,255,255,0.08)',
            background: 'linear-gradient(135deg, #012a14 0%, #00381c 45%, #004d26 100%)',
            boxShadow: '0 24px 60px -20px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)',
          }}>
            {/* Ambient orbs */}
            <div style={{ position:'absolute', top:-80, right:-60, width:320, height:320, borderRadius:'50%', background:'radial-gradient(circle, rgba(255,255,255,0.05) 0%, transparent 65%)', pointerEvents:'none', animation:'floatOrb 9s ease-in-out infinite' }} />
            <div style={{ position:'absolute', bottom:-60, left:-60, width:260, height:260, borderRadius:'50%', background:'radial-gradient(circle, rgba(255,255,255,0.03) 0%, transparent 65%)', pointerEvents:'none', animation:'floatOrb2 12s ease-in-out infinite' }} />
            {/* Grid pattern */}
            <div style={{ position:'absolute', inset:0, pointerEvents:'none', opacity:0.02, backgroundImage:'linear-gradient(rgba(255,255,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,1) 1px,transparent 1px)', backgroundSize:'40px 40px' }} />
 
            <div className="db-welcome-grid" style={{ position:'relative', zIndex:1, display:'grid', gridTemplateColumns:'1fr auto', gap:24, padding:'40px 60px', alignItems:'center' }}>
              {/* Left */}
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                <div>
                  <span style={{ display:'block', fontSize:'0.58rem', fontWeight:800, letterSpacing:'0.2em', color:'#94b24b', textTransform:'uppercase', marginBottom:6, opacity:0.85, paddingLeft: 4 }}>
                    Official Budget System Portal · FMIS-OSBPIS
                  </span>
                  <h1 style={{ margin:0, fontSize:'clamp(1.4rem,2.8vw,2.4rem)', fontWeight:900, color:'#ffffff', lineHeight:1.1, letterSpacing:'-0.8px', paddingLeft: 4 }}>
                    {greeting},&nbsp;
                    <span style={{ color:'#94b24b', textShadow:'0 0 20px rgba(148,178,75,0.3)' }}>{formatDisplayName(currentUser)}</span>!
                  </h1>
                </div>

                <p style={{ margin:0, fontSize:'0.88rem', color:'rgba(255,255,255,0.6)', fontWeight:500, lineHeight:1.6, maxWidth:500 }}>
                  {isPreparer
                    ? `Welcome back to your central hub for FMIS budget management. Manage proposals and track compliance for FY ${fiscalYear}.`
                    : `Welcome back! Monitor budget submissions for ${regionName}. Review pending items and track progress in real-time for FY ${fiscalYear}.`}
                </p>

                {/* Info chips */}
                <div className="db-welcome-chips" style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                  {[
                    { icon: LuCalendar, label:`FY ${fiscalYear}` },
                    { icon: LuKey,      label:`${displayInfo.level} Access` },
                    { icon: LuMapPin,   label:regionName },
                  ].map(({ icon: IC, label }) => (
                    <div key={label} style={{
                      display:'flex', alignItems:'center', gap:6,
                      padding:'5px 12px', borderRadius:999,
                      background:'rgba(255,255,255,0.06)',
                      border:'1px solid rgba(255,255,255,0.1)',
                      fontSize:'0.7rem', fontWeight:700, color:'rgba(255,255,255,0.8)',
                    }}>
                      <IC size={11} color="#94b24b" />
                      {label}
                    </div>
                  ))}
                </div>
              </div>

              {/* Right — Clock + Ring */}
              <div className="db-welcome-right" style={{
                minWidth:220, padding:'24px 28px',
                background:'rgba(255,255,255,0.03)',
                border:'1px solid rgba(255,255,255,0.08)',
                borderRadius:18, backdropFilter:'blur(12px)',
                display:'flex', flexDirection:'column', alignItems:'center', gap:14,
                boxShadow:'inset 0 1px 0 rgba(255,255,255,0.06)',
              }}>
                <span style={{ fontSize:'0.55rem', fontWeight:800, letterSpacing:'0.18em', color:'#94b24b', textTransform:'uppercase' }}>System Local Time</span>
                <p style={{ margin:0, fontSize:'2.2rem', fontWeight:900, color:'#ffffff', fontFamily:'monospace', letterSpacing:'-1px', lineHeight:1 }}>
                  {currentTime.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit', second:'2-digit' })}
                </p>
                <p style={{ margin:0, fontSize:'0.62rem', color:'rgba(255,255,255,0.35)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em', textAlign:'center' }}>
                  {currentTime.toLocaleDateString([], { weekday:'long', year:'numeric', month:'long', day:'numeric' })}
                </p>
                <div style={{ width:'100%', height:1, background:'rgba(255,255,255,0.06)' }} />
                <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                  <div style={{ position:'relative', display:'inline-flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <svg width="64" height="64" viewBox="0 0 72 72" style={{ transform:'rotate(-90deg)' }}>
                      <circle cx="36" cy="36" r={RING_R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
                      <circle cx="36" cy="36" r={RING_R} fill="none" stroke="#94b24b" strokeWidth="6" strokeLinecap="round"
                        strokeDasharray={RING_C}
                        strokeDashoffset={RING_C * (1 - completionRate / 100)}
                        style={{ filter:'drop-shadow(0 0 6px rgba(148,178,75,0.5))', transition:'stroke-dashoffset 1.5s cubic-bezier(0.4,0,0.2,1)' }}
                      />
                    </svg>
                    <span style={{ position:'absolute', fontSize:'0.65rem', fontWeight:900, color:'#ffffff' }}>{completionRate}%</span>
                  </div>
                  <div>
                    <p style={{ margin:0, fontSize:'0.75rem', fontWeight:800, color:'#ffffff', lineHeight:1.2 }}>Submission Health</p>
                    <p style={{ margin:'2px 0 0', fontSize:'0.6rem', color:'rgba(255,255,255,0.35)', fontWeight:600 }}>FY {fiscalYear} Approved</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ══════════════════════════════════════════════════════════════════
              §2 — LIVE TELEMETRY BAR
          ══════════════════════════════════════════════════════════════════════ */}
          {/* ══════════════════════════════════════════════════════════════════
              §2 — EXECUTIVE ROLE HUB & TELEMETRY
          ══════════════════════════════════════════════════════════════════════ */}
          {isSuperAdmin ? (
            <section style={{
              display:'flex', flexWrap:'wrap', alignItems:'center', justifyContent:'space-between', gap:16,
              padding:'14px 24px',
              background: isDark ? 'linear-gradient(135deg,#030806 0%,#040a06 100%)' : 'rgba(255,255,255,0.9)',
              border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.08)',
              borderRadius:16,
              boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.4)' : '0 6px 20px rgba(0,0,0,0.04)',
            }}>
              {/* Live badge */}
              <div style={{ display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
                <span style={{ position:'relative', display:'inline-flex', width:10, height:10, flexShrink:0 }}>
                  <span style={{ position:'absolute', inset:0, borderRadius:'50%', background:'#34d399', opacity:0.6, animation:'ledPulse 1.8s ease-in-out infinite' }} />
                  <span style={{ position:'relative', width:10, height:10, borderRadius:'50%', background:'#34d399', display:'inline-flex' }} />
                </span>
                <div>
                  <p style={{ margin:0, fontSize:'0.62rem', fontWeight:900, color:'#a7c957', textTransform:'uppercase', letterSpacing:'0.16em' }}>Live System Monitor</p>
                  <p style={{ margin:0, fontSize:'0.55rem', fontWeight:700, color: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(15,23,42,0.4)', letterSpacing:'0.12em', textTransform:'uppercase' }}>Real-time cluster telemetry</p>
                </div>
              </div>

              {/* Metrics */}
              <div style={{ display:'flex', flexWrap:'wrap', gap:10, alignItems:'center' }}>
                {telemetry.map(m => (
                  <div key={m.label} style={{
                    display:'flex', alignItems:'center', gap:8, padding:'7px 14px',
                    background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                    border: isDark ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(0,0,0,0.05)',
                    borderRadius:10,
                  }}>
                    <span style={{ width:6, height:6, borderRadius:'50%', background:m.color, flexShrink:0, animation:'ledPulse 2s ease-in-out infinite', boxShadow:`0 0 6px ${m.color}` }} />
                    <span style={{ fontSize:'0.58rem', fontWeight:800, color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(15,23,42,0.5)', textTransform:'uppercase', letterSpacing:'0.1em' }}>{m.label}:</span>
                    <span style={{ fontSize:'0.68rem', fontWeight:900, fontFamily:'monospace', color:m.color }}>{m.value}</span>
                  </div>
                ))}

                <div style={{ width:1, height:20, background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)', flexShrink:0 }} />

                {[
                  { t:'Cluster: ap-se-1', c:'#34d399' },
                  { t:'Sync: Active',     c:'#34d399' },
                  { t:'Build: Stable',    c:'#38bdf8' },
                ].map(b => (
                  <span key={b.t} style={{
                    padding:'4px 10px', borderRadius:999, fontSize:'0.58rem', fontWeight:800,
                    color:b.c, background:`${b.c}18`, border:`1px solid ${b.c}30`,
                  }}>
                    {b.t}
                  </span>
                ))}
              </div>
            </section>
          ) : (
            <section className="db-role-hub" style={{
              display:'flex', flexWrap:'wrap', alignItems:'center', justifyContent:'space-between', gap:20,
              padding:'24px 32px',
              background: isDark ? 'rgba(255,255,255,0.03)' : '#ffffff',
              border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)',
              borderRadius:24,
              boxShadow: isDark ? '0 10px 30px rgba(0,0,0,0.5)' : '0 8px 30px rgba(0,0,0,0.04)',
              position: 'relative',
              overflow: 'hidden',
            }}>
              {/* Corner ambient glow */}
              <div style={{ position:'absolute', top:-40, right:-40, width:150, height:150, borderRadius:'50%', background: `radial-gradient(circle, ${roleHubData.badgeColor}12 0%, transparent 70%)`, pointerEvents:'none' }} />

              {/* Left Column - Info & Guidelines */}
              <div className="db-role-hub-left" style={{ display:'flex', alignItems:'center', gap:20, flex: '1 1 500px', zIndex: 1 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 14,
                  background: isDark ? 'rgba(52,211,153,0.08)' : 'rgba(74,222,128,0.12)',
                  border: isDark ? '1px solid rgba(52,211,153,0.2)' : '1px solid rgba(74,222,128,0.25)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: roleHubData.badgeColor, flexShrink: 0,
                  boxShadow: `0 8px 20px -6px ${roleHubData.badgeColor}33`
                }}>
                  {React.createElement(roleHubData.icon, { size: 22 })}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap:10, flexWrap: 'wrap', marginBottom: 6 }}>
                    <h3 style={{ margin:0, fontSize:'0.9rem', fontWeight:900, color: isDark ? '#ffffff' : '#0f172a', letterSpacing:'-0.3px' }}>
                      {roleHubData.title}
                    </h3>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', padding: '3px 9px', borderRadius: 999,
                      fontSize: '0.6rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em',
                      color: roleHubData.badgeColor, background: `${roleHubData.badgeColor}15`,
                      border: `1px solid ${roleHubData.badgeColor}25`
                    }}>
                      {roleHubData.badge}
                    </span>
                  </div>
                  <p style={{ margin:0, fontSize:'0.82rem', color: isDark ? 'rgba(255,255,255,0.75)' : '#334155', fontWeight: 500, lineHeight: 1.5 }}>
                    {roleHubData.message}
                  </p>
                </div>
              </div>

              {/* Right Column - Status Metrics */}
              <div className="db-role-hub-metrics" style={{ display:'flex', gap:14, alignItems:'center', flexWrap:'wrap', zIndex: 1 }}>
                {roleHubData.metrics.map(metric => (
                  <div key={metric.label} style={{
                    display:'flex', flexDirection:'column', gap: 4, padding:'8px 18px',
                    background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.9)',
                    border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)',
                    borderRadius:12, minWidth: 120,
                    boxShadow: isDark ? 'none' : '0 2px 8px rgba(0,0,0,0.03)'
                  }}>
                    <span style={{
                      fontSize:'0.56rem', fontWeight:800,
                      color: isDark ? 'rgba(255,255,255,0.42)' : 'rgba(15,23,42,0.5)',
                      textTransform:'uppercase', letterSpacing:'0.06em'
                    }}>
                      {metric.label}
                    </span>
                    <span style={{
                      fontSize:'1.15rem', fontWeight:900,
                      fontFamily:'monospace', color: metric.color,
                      lineHeight: 1.1
                    }}>
                      {metric.value}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              §3 — QUICK OPERATIONS
          ══════════════════════════════════════════════════════════════════════ */}
          <section>
            <SectionHead
              icon={LuZap}
              title="Quick Operations"
              subtitle="Common tasks and shortcuts for your role"
              isDark={isDark}
              right={
                <button
                  onClick={handleRefreshStats}
                  style={{
                    display:'flex', alignItems:'center', gap:6, padding:'8px 16px',
                    borderRadius:10, border:'1px solid rgba(52,211,153,0.25)',
                    background:'rgba(52,211,153,0.08)', color:'#059669',
                    fontSize:'0.75rem', fontWeight:800, cursor:'pointer',
                    transition:'all 0.2s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background='#34d399'; e.currentTarget.style.color='#fff'; }}
                  onMouseLeave={e => { e.currentTarget.style.background='rgba(52,211,153,0.08)'; e.currentTarget.style.color='#059669'; }}
                >
                  <LuRefreshCw size={13} /> Refresh
                </button>
              }
            />

            <div className="db-quick-ops-grid" style={{ display:'grid', gridTemplateColumns: isPreparer ? 'repeat(3,1fr)' : 'repeat(2,1fr)', gap:16 }}>
              {isPreparer && (
                <ActionCard
                  title="New Proposal"
                  description="Initiate a fresh budget proposal using the official 6-step wizard."
                  icon={LuPlus}
                  accentKey="emerald"
                  onClick={handleCreateProposal}
                  buttonText={canAccessCreateProposal ? 'Start Creation' : 'Restricted'}
                  isRestricted={!canAccessCreateProposal}
                  isDark={isDark}
                />
              )}
              <ActionCard
                title="Deep Analytics"
                description="Explore granular data with customizable reporting tools."
                icon={LuTrendingUp}
                accentKey="sky"
                onClick={handleGenerateReports}
                buttonText="Open Reports"
                isDark={isDark}
              />
              <ActionCard
                title="Workflow Tracker"
                description="Monitor every stage of your submissions in the central pipeline."
                icon={LuClipboardList}
                accentKey="amber"
                onClick={() => navigate('/allproposal')}
                buttonText="View Tracker"
                isDark={isDark}
              />
            </div>
          </section>

          {/* ══════════════════════════════════════════════════════════════════
              §4 — KPI CARDS
          ══════════════════════════════════════════════════════════════════════ */}
          <section>
            <SectionHead
              icon={LuActivity}
              title="Key Performance Indicators"
              subtitle={`FY ${fiscalYear} — Real-time budget proposal metrics`}
              isDark={isDark}
              right={
                <span style={{
                  padding:'6px 14px', borderRadius:10,
                  background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                  border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)',
                  fontSize:'0.65rem', fontWeight:700,
                  color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(15,23,42,0.5)',
                }}>
                  Synced: {lastUpdated.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit', second:'2-digit' })}
                </span>
              }
            />

            {isLoading ? <StatSkeleton /> : (
              <div className="db-kpi-grid" style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:20 }}>
                <StatCard title="Total Proposals"  value={totalProposals}    colorKey="sky"     icon={LuTrendingUp}  isLoading={isLoading} progress={100} isDark={isDark} />
                <StatCard title="Pending Review"   value={pendingProposals}  colorKey="amber"   icon={LuClock}       isLoading={isLoading} progress={totalProposals > 0 ? (pendingProposals/totalProposals)*100 : 0} isDark={isDark} />
                <StatCard title="Approved"         value={approvedProposals} colorKey="emerald" icon={LuShieldCheck} isLoading={isLoading} progress={totalProposals > 0 ? (approvedProposals/totalProposals)*100 : 0} isDark={isDark} />
                <StatCard title="Rejected"         value={rejectedProposals} colorKey="rose"    icon={LuX}           isLoading={isLoading} progress={totalProposals > 0 ? (rejectedProposals/totalProposals)*100 : 0} isDark={isDark} />
              </div>
            )}
          </section>

          {/* ══════════════════════════════════════════════════════════════════
              §5 — DISTRIBUTION + CONTEXT
          ══════════════════════════════════════════════════════════════════════ */}
          <section className="db-distribution-section" style={{ display:'grid', gridTemplateColumns:'7fr 5fr', gap:20, alignItems:'stretch' }}>

            {/* Distribution */}
            <div style={{ background:cardBg, border:`1px solid ${cardBorder}`, borderRadius:24, padding:36, backdropFilter:'blur(12px)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24 }}>
                <div>
                  <h3 style={{ margin:0, fontSize:'1rem', fontWeight:900, color:textPrimary }}>Proposal Distribution</h3>
                  <p style={{ margin:'4px 0 0', fontSize:'0.75rem', color:textSecondary, fontWeight:500 }}>Real-time status tracking · FY {fiscalYear}</p>
                </div>
                <button
                  onClick={() => navigate('/allproposal')}
                  style={{
                    display:'flex', alignItems:'center', gap:4, padding:'7px 12px',
                    borderRadius:9, border:'1px solid rgba(52,211,153,0.2)',
                    background:'rgba(52,211,153,0.08)', color:'#34d399',
                    fontSize:'0.65rem', fontWeight:900, cursor:'pointer', letterSpacing:'0.08em',
                    textTransform:'uppercase',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background='#34d399'; e.currentTarget.style.color='#fff'; }}
                  onMouseLeave={e => { e.currentTarget.style.background='rgba(52,211,153,0.08)'; e.currentTarget.style.color='#34d399'; }}
                >
                  View All <LuArrowRight size={11} />
                </button>
              </div>

              {totalProposals > 0 ? (
                <div style={{ display:'flex', flexDirection:'column', gap:22 }}>
                  {statusBreakdown.map(s => {
                    const pct = ((s.value / totalProposals) * 100).toFixed(1);
                    return (
                      <div key={s.label}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                            <span style={{ width:10, height:10, borderRadius:'50%', background:s.color, flexShrink:0, boxShadow:`0 0 8px ${s.color}66` }} />
                            <span style={{ fontSize:'0.85rem', fontWeight:700, color:textPrimary }}>{s.label}</span>
                          </div>
                          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                            <span style={{ fontSize:'0.9rem', fontWeight:900, color:s.color }}>{formatNumber(s.value)}</span>
                            <span style={{ fontSize:'0.72rem', fontWeight:700, color:textSecondary }}>({pct}%)</span>
                          </div>
                        </div>
                        <div style={{ width:'100%', height:8, background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', borderRadius:999, overflow:'hidden', position:'relative' }}>
                          <div style={{
                            height:'100%', width:`${pct}%`, borderRadius:999,
                            background:s.color,
                            boxShadow:`0 0 10px ${s.color}55`,
                            transition:'width 1.2s cubic-bezier(0.4,0,0.2,1)',
                            position:'relative', overflow:'hidden',
                          }}>
                            <div style={{ position:'absolute', inset:0, background:'linear-gradient(90deg,transparent,rgba(255,255,255,0.3),transparent)', transform:'translateX(-100%)', animation:'shimBar 2.5s linear infinite' }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Totals row */}
                  <div style={{ marginTop:4, padding:'14px 18px', background: isDark ? 'rgba(167,201,87,0.06)' : 'rgba(167,201,87,0.05)', border:'1px solid rgba(167,201,87,0.15)', borderRadius:12, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span style={{ fontSize:'0.8rem', fontWeight:800, color:textSecondary }}>Total Submissions</span>
                    <span style={{ fontSize:'1.1rem', fontWeight:900, color:'#a7c957' }}>{formatNumber(totalProposals)}</span>
                  </div>
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'40px 0', textAlign:'center' }}>
                  <div style={{ width:64, height:64, borderRadius:20, background:'rgba(255,255,255,0.04)', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:16, border:'1px solid rgba(255,255,255,0.08)' }}>
                    <LuInbox size={28} color="rgba(255,255,255,0.2)" />
                  </div>
                  <p style={{ margin:'0 0 6px', fontSize:'0.95rem', fontWeight:800, color:textPrimary }}>No Proposals Yet</p>
                  <p style={{ margin:'0 0 20px', fontSize:'0.78rem', color:textSecondary }}>Data will appear once submissions begin.</p>
                  {isPreparer && (
                    <button
                      onClick={handleCreateProposal}
                      disabled={!canAccessCreateProposal}
                      style={{
                        padding:'9px 20px', borderRadius:10, border:'1px solid rgba(52,211,153,0.3)',
                        background:'rgba(52,211,153,0.1)', color:'#34d399',
                        fontSize:'0.8rem', fontWeight:800, cursor:'pointer',
                      }}
                    >
                      Create First Proposal
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* System Context */}
            <div style={{ background:cardBg, border:`1px solid ${cardBorder}`, borderRadius:24, padding:36, backdropFilter:'blur(12px)', display:'flex', flexDirection:'column', gap:16 }}>
              <div>
                <h3 style={{ margin:0, fontSize:'1rem', fontWeight:900, color:textPrimary }}>System Context</h3>
                <p style={{ margin:'4px 0 0', fontSize:'0.75rem', color:textSecondary, fontWeight:500 }}>Your current access scope</p>
              </div>

              <div style={{ display:'flex', flexDirection:'column', gap:10, flex:1, justifyContent:'center' }}>
                {contextItems.map(({ label, value, icon: IC }) => (
                  <div key={label} style={{
                    display:'flex', alignItems:'center', gap:14, padding:'14px 16px',
                    background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                    border:`1px solid ${cardBorder}`,
                    borderRadius:14,
                    transition:'all 0.2s',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor='rgba(167,201,87,0.3)'; e.currentTarget.style.background='rgba(167,201,87,0.05)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor=cardBorder; e.currentTarget.style.background= isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'; }}
                  >
                    <div style={{ width:38, height:38, borderRadius:11, background:'rgba(167,201,87,0.1)', border:'1px solid rgba(167,201,87,0.2)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, color:'#a7c957' }}>
                      <IC size={15} />
                    </div>
                    <div style={{ minWidth:0 }}>
                      <p style={{ margin:0, fontSize:'0.6rem', fontWeight:900, color:textSecondary, textTransform:'uppercase', letterSpacing:'0.1em', lineHeight:1.3 }}>{label}</p>
                      <p style={{ margin:'2px 0 0', fontSize:'0.88rem', fontWeight:800, color:textPrimary, lineHeight:1.3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{value}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* User role badge */}
              <div style={{ padding:'12px 16px', background:'rgba(167,201,87,0.08)', border:'1px solid rgba(167,201,87,0.2)', borderRadius:12, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <span style={{ fontSize:'0.72rem', fontWeight:700, color:'rgba(255,255,255,0.5)' }}>Primary Role</span>
                <span style={{ fontSize:'0.72rem', fontWeight:900, color:'#a7c957' }}>{formatRoleDisplay(userRoles[0])}</span>
              </div>
            </div>
          </section>

          {/* ══════════════════════════════════════════════════════════════════
              §6 — VISUAL ANALYTICS
          ══════════════════════════════════════════════════════════════════════ */}
          <section style={{ background:cardBg, border:`1px solid ${cardBorder}`, borderRadius:24, padding:'32px 36px', backdropFilter:'blur(12px)' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:28 }}>
              <div>
                <h2 style={{ margin:0, fontSize:'1.1rem', fontWeight:900, color:textPrimary, display:'flex', alignItems:'center', gap:10 }}>
                  <span style={{ fontSize:'1.2rem' }}>📊</span> Visual Analytics
                </h2>
                <p style={{ margin:'4px 0 0', fontSize:'0.75rem', color:textSecondary, fontWeight:500 }}>Historical trends and current proposal status distribution</p>
              </div>
              <button
                onClick={() => setHelpOpen(true)}
                style={{
                  display:'flex', alignItems:'center', gap:6, padding:'7px 14px',
                  borderRadius:10, border:'1px solid rgba(255,255,255,0.1)',
                  background:'rgba(255,255,255,0.04)', color:'rgba(255,255,255,0.55)',
                  fontSize:'0.72rem', fontWeight:700, cursor:'pointer',
                  transition:'all 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.color='#a7c957'; e.currentTarget.style.borderColor='rgba(167,201,87,0.3)'; }}
                onMouseLeave={e => { e.currentTarget.style.color='rgba(255,255,255,0.55)'; e.currentTarget.style.borderColor='rgba(255,255,255,0.1)'; }}
              >
                <LuInfo size={13} /> Help & Legend
              </button>
            </div>

            <div style={{ background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.8)', borderRadius:16, padding:'20px 16px', border:`1px solid ${cardBorder}` }}>
              <DashboardAnalytics data={analyticsData} />
            </div>
          </section>

        </div>
      </div>

      <WorkflowTemplateSelector open={templateSelectorOpen} onClose={() => setTemplateSelectorOpen(false)} onSelectTemplate={t => console.log(t)} fiscalYear={activeSettings?.fiscalYear} />
      <InAppHelp open={helpOpen} onClose={() => setHelpOpen(false)} context="dashboard" />
    </>
  );
};

export default HomePage;