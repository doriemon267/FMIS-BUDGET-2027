import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { Box, IconButton, Badge, useMediaQuery, useTheme, Fade, Tooltip } from '@mui/material';
import { FiX, FiMinus, FiMessageSquare } from 'react-icons/fi';

const FixedChatWindow = ({ children, onClose, onMinimize, minimized = false, zIndex = 1400, isPinned = true, dimOnOpen = false }) => {
  const theme = useTheme();
  const isSmall = useMediaQuery(theme.breakpoints.down('sm'));
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    const handler = (e) => {
      try {
        const c = e?.detail?.count || 0;
        setUnread(Number(c));
      } catch (_) {}
    };
    window.addEventListener('chat-unread', handler);

    try {
      const s = JSON.parse(localStorage.getItem('chatSettings') || '{}');
      if (s && typeof s.unread === 'number') setUnread(Number(s.unread));
    } catch (_) {}

    return () => window.removeEventListener('chat-unread', handler);
  }, []);

  useEffect(() => {
    try {
      const cs = JSON.parse(localStorage.getItem('chatSettings') || '{}');
      const next = { ...(cs || {}), unread: Number(unread) };
      localStorage.setItem('chatSettings', JSON.stringify(next));
    } catch (_) {}
  }, [unread]);

  const desktopStyle = isPinned ? {
    position: 'fixed',
    right: 24,
    bottom: 24,
    zIndex: Math.max(zIndex + 1, 99999),
    width: 720,
    height: 700,
    maxWidth: 'calc(100vw - 48px)',
    maxHeight: 'calc(100vh - 48px)',
    borderRadius: '24px', // Matches Launcher panel
    overflow: 'hidden',
    boxShadow: '0 24px 64px rgba(0, 0, 0, 0.35)',
    bgcolor: 'rgba(15, 15, 30, 0.75)', // Elegant dark glassmorphic bg
    backdropFilter: 'blur(25px) saturate(180%)',
    webkitBackdropFilter: 'blur(25px) saturate(180%)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    display: 'flex',
    flexDirection: 'column',
    transition: 'transform 260ms cubic-bezier(0.4, 0, 0.2, 1), right 260ms, bottom 260ms',
  } : {
    position: 'fixed',
    left: '50%',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    zIndex: zIndex + 1,
    width: 720,
    height: 700,
    maxWidth: 'calc(100vw - 48px)',
    maxHeight: 'calc(100vh - 48px)',
    borderRadius: '24px',
    overflow: 'hidden',
    boxShadow: '0 24px 64px rgba(0, 0, 0, 0.35)',
    bgcolor: 'rgba(15, 15, 30, 0.75)',
    backdropFilter: 'blur(25px) saturate(180%)',
    webkitBackdropFilter: 'blur(25px) saturate(180%)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    display: 'flex',
    flexDirection: 'column',
  };

  const mobileStyle = {
    position: 'fixed',
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
    zIndex: zIndex + 1,
    width: '100vw',
    height: '100vh',
    overflow: 'hidden',
    bgcolor: 'rgba(15, 15, 30, 0.98)',
    display: 'flex',
    flexDirection: 'column',
  };

  const rootRef = useRef(null);
  useEffect(() => {
    if (!minimized && rootRef.current) {
      try { rootRef.current.focus(); } catch (e) {}
    }
  }, [minimized]);

  // Prevent page scroll when chat window is visible and not minimized
  useEffect(() => {
    try {
      const doc = document.documentElement;
      const body = document.body;
      const findScrollable = () => {
        const candidates = [doc, body, document.getElementById('root'), document.getElementById('app'), document.querySelector('.App'), document.querySelector('main'), document.querySelector('#content'), document.querySelector('.layout-content')];
        for (const e of candidates) {
          if (!e) continue;
          try {
            if (e.scrollHeight > e.clientHeight) return e;
          } catch (err) { /* ignore */ }
        }
        return doc;
      };
      const scrollTarget = findScrollable() || doc;
      const originalDocOverflow = doc.style.overflow;
      const originalBodyOverflow = body.style.overflow;
      const originalDocPaddingRight = doc.style.paddingRight;
      const originalBodyPaddingRight = body.style.paddingRight;
      if (!minimized) {
        const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
        if (scrollBarWidth > 0) {
          doc.style.paddingRight = `${scrollBarWidth}px`;
          body.style.paddingRight = `${scrollBarWidth}px`;
          try { scrollTarget.style.paddingRight = `${scrollBarWidth}px`; } catch (e) {}
        }
        const appRoot = document.getElementById('root') || document.getElementById('app') || document.querySelector('[data-root]') || document.querySelector('.App');
        if (appRoot) {
          try {
            appRoot.classList.add('chat-open');
            appRoot.style.overflow = 'hidden';
            appRoot.style.paddingRight = scrollBarWidth > 0 ? `${scrollBarWidth}px` : '';
          } catch (e) { /* ignore */ }
        }
        doc.style.overflow = 'hidden';
        body.style.overflow = 'hidden';
        if (isPinned) {
          try { document.body.classList.add('chat-pinned-no-dim'); } catch (e) {}
          try { document.documentElement.classList.add('chat-pinned-no-dim'); } catch (e) {}
          try {
            const appRoot = document.getElementById('root') || document.getElementById('app') || document.querySelector('[data-root]') || document.querySelector('.App');
            if (appRoot) {
              try { appRoot.classList.add('chat-pinned-no-dim'); } catch (e) {}
            }
          } catch (e) {}
        }
        try { scrollTarget.style.overflow = 'hidden'; } catch (e) {}
      }
      return () => {
        doc.style.overflow = originalDocOverflow || '';
        body.style.overflow = originalBodyOverflow || '';
        try { document.body.classList.remove('chat-pinned-no-dim'); } catch (e) {}
        try { document.documentElement.classList.remove('chat-pinned-no-dim'); } catch (e) {}
        try { scrollTarget.style.overflow = ''; } catch (e) {}
        doc.style.paddingRight = originalDocPaddingRight || '';
        body.style.paddingRight = originalBodyPaddingRight || '';
        try { scrollTarget.style.paddingRight = originalBodyPaddingRight || ''; } catch (e) {}
        const appRoot = document.getElementById('root') || document.getElementById('app') || document.querySelector('[data-root]') || document.querySelector('.App');
        if (appRoot) {
          try {
            appRoot.classList.remove('chat-open');
            appRoot.style.overflow = '';
            appRoot.style.paddingRight = '';
          } catch (e) { /* ignore */ }
        }
      };
    } catch (e) { /* ignore */ }
  }, [minimized]);

  const portalContainerId = 'fmis-chat-portal';
  useEffect(() => {
    try {
      let c = document.getElementById(portalContainerId);
      if (!c) {
        c = document.createElement('div');
        c.id = portalContainerId;
        c.setAttribute('data-fmis-portal', 'chat');
        document.body.appendChild(c);
      }
    } catch (e) { /* ignore */ }
  }, []);

  const showBackdrop = !minimized && (isSmall || !isPinned) && dimOnOpen;

  if (minimized) {
    return (
      <Fade in timeout={220}>
        <Box sx={{ position: 'fixed', right: 24, bottom: 24, zIndex }} aria-live='polite'>
          <Badge 
            color="error" 
            badgeContent={unread > 0 ? unread : null} 
            overlap="circular"
            sx={{
              '& .MuiBadge-badge': {
                fontWeight: 700,
                fontSize: '10px',
                boxShadow: '0 2px 8px rgba(239, 68, 68, 0.4)',
                bgcolor: '#ef4444',
                right: 4,
                top: 4,
              }
            }}
          >
            <IconButton
              onClick={() => onMinimize?.(false)}
              sx={{ 
                background: 'linear-gradient(135deg, #00b0ff 0%, #007bb5 100%)', 
                color: '#fff', 
                width: 56, 
                height: 56, 
                borderRadius: '16px', // Matching Launcher squircle!
                boxShadow: '0 8px 24px rgba(0, 176, 255, 0.3)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                '&:hover': { 
                  transform: 'scale(1.08) translateY(-2px)', 
                  boxShadow: '0 12px 30px rgba(0, 176, 255, 0.45)',
                  '& .minimized-icon': {
                    transform: 'scale(1.1) rotate(10deg)'
                  }
                } 
              }}
              aria-label="Open chat"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onMinimize?.(false); } }}
            >
              <Box 
                className="minimized-icon" 
                sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  transition: 'transform 0.3s ease' 
                }}
              >
                <FiMessageSquare size={22} />
              </Box>
            </IconButton>
          </Badge>
        </Box>
      </Fade>
    );
  }

  const inner = (
    <Fade in timeout={260}>
      <Box 
        ref={rootRef} 
        tabIndex={-1} 
        onKeyDown={(e) => { if (e.key === 'Escape') onClose?.(); }} 
        sx={isSmall ? mobileStyle : desktopStyle} 
        role="dialog" 
        aria-modal={isSmall ? 'true' : 'false'}
      >
        {/* Sleek, glassmorphic top header bar */}
        <Box 
          sx={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            px: 2.5, 
            py: 1.8, 
            bgcolor: 'rgba(255, 255, 255, 0.03)', 
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            backdropFilter: 'blur(10px)',
            flexShrink: 0
          }}
        >
          <Box 
            sx={{ 
              fontWeight: 800, 
              fontSize: '15px', 
              color: '#fff', 
              display: 'flex', 
              alignItems: 'center', 
              gap: 1,
              letterSpacing: '-0.3px',
            }}
          >
            <FiMessageSquare size={18} style={{ color: '#00b0ff', filter: 'drop-shadow(0 2px 4px rgba(0, 176, 255, 0.4))' }} />
            Chat Messages
          </Box>
          <Box sx={{ display: 'flex', gap: 0.75 }}>
            <Tooltip title="Minimize window" placement="top">
              <IconButton 
                size="small" 
                onClick={() => onMinimize?.(true)} 
                sx={{ 
                  bgcolor: 'rgba(255, 255, 255, 0.05)', 
                  color: 'rgba(255, 255, 255, 0.7)', 
                  borderRadius: '8px', 
                  width: 30, 
                  height: 30, 
                  '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.12)', color: '#fff' }, 
                  transition: 'all 0.2s' 
                }} 
                aria-label="Minimize chat"
              >
                <FiMinus size={16} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Close window" placement="top">
              <IconButton 
                size="small" 
                onClick={onClose} 
                sx={{ 
                  bgcolor: 'rgba(239, 68, 68, 0.1)', 
                  color: '#ff6b6b', 
                  borderRadius: '8px', 
                  width: 30, 
                  height: 30, 
                  '&:hover': { bgcolor: 'rgba(239, 68, 68, 0.2)', color: '#ff8787' }, 
                  transition: 'all 0.2s' 
                }} 
                aria-label="Close chat"
              >
                <FiX size={16} />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Content Area */}
        <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {children}
        </Box>
      </Box>
    </Fade>
  );

  try {
    const container = document.getElementById(portalContainerId) || document.body;
    const portalContent = showBackdrop ? (
      <>
        <Box data-fmis-backdrop='true' aria-hidden='true' sx={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.54)', zIndex: Math.max(zIndex, 99998) }} onClick={() => onMinimize?.(true)} />
        {inner}
      </>
    ) : inner;
    return ReactDOM.createPortal(portalContent, container);
  } catch (e) {
    return inner;
  }
};

export default FixedChatWindow;

