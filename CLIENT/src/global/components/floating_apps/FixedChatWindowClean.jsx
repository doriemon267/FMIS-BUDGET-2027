import React, { useEffect, useState } from 'react';
import { Box, IconButton, Badge, useMediaQuery, useTheme } from '@mui/material';
import { FiX, FiMinus, FiMessageSquare } from 'react-icons/fi';

const FixedChatWindowClean = ({ children, onClose, onMinimize, minimized = false, zIndex = 1400 }) => {
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

  const desktopStyle = {
    position: 'fixed',
    left: '50%',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    zIndex: zIndex + 1,
    width: 700,
    height: 700,
    maxWidth: 'calc(100vw - 40px)',
    maxHeight: 'calc(100vh - 40px)',
    borderRadius: 16,
    overflow: 'hidden',
    boxShadow: '0 24px 48px rgba(0,0,0,0.35)',
    background: 'var(--mui-palette-background-paper, #fff)'
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
    borderRadius: 0,
    overflow: 'hidden',
    background: 'var(--mui-palette-background-paper, #fff)'
  };

  if (minimized) {
    return (
      <Box sx={{ position: 'fixed', right: 20, bottom: 20, zIndex }}>
        <Badge color="error" badgeContent={unread > 0 ? unread : null} overlap="circular">
          <IconButton
            onClick={() => onMinimize?.(false)}
            sx={{ bgcolor: 'primary.main', color: '#fff', width: 56, height: 56, '&:hover': { transform: 'translateY(-2px)' } }}
            aria-label="Open chat"
          >
            <FiMessageSquare />
          </IconButton>
        </Badge>
      </Box>
    );
  }

  return (
    <Box sx={isSmall ? mobileStyle : desktopStyle} role="dialog" aria-modal={isSmall ? 'true' : 'false'}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1, bgcolor: 'transparent' }}>
        <Box sx={{ ml: 1, fontWeight: 600 }}>Chat</Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <IconButton size="small" onClick={() => onMinimize?.(true)} sx={{ bgcolor: 'rgba(0,0,0,0.54)', color: '#fff' }} aria-label="Minimize chat"><FiMinus /></IconButton>
          <IconButton size="small" onClick={onClose} sx={{ bgcolor: 'rgba(0,0,0,0.54)', color: '#fff' }} aria-label="Close chat"><FiX /></IconButton>
        </Box>
      </Box>

      <Box sx={{ flex: 1, overflow: 'hidden', height: '100%' }}>{children}</Box>
    </Box>
  );
};

export default FixedChatWindowClean;
