import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { Box, IconButton, Badge, useMediaQuery, useTheme, Fade } from '@mui/material';
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
    right: 20,
    bottom: 20,
    zIndex: Math.max(zIndex + 1, 99999),
    width: 700,
    height: 700,
    maxWidth: 'calc(100vw - 40px)',
    maxHeight: 'calc(100vh - 40px)',
    borderRadius: 16,
    overflow: 'hidden',
    boxShadow: '0 24px 48px rgba(0,0,0,0.35)',
    background: 'var(--mui-palette-background-paper, #fff)',
    transition: 'transform 220ms ease, right 220ms ease, bottom 220ms ease',
  } : {
    position: 'fixed',
    left: '50%',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    zIndex: zIndex + 1,
    width: 700,
    height: 700,
    maxWidth: 'calc(100vw - 40px)',
    maxHeight: 'calc(100vh - 40px)',
    // Slightly reduced corner radius so layout is less "extremely rounded" while still being soft
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
    // Keep full screen on mobile but soften the corners a bit when not full width
    borderRadius: 6,
    overflow: 'hidden',
    background: 'var(--mui-palette-background-paper, #fff)'
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
      // Helper: try to find a scrollable container we can lock to avoid double/inner scrollbars
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
        // Do not add a 'chat-open' class to node; only set inline styles to avoid unexpected CSS dimming
        if (scrollBarWidth > 0) {
          doc.style.paddingRight = `${scrollBarWidth}px`;
          body.style.paddingRight = `${scrollBarWidth}px`;
          try { scrollTarget.style.paddingRight = `${scrollBarWidth}px`; } catch (e) {}
        }
        // Also try to lock overflow on app root containers if present (React root or app container)
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
          // If pinned, ensure we hide external modal backdrops that could dim the page
          if (isPinned) {
            try { document.body.classList.add('chat-pinned-no-dim'); } catch (e) {}
            try { document.documentElement.classList.add('chat-pinned-no-dim'); } catch (e) {}
            // Also add class to app root(s) in case overlays are scoped to root instead of body
            try {
              const appRoot = document.getElementById('root') || document.getElementById('app') || document.querySelector('[data-root]') || document.querySelector('.App');
              if (appRoot) {
                try { appRoot.classList.add('chat-pinned-no-dim'); } catch (e) {}
              }
            } catch (e) {}
          }
          try { console.debug('[FixedChatWindow] Applied chat-pinned-no-dim on body'); } catch (e) {}
        try { scrollTarget.style.overflow = 'hidden'; } catch (e) {}
        // NOTE: Runtime overlay hiding disabled (was causing page dimming). 
        // CSS .chat-pinned-no-dim pseudo-element neutralization used instead for safety.
        // If pinned we will also defensively hide any full-screen dark overlays or backdrops
        if (false && isPinned) {
          try {
            const hideCandidates = [];
            const children = Array.from(document.body.children || []);
            for (const el of children) {
              // Skip our portal container (so we don't hide the chat itself)
              if (el.id === portalContainerId) continue;
            }
            // scan a subset of elements likely to be overlays: body children, siblings of portal container and modal/backdrop classes
            const candidates = Array.from(document.querySelectorAll('body > *'))
              .concat(Array.from(document.querySelectorAll('.MuiBackdrop-root, [data-backdrop], .fullscreen-overlay, .modal-backdrop, .dialog-backdrop')));
            const uniq = [...new Set(candidates.filter(Boolean))];
            const viewportW = window.innerWidth;
            const viewportH = window.innerHeight;
                for (const node of uniq) {
              try {
                if (!node || !node.getBoundingClientRect) continue;
                // do not hide chat portal or portal container
                if (node.closest(`#${portalContainerId}`) || node === document.getElementById(portalContainerId)) continue;
                const rect = node.getBoundingClientRect();
                const coversWidth = rect.width >= viewportW * 0.9;
                const coversHeight = rect.height >= viewportH * 0.9;
                const pos = getComputedStyle(node).position;
                const visible = !(node.offsetParent === null || getComputedStyle(node).display === 'none');
                const bg = getComputedStyle(node).backgroundColor || '';
                const isDarkBg = /rgba?\(/.test(bg) && (bg.includes('0, 0, 0') || bg.includes('rgb(0, 0, 0)') || bg.includes('0,0,0')) || bg.includes('black');
                // If element has backing blur/filter or non-transparent opacity, consider overlay behavior
                const filt = getComputedStyle(node).backdropFilter || getComputedStyle(node).filter || '';
                const opacityVal = parseFloat(getComputedStyle(node).opacity || '1');
                const hasFilter = /blur|brightness|contrast|opacity|grayscale/i.test(String(filt));
                // More targeted overlay detection: prefer known overlay classes/attributes or role=presentation
                const matchesOverlayClass = (node.className && /MuiBackdrop-root|backdrop|modal-backdrop|dialog-backdrop|fullscreen-overlay/i.test(node.className));
                const hasBackdropAttr = node.hasAttribute && node.hasAttribute('data-backdrop');
                const isPresentationRole = node.getAttribute && String(node.getAttribute('role')).toLowerCase() === 'presentation';
                const ariaHidden = node.getAttribute && node.getAttribute('aria-hidden') === 'true';
                // Consider an element an overlay/backdrop only if it matches known overlay classes/attributes
                // OR if it is role=presentation/aria-hidden AND has a dark background (likely a backdrop)
                const overlayCandidate = matchesOverlayClass || hasBackdropAttr || ((isPresentationRole || ariaHidden) && isDarkBg);
                // Skip nodes that are the main app root or contain it — don't hide app content
                const appRoot = document.getElementById('root') || document.getElementById('app') || document.querySelector('[data-root]') || document.querySelector('.App');
                if (appRoot && (node === appRoot || node.contains(appRoot) || appRoot.contains(node))) {
                  try { console.debug('[FixedChatWindow] Skipping appRoot node from overlay hide:', { tag: node.tagName, classes: node.className }); } catch (e) {}
                  continue;
                }
                // Skip portal-like UI elements for menus/popovers/tooltips
                const isPortalUI = node.className && /MuiPopover-root|MuiModal-root|MuiMenu-list|MuiPopper|MuiTooltip/i.test(node.className);
                if (isPortalUI) {
                  try { console.debug('[FixedChatWindow] Skipping portal UI element from overlay hide:', { tag: node.tagName, classes: node.className }); } catch (e) {}
                  continue;
                }
                // allow overlayCandidate OR if broad heuristics detect a dark/translucent full-screen element
                const broadOverlay = (coversWidth && coversHeight && visible && (pos === 'fixed' || pos === 'absolute') && (isDarkBg || (hasFilter && opacityVal < 0.85)));
                if (overlayCandidate && (coversWidth && coversHeight) && visible && (pos === 'fixed' || pos === 'absolute' || isDarkBg) || broadOverlay) {
                  // store original styles and hide
                  hideCandidates.push({ node, original: { display: node.style.display, visibility: node.style.visibility, pointerEvents: node.style.pointerEvents } });
                  node.style.display = 'none';
                }
              } catch (e) { /* ignore individual nodes */ }
            }
            // store the list on window to restore later (weak map would be ideal but keep simple)
            try { window.__fmis_hidden_backdrops = hideCandidates; } catch (e) {}
            try { console.debug('[FixedChatWindow] hideCandidates:', hideCandidates.map(h => ({tag: h.node.tagName, classes: h.node.className, html: (h.node.outerHTML||'').slice(0,200)}))); } catch (e) {}
              // Also observe mutations so we can hide overlays added dynamically while chat is open
              try {
                const obsCallback = (mutations) => {
                  for (const m of mutations) {
                    for (const n of (m.addedNodes || [])) {
                      try {
                        if (n && n.nodeType === Node.ELEMENT_NODE) {
                          const node = n;
                          // ignore portal container
                          if (node.id === portalContainerId || node.closest(`#${portalContainerId}`)) continue;
                          const rect = node.getBoundingClientRect ? node.getBoundingClientRect() : { width: 0, height: 0 };
                          const coversWidth = rect.width >= viewportW * 0.9;
                          const coversHeight = rect.height >= viewportH * 0.9;
                          const pos = getComputedStyle(node).position;
                          const bg = getComputedStyle(node).backgroundColor || '';
                          const isDarkBg = /rgba?\(/.test(bg) && (bg.includes('0, 0, 0') || bg.includes('rgb(0, 0, 0)') || bg.includes('0,0,0')) || bg.includes('black');
                          const filt = getComputedStyle(node).backdropFilter || getComputedStyle(node).filter || '';
                          const opacityVal = parseFloat(getComputedStyle(node).opacity || '1');
                          const hasFilter = /blur|brightness|contrast|opacity|grayscale/i.test(String(filt));
                          const matchesOverlayClass = (node.className && /MuiBackdrop-root|backdrop|modal-backdrop|dialog-backdrop|fullscreen-overlay/i.test(node.className));
                          const hasBackdropAttr = node.hasAttribute && node.hasAttribute('data-backdrop');
                          const isPresentationRole = node.getAttribute && String(node.getAttribute('role')).toLowerCase() === 'presentation';
                          const ariaHidden = node.getAttribute && node.getAttribute('aria-hidden') === 'true';
                          const overlayCandidate = matchesOverlayClass || hasBackdropAttr || ((isPresentationRole || ariaHidden) && isDarkBg);
                          const isPortalUI = node.className && /MuiPopover-root|MuiModal-root|MuiMenu-list|MuiPopper|MuiTooltip/i.test(node.className);
                          if (isPortalUI) {
                            try { console.debug('[FixedChatWindow] MutationObserver skip portal UI element:', { tag: node.tagName, classes: node.className }); } catch(e) {}
                            continue;
                          }
                          const broadOverlay = (coversWidth && coversHeight && (pos === 'fixed' || pos === 'absolute') && (isDarkBg || (hasFilter && opacityVal < 0.85)));
                          if (overlayCandidate && (coversWidth && coversHeight) && (pos === 'fixed' || pos === 'absolute' || isDarkBg) || broadOverlay) {
                            hideCandidates.push({ node, original: { display: node.style.display, visibility: node.style.visibility, pointerEvents: node.style.pointerEvents } });
                            try { node.style.display = 'none'; } catch (e) {}
                            try { console.debug('[FixedChatWindow] MutationObserver hid overlay:', { tag: node.tagName, classes: node.className, html: (node.outerHTML||'').slice(0,200) }); } catch(e) {}
                          }
                        }
                      } catch (e) { }
                    }
                  }
                  try { window.__fmis_hidden_backdrops = hideCandidates; } catch (e) {}
                  try { console.debug('[FixedChatWindow] MutationObserver end new hideCandidates count=', hideCandidates.length); } catch (e) {}
                };
                const observer = new MutationObserver(obsCallback);
                observer.observe(document.body, { childList: true, subtree: true });
                // store observer for cleanup
                try { window.__fmis_backdrop_observer = observer; } catch (e) {}
              } catch (e) {}
          } catch (e) {}
          try {
            // Inject a small CSS override to neutralize pseudo-element overlays applied to html/body
            const styleId = 'fmis-neutralize-overlays';
            if (!document.getElementById(styleId)) {
              const s = document.createElement('style');
              s.id = styleId;
              s.innerHTML = `
                html.chat-pinned-no-dim::before, html.chat-pinned-no-dim::after,
                body.chat-pinned-no-dim::before, body.chat-pinned-no-dim::after,
                .chat-pinned-no-dim *::before, .chat-pinned-no-dim *::after {
                  background: transparent !important;
                  opacity: 1 !important;
                  pointer-events: none !important;
                  filter: none !important;
                }
              `;
              document.head.appendChild(s);
            }
          } catch (e) { /* ignore */ }
        }
      }
      return () => {
        // Do not remove 'chat-open' class since we never add it above
        doc.style.overflow = originalDocOverflow || '';
        body.style.overflow = originalBodyOverflow || '';
        // Remove chat-pinned-no-dim guard for pinned-state overlays
          try { document.body.classList.remove('chat-pinned-no-dim'); } catch (e) {}
          try { document.documentElement.classList.remove('chat-pinned-no-dim'); } catch (e) {}
        try { console.debug('[FixedChatWindow] Removed chat-pinned-no-dim from body'); } catch (e) {}
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
        // Cleanup: restore any hidden backdrops and observers
        // NOTE: runtime overlay hiding was disabled; no hidden backdrops to restore
        // Only restore scroll and styles set above
        try {
          const list = window.__fmis_hidden_backdrops || [];
          for (const item of list) {
            try { item.node.style.display = item.original.display || ''; item.node.style.visibility = item.original.visibility || ''; item.node.style.pointerEvents = item.original.pointerEvents || ''; } catch (e) {}
          }
          try { window.__fmis_hidden_backdrops = null; } catch (e) {}
        } catch (e) { /* ignore */ }
        // Disconnect the mutation observer if we created one
        try { const ob = window.__fmis_backdrop_observer; if (ob && typeof ob.disconnect === 'function') { ob.disconnect(); window.__fmis_backdrop_observer = null; } } catch (e) {}
        // Remove any injected style that neutralizes pseudo element overlays
        try { const styleId = 'fmis-neutralize-overlays'; const s = document.getElementById(styleId); if (s) s.remove(); } catch (e) {}
      };
    } catch (e) { /* ignore */ }
  }, [minimized]);

  if (minimized) {
    return (
      <Fade in timeout={220}>
      <Box sx={{ position: 'fixed', right: 20, bottom: 20, zIndex }} aria-live='polite'>
        <Badge color="error" badgeContent={unread > 0 ? unread : null} overlap="circular">
          <IconButton
            onClick={() => onMinimize?.(false)}
            sx={{ bgcolor: 'primary.main', color: '#fff', width: 48, height: 48, borderRadius: '50%', '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 6px 12px rgba(0,0,0,0.18)' } }}
            aria-label="Open chat"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onMinimize?.(false); } }}
          >
            <FiMessageSquare />
          </IconButton>
        </Badge>
      </Box>
      </Fade>
    );
  }
  const portalContainerId = 'fmis-chat-portal';
  // ensure portal container exists
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
  // Debug log: show states for troubleshooting dim issues
  useEffect(() => {
    try {
      console.debug('[FixedChatWindow] render: isSmall=', isSmall, 'isPinned=', isPinned, 'minimized=', minimized, 'showBackdrop=', showBackdrop);
    } catch (e) {}
  }, [isSmall, isPinned, minimized, showBackdrop]);

  const inner = (
    <Fade in timeout={260}>
    <Box ref={rootRef} tabIndex={-1} onKeyDown={(e) => { if (e.key === 'Escape') onClose?.(); }} sx={isSmall ? mobileStyle : desktopStyle} role="dialog" aria-modal={isSmall ? 'true' : 'false'}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1.5, bgcolor: '#0b5394', borderBottom: '2px solid #0099cc', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
        <Box sx={{ ml: 1, fontWeight: 700, fontSize: '1rem', color: '#fff', display: 'flex', alignItems: 'center', gap: 0.5 }}>💬 Chat</Box>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <IconButton size="small" onClick={() => onMinimize?.(true)} sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: '#fff', borderRadius: '4px', width: 32, height: 32, '&:hover': { bgcolor: 'rgba(255,255,255,0.35)', transform: 'scale(1.05)' }, transition: 'all 0.15s' }} aria-label="Minimize chat" title="Minimize"><FiMinus size={18} /></IconButton>
          <IconButton size="small" onClick={onClose} sx={{ bgcolor: 'rgba(255,100,100,0.3)', color: '#ff6b6b', borderRadius: '4px', width: 32, height: 32, '&:hover': { bgcolor: 'rgba(255,100,100,0.5)', transform: 'scale(1.05)' }, transition: 'all 0.15s' }} aria-label="Close chat" title="Close"><FiX size={18} /></IconButton>
        </Box>
      </Box>

      <Box sx={{ flex: 1, overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column' }}>{children}</Box>
    </Box>
    </Fade>
  );
  try {
    const container = document.getElementById(portalContainerId) || document.body;
    // If chat will render with a modal-style backdrop (mobile/fullscreen or not pinned), render the backdrop
    const portalContent = showBackdrop ? (
      <>
        <Box data-fmis-backdrop='true' aria-hidden='true' sx={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.54)', zIndex: Math.max(zIndex, 99998) }} onClick={() => onMinimize?.(true)} />
        {inner}
      </>
    ) : inner;
    return ReactDOM.createPortal(portalContent, container);
  } catch (e) {
    // If portal not available (rare / test env), fallback to inline render
    return inner;
  }
};

export default FixedChatWindow;
