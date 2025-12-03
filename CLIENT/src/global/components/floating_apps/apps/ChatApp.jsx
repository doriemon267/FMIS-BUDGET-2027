// src/components/apps/ChatApp.jsx
import { useState, useRef, useEffect } from "react";
import { isTokenExpired } from '../../../../utils/jwt';
import { idMatches as helperIdMatches, getOnlineMapMatchKey as helperGetOnlineMapMatchKey, isOnlineForItem as helperIsOnlineForItem } from '../../../utils/chatHelpers';
import { dispatchChatUnread } from '../../../../utils/eventDispatcher';
import {
  Box,
  IconButton,
  Button,
  Typography,
  Avatar,
  List,
  ListItem,
  Badge,
  InputBase,
  ListItemButton,
  Menu,
  MenuItem,
  Switch,
  FormControlLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  Drawer,
  useMediaQuery
} from "@mui/material";
import { useTheme } from '@mui/material/styles';
import { IoSend } from "react-icons/io5";
import { FiSearch, FiRefreshCw, FiSettings, FiCheck, FiBell, FiBellOff, FiChevronLeft, FiChevronRight, FiMapPin, FiTrash2, FiX } from "react-icons/fi";
import io from 'socket.io-client';
import api from '../../../../config/api';
import env from '../../../../utils/env';
import { useUser } from '../../../../context/UserContext';
import CryptoJS from 'crypto-js';
import toast from 'react-hot-toast';

// Placeholder demo data removed to avoid showing test users in production
const DEFAULT_CONVERSATIONS = [];

const initialMessages = [];

export default function ChatApp() {
  const [conversations, setConversations] = useState(DEFAULT_CONVERSATIONS);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState(initialMessages);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [totalPages, setTotalPages] = useState(1);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef(null);
  const [socket, setSocket] = useState(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [socketErrorMsg, setSocketErrorMsg] = useState(null);
  const [socketTrigger, setSocketTrigger] = useState(0);
  const [serverOffline, setServerOffline] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const { currentUser } = useUser();
  const [chatSettings, setChatSettings] = useState({ sound: true, desktop: true, badge: true, compact: false, hideSidebar: false, leftAlignMessages: true, pinned: true, dimOnOpen: false, autoOpen: true, autoOpenPriority: false, autoOpenMentionsOnly: false, autoOpenDND: false, dndStart: '22:00', dndEnd: '08:00', autoScrollToNew: true, toastOnMobile: false, cooldownMs: 30000 });
  const [chatMutedMap, setChatMutedMap] = useState({});
  const [settingsAnchor, setSettingsAnchor] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [lastAutoOpenTime, setLastAutoOpenTime] = useState({});
  const [pageHidden, setPageHidden] = useState(false);
  const [lastWindowCloseTime, setLastWindowCloseTime] = useState(null);
  const theme = useTheme();
  const isSmall = useMediaQuery(theme.breakpoints.down('sm'));
  const [soundFile, setSoundFile] = useState(localStorage.getItem('chatSoundFile') || '/sounds/chat-notify.mp3');
  const audioRef = useRef(null);
  // Reference to the composer input (textarea) so we can insert emoji at the cursor
  const inputRef = useRef(null);
  const emojiBtnRef = useRef(null);
  const [emojiAnchor, setEmojiAnchor] = useState(null);
  const isComposingRef = useRef(false);
  const [msgContextMenu, setMsgContextMenu] = useState(null);
  const [convContextMenu, setConvContextMenu] = useState(null);
  const [convDeleteAnchor, setConvDeleteAnchor] = useState(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Check if clicking on a delete button (FiTrash2 icon or its parent IconButton)
      const isDeleteButton = event.target.closest('[title="Delete options"]');
      
      if (isDeleteButton) {
        // Let the button's onClick handle it
        return;
      }

      // Check if clicking inside the menu
      const menuElement = document.querySelector('.MuiMenu-paper.chat-delete-menu, .MuiPopover-paper');
      if (menuElement && menuElement.contains(event.target)) {
        // Clicking inside menu, don't close
        return;
      }

      // Close conversation menu if clicking outside
      if (convContextMenu) {
        setConvContextMenu(null);
        setConvDeleteAnchor(null);
      }

      // Close message menu if clicking outside
      if (msgContextMenu) {
        setMsgContextMenu(null);
      }
    };

    if (convContextMenu || msgContextMenu) {
      // Use capture phase to handle before other handlers
      document.addEventListener('mousedown', handleClickOutside, true);
      return () => document.removeEventListener('mousedown', handleClickOutside, true);
    }
  }, [convContextMenu, msgContextMenu]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Delete conversation
  const handleDeleteConversation = async (peerId, deleteForEveryone = false) => {
    if (!peerId) return;
    try {
      await api.delete(`/api/chat/conversations/${peerId}`, {
        data: { deleteForEveryone }
      });
      toast.success(deleteForEveryone ? 'Conversation deleted for everyone' : 'Conversation deleted for you');
      // Remove from conversations list
      updateConversations((prev) => prev.filter((c) => c.id !== peerId));
      // If the deleted conversation was selected, clear selection
      if (selected?.id === peerId) {
        setSelected(null);
        setMessages([]);
      }
      // Reload conversations to ensure sync
      await loadConversations();
      setConvContextMenu(null);
    } catch (e) {
      console.error('Delete conversation failed', e);
      toast.error('Failed to delete conversation');
    }
  };

  // Delete message
  const handleDeleteMessage = async (messageId, deleteForEveryone = false) => {
    if (!messageId) return;
    try {
      await api.delete(`/api/chat/messages/${messageId}`, {
        data: { deleteForEveryone }
      });
      toast.success(deleteForEveryone ? 'Message deleted for everyone' : 'Message deleted for you');
      // Remove message from UI
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      setMsgContextMenu(null);
      // If no more messages, reload conversations
      if (messages.length <= 1 && selected?.id) {
        await loadConversations();
      }
    } catch (e) {
      console.error('Delete message failed', e);
      toast.error('Failed to delete message');
    }
  };

  // Helper to compute a friendly avatar initial for a message/sender
  const getAvatarInitial = (fromName, fromId) => {
    try {
      if (fromName && typeof fromName === 'string') {
        const n = fromName.trim();
        if (n) {
          // Prefer letter initial; skip digits
          const letter = n.match(/[A-Za-z]/);
          if (letter && letter[0]) return letter[0].toUpperCase();
          // fallback to alphanumeric initial if no letters
          const matches = n.match(/[A-Za-z0-9]/);
          if (matches && /[A-Za-z]/.test(matches[0])) return matches[0].toUpperCase();
        }
      }
      if (fromId && typeof fromId === 'string') {
        // Prefer name if id contains letters, otherwise fallback to conversation name
        if (/[A-Za-z]/.test(fromId)) return fromId.trim()[0].toUpperCase();
        // If id is numeric (e.g., '4'), try to resolve name from conversations/availableContacts
        const conv = (conversations || []).find(c => String(c.id) === String(fromId));
        if (conv && conv.name) return (conv.name || '').trim()[0].toUpperCase();
      }
    } catch (e) { /* fallback to 'U' below */ }
    return 'U';
  };
  // Deterministic avatar color from id/name
  const avatarColor = (nameOrId) => {
    const colors = ['#00b0ff', '#4c9ee6', '#7b61ff', '#00b894', '#ff7a59', '#ffb86b', '#6a9e7f', '#ff5c8a'];
    const key = String(nameOrId || 'U');
    let h = 0;
    for (let i = 0; i < key.length; i++) { h = key.charCodeAt(i) + ((h << 5) - h); }
    const idx = Math.abs(h) % colors.length;
    return colors[idx];
  };
  // Local aliasing so we can keep code readable
  const idMatches = helperIdMatches;
  const getOnlineMapMatchKey = helperGetOnlineMapMatchKey;
  const isOnlineForItem = helperIsOnlineForItem;
  // Contact search state
  const [searchQuery, setSearchQuery] = useState('');
  const [contactResults, setContactResults] = useState([]);
  const [availableContacts, setAvailableContacts] = useState([]);
  const doContactSearch = async () => {
    try {
      if (!searchQuery.trim()) return setContactResults([]);
      const res = await api.get(`/api/chat/contacts?q=${encodeURIComponent(searchQuery.trim())}`);
      if (res?.data?.contacts) {
        const contacts = res.data.contacts;
        // fetch presence for these contacts
        try {
          const ids = contacts.map(c => c.id).join(',');
            if (ids) {
            const pres = await api.get(`/api/chat/presence?ids=${encodeURIComponent(ids)}`);
            const onlineMap = pres?.data?.online || {};
            setContactResults(contacts.map(c => ({ ...c, id: String(c.id), online: isOnlineForItem(c, onlineMap) })));
          } else {
            setContactResults(contacts);
          }
        } catch (e) {
          setContactResults(contacts);
        }
      }
    } catch (e) {
      console.error('Contact search failed', e);
    }
  };

  useEffect(scrollToBottom, [messages]);

  // Load persisted chat settings from localStorage
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem('chatSettings') || '{}');
      const initial = { sound: s.sound !== false, desktop: s.desktop !== false, badge: s.badge !== false, compact: s.compact === true, hideSidebar: !!s.hideSidebar, leftAlignMessages: s.leftAlignMessages !== false, pinned: s.pinned !== false, dimOnOpen: s.dimOnOpen === true, autoOpen: s.autoOpen !== false, autoOpenPriority: s.autoOpenPriority === true, autoOpenMentionsOnly: s.autoOpenMentionsOnly === true, autoOpenDND: s.autoOpenDND === true, dndStart: s.dndStart || '22:00', dndEnd: s.dndEnd || '08:00', autoScrollToNew: s.autoScrollToNew !== false, toastOnMobile: s.toastOnMobile === true, cooldownMs: s.cooldownMs || 30000 };
      // On small screens default to hide conversations sidebar unless user explicitly set it
      if (isSmall && s.hideSidebar === undefined) initial.hideSidebar = true;
      setChatSettings(initial);
    } catch (e) {
      // ignore, use defaults
    }
    try {
      const m = JSON.parse(localStorage.getItem('chatMuted') || '{}');
      setChatMutedMap(m || {});
    } catch (e) { }
    // load persisted sound selection
    try { setSoundFile(localStorage.getItem('chatSoundFile') || '/sounds/chat-notify.mp3'); } catch (e) {}
  }, []);

  // Detect page visibility changes for focus detection
  useEffect(() => {
    const handleVisibilityChange = () => {
      setPageHidden(document.hidden);
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Listen for changes to chatSettings from other contexts (AppTray, other tabs)
  useEffect(() => {
    const handler = (e) => {
      try {
        if (e && e.key === 'chatSettings') {
          const s = JSON.parse(e.newValue || '{}');
          setChatSettings({ sound: s.sound !== false, desktop: s.desktop !== false, badge: s.badge !== false, compact: s.compact === true, hideSidebar: !!s.hideSidebar });
        }
      } catch (err) {}
    };
    const customHandler = (ev) => {
      try {
        const s = ev?.detail || JSON.parse(localStorage.getItem('chatSettings') || '{}');
        setChatSettings({ sound: s.sound !== false, desktop: s.desktop !== false, badge: s.badge !== false, compact: s.compact === true, hideSidebar: !!s.hideSidebar, dimOnOpen: s.dimOnOpen === true, autoOpen: s.autoOpen !== false, autoOpenPriority: s.autoOpenPriority === true, autoOpenMentionsOnly: s.autoOpenMentionsOnly === true, autoOpenDND: s.autoOpenDND === true, dndStart: s.dndStart || '22:00', dndEnd: s.dndEnd || '08:00', autoScrollToNew: s.autoScrollToNew !== false, toastOnMobile: s.toastOnMobile === true, cooldownMs: s.cooldownMs || 30000 });
      } catch (err) {}
    };
    window.addEventListener('storage', handler);
    window.addEventListener('chat-settings-changed', customHandler);
    return () => { window.removeEventListener('storage', handler); window.removeEventListener('chat-settings-changed', customHandler); };
  }, []);

  // Helper: Check if current time is in DND (Do Not Disturb) hours
  const isInDNDHours = (dndStart, dndEnd) => {
    const now = new Date();
    const [startH, startM] = dndStart.split(':').map(Number);
    const [endH, endM] = dndEnd.split(':').map(Number);
    const currentTime = now.getHours() * 60 + now.getMinutes();
    const startTime = startH * 60 + startM;
    const endTime = endH * 60 + endM;
    
    if (startTime < endTime) {
      return currentTime >= startTime && currentTime < endTime;
    } else {
      return currentTime >= startTime || currentTime < endTime;
    }
  };

  // Helper: Check if message contains @mention to current user
  const hasMention = (text, userName) => {
    if (!text || !userName) return false;
    const nameToCheck = Array.isArray(userName) ? userName[0] : userName;
    return new RegExp(`@${nameToCheck}|@everyone`, 'i').test(text);
  };

  // Helper: Check if cooldown has passed for auto-open
  const shouldAutoOpen = (peerId, cooldownMs) => {
    const lastOpen = lastAutoOpenTime[peerId] || 0;
    const now = Date.now();
    return (now - lastOpen) > cooldownMs;
  };

  // Helper: Update cooldown tracking
  const recordAutoOpen = (peerId) => {
    setLastAutoOpenTime(prev => ({ ...prev, [peerId]: Date.now() }));
  };

  // Helper to play a notification sound with graceful fallback
  const playNotificationSound = async () => {
    try {
      const audio = audioRef.current;
      if (audio) {
        try {
          // quick HEAD check to avoid unsupported caching behavior on some proxies/servers
          try {
            await fetch(audio.src || soundFile, { method: 'HEAD', cache: 'no-store', mode: 'same-origin' });
          } catch (e) {
            // HEAD failed, log and fallback
            console.warn('[ChatApp] audio HEAD check failed, allowing play and catching runtime errors', e?.message || e);
          }
          await audio.play();
          return;
        } catch (playErr) {
          console.warn('[ChatApp] audio play failed; falling back to oscillator', playErr);
        }
      }
    } catch (err) {
      console.warn('[ChatApp] playNotificationSound error', err);
    }
    // Fallback: oscillator beep
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = 880;
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      setTimeout(() => { try { o.stop(); ctx.close(); } catch (_) {} }, 140);
    } catch (e) { /* ignore fallback errors */ }
  };

  // Initialize audioRef whenever soundFile changes
  useEffect(() => {
    // Lazy-load audio resource only when playing is attempted. Keep a lightweight audio object when "Test" is clicked.
    try {
      if (!soundFile) { audioRef.current = null; return; }
      // Do not force preload; some dev servers/proxies may not support streaming requests.
      const a = new Audio(soundFile);
      a.preload = 'none';
      // Attach error handler to fallback gracefully to oscillator if the audio cannot be fetched/decoded
      const onAudioErr = (ev) => {
        console.warn('[ChatApp] audio load error, will fallback to oscillator', ev);
        try { a.removeEventListener('error', onAudioErr); } catch (_) {}
        try { if (audioRef.current === a) audioRef.current = null; } catch (_) {}
      };
      a.addEventListener('error', onAudioErr);
      audioRef.current = a;
    } catch (e) {
      console.warn('[ChatApp] failed to init audio resource', e);
      audioRef.current = null;
    }
    return () => {
      try { if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ''; audioRef.current = null; } } catch (e) {}
    }
  }, [soundFile]);

  // Persist chat settings helper (also dispatch custom event to inform same-window listeners)
  const persistChatSettings = (nextSettings) => {
    try { setChatSettings(nextSettings); } catch (e) {}
    try { localStorage.setItem('chatSettings', JSON.stringify(nextSettings)); } catch (e) {}
    try { window.dispatchEvent(new CustomEvent('chat-settings-changed', { detail: nextSettings })); } catch (e) {}
  };

  // Handler for toggling settings UI; when pinned, open Drawer as popover may be obscured
  const handleSettingsClick = (e) => {
    try {
      // If chat is pinned or device is small, prefer Drawer for visibility
      const pinned = chatSettings && chatSettings.pinned !== false;
      if (isSmall || pinned) {
        // Toggle Drawer rather than always opening it (so we can close if clicking again)
        setSettingsAnchor(null);
        setDrawerOpen((prev) => !prev);
      } else {
        // Toggle Popover anchor - clicking the icon again should close it
        const anchor = settingsAnchor ? null : (e && e.currentTarget ? e.currentTarget : null);
        setSettingsAnchor(anchor);
        // Also close Drawer if it was open
        if (drawerOpen) setDrawerOpen(false);
      }
    } catch (err) { console.warn('handleSettingsClick failed', err); }
  };

  // Fetch messages helper
  async function fetchMessages(pageToLoad = 1, append = false) {
      try {
        const otherId = selected?.id;
        if (!otherId) return;
        const res = await api.get(`/api/chat/messages/${otherId}?page=${pageToLoad}&limit=${limit}`);
        if (res?.data?.messages) {
          // Map server messages to local UI format
          const mapped = res.data.messages.map((m) => ({
            id: m._id || m.id,
            text: m.text,
            sender: (currentUser && ((currentUser.Id || currentUser.id || currentUser.userId || (Array.isArray(currentUser?.Username) ? currentUser.Username[0] : currentUser?.Username)) === m.from)) ? 'me' : 'them',
            time: new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            read: !!m.read
          , avatarInitial: getAvatarInitial(m.metadata?.fromName, m.from), avatarUrl: m.metadata?.avatarUrl || null, displayName: m.metadata?.fromName || null }));
          if (append) {
            setMessages((prev) => [...mapped, ...prev]); // older messages go before
          } else {
            setMessages(mapped);
          }
          setPage(pageToLoad);
          if (res.data.totalPages) setTotalPages(res.data.totalPages);
        }
      } catch (e) {
        // If unauthorized, indicate login required
        if (e?.response?.status === 401 || e?.response?.status === 403) {
          setAuthRequired(true);
          updateConversations([]);
          return;
        }
        console.warn('[ChatApp] fetchMessages failed for user', selected?.id, e?.response?.status, e?.response?.data || e?.message || e);
        // ignore failures; keep sample messages
        }
        // Ensure authRequired reset when successful
        setAuthRequired(false);
    }
    // Load first page when selected changes
    useEffect(() => {
      fetchMessages(1, false);
    }, [selected, currentUser]);

  const loadMoreMessages = async () => {
    if (!selected) return;
    const nextPage = page + 1;
    if (nextPage > totalPages) return;
    await fetchMessages(nextPage, true);
  };
  // Load conversations (and fetch presence for peers)
  async function loadConversations() {
    try {
      const res = await api.get('/api/chat/conversations');
      // If server returns a DB connection diagnostic, show offline state in UI
      if (res?.data?.dbConnected === false) {
        setServerOffline(true);
        updateConversations([]);
        return;
      } else {
        setServerOffline(false);
      }
      if (!res || res.status >= 400) {
        console.warn('[ChatApp] loadConversations unexpected response:', res?.status, res?.data);
      }
      if (res?.data?.conversations) {
          const convs = res.data.conversations.map((c) => ({
          id: String(c._id || c.id || c.userId || ''),
          name: c.name || c.displayName || c.username || c.id,
            avatar: getAvatarInitial(c.name || c.displayName, c.id),
            avatarUrl: c.avatarUrl || null,
            muted: (chatMutedMap && chatMutedMap[c._id || c.id]) || false,
          lastMsg: c.lastMsg || c.lastMessage || '',
          lastAt: c.lastAt || c.lastMessageAt || c.updatedAt || c.createdAt,
          unread: c.unread || 0,
          online: false,
          }));
        console.debug('[ChatApp] loadConversations: conversations=', convs);
        updateConversations(convs);
        // Ensure we pick a real conversation as selected if none is currently selected
        setSelected((prev) => {
          if (prev && prev.id) return prev;
          if (!convs || convs.length === 0) return null;
          return convs[0];
        });
        // Fetch presence for these peers
        const peers = convs.map(p => ({ id: p.id }));
        const idsParam = peers.map(p => p.id).join(',');
        if (idsParam) {
          try {
            const pres = await api.get(`/api/chat/presence?ids=${encodeURIComponent(idsParam)}`);
            console.debug('[ChatApp] presence API response:', pres?.data);
              if (pres?.data?.online) {
              const onlineMap = pres.data.online;
              updateConversations((prev) => prev.map(c => ({ ...c, online: isOnlineForItem(c, onlineMap) })));
            }
          } catch (e) { console.warn('[ChatApp] presence API call failed', e); }
        }
        // Fetch available contacts to show users you can chat with
        try {
          const contactsRes = await api.get('/api/chat/contacts');
          const contacts = contactsRes?.data?.contacts || [];
          if (contacts.length > 0) {
            const ids = contacts.map(c => String(c.id || c.userId)).join(',');
            const pres = ids ? await api.get(`/api/chat/presence?ids=${encodeURIComponent(ids)}`) : null;
            const onlineMap = pres?.data?.online || {};
            // Filter out contacts that are already in conversations
            const convIds = (convs || []).map(c => String(c.id));
            const filtered = contacts.filter(c => !convIds.includes(String(c.id || c.userId)));
            const enriched = filtered.map(c => ({ ...c, id: String(c.id || c.userId || ''), online: isOnlineForItem(c, onlineMap) }));
            console.debug('[ChatApp] available contacts:', enriched);
            setAvailableContacts(enriched);
          }
        } catch (e) {
          console.warn('[ChatApp] failed to fetch available contacts', e);
          setAvailableContacts([]);
        }
      }
    } catch (e) {
      console.warn('[ChatApp] loadConversations failed', e?.response?.status, e?.response?.data || e?.message || e);
      // If server responded with a status and data indicating the DB isn't connected, set offline
      const body = e?.response?.data;
      if (body && (body.code === 'DB_NOT_CONNECTED' || body?.dbConnected === false || body?.message?.toLowerCase?.().includes('database'))) {
        setServerOffline(true);
        updateConversations([]);
        return;
      }
    }
  }
  useEffect(() => {
    // Helper to get token from localStorage
    const getToken = () => {
      const enc = localStorage.getItem('token');
      if (!enc) return null;
      try { const bytes = CryptoJS.AES.decrypt(enc, env('SECRET_KEY')); return bytes.toString(CryptoJS.enc.Utf8); } catch (e) { return null; }
    };
    let devUid = null;
    try { const cu = JSON.parse(localStorage.getItem('currentUser') || 'null'); if (cu) devUid = (Array.isArray(cu?.Username) ? cu.Username[0] : cu?.Username) || cu?.Id || cu?.id || cu?.userId; } catch(e) { devUid = null; }
    const token = getToken();
    // token already fetched above
    if (!token && !devUid && !currentUser) {
      // No auth info available; skip connecting to avoid connect errors
      console.debug('[ChatApp] no token or devUserId available yet; deferring socket/connect and loadConversations until user data available.');
      return;
    }
    loadConversations();
    const serverUrl = env('SERVER_URL') || env('API_BASE_URL') || 'http://localhost:5005';
    // Additional debug: check for a local dev user id to be sent with socket auth (dev only)
    const currentUserStr = localStorage.getItem('currentUser');
    let devUserId = null;
    if (currentUserStr) {
      try { const cu = JSON.parse(currentUserStr); devUserId = (Array.isArray(cu?.Username) ? cu.Username[0] : cu?.Username) || cu?.Id || cu?.id || cu?.userId; } catch (e) { devUserId = null; }
    }
    // Determine whether to attempt a socket connection. Only connect when we have a valid JWT token or a devUserId (dev mode).
    const authObj = {};
    const validToken = token && !isTokenExpired(token);
    if (validToken) authObj.token = token;
    if (devUserId) authObj.devUserId = String(devUserId);
    // include resolved current user id (if any) to help server logging and routing
    if (currentUser) {
      const cuid = (currentUser?.Id || currentUser?.id || currentUser?.userId || (Array.isArray(currentUser?.Username) ? currentUser.Username[0] : currentUser?.Username));
      if (cuid) authObj.userId = String(cuid);
    }
    // If we have neither a valid token nor a dev user id, or if token exists but currentUser not loaded, do not create the connection.
    if (!authObj.devUserId && (!authObj.token || !currentUser)) {
      console.debug('[ChatApp] Not creating socket: no valid token or dev user id present');
      return;
    }
    const conn = io(serverUrl, { path: '/socket.io', transports: ['polling', 'websocket'], withCredentials: true, auth: authObj, query: (token ? { token } : {}), transportOptions: { polling: { extraHeaders: token ? { Authorization: `Bearer ${token}` } : {} } }, reconnectionAttempts: 3 });
    if (devUserId) console.debug('[ChatApp] Passing devUserId to socket auth (if ALLOW_MOCK_AUTH enabled)');
    conn.on('connect', () => {
      const uid = (currentUser?.Id || currentUser?.id || currentUser?.userId || (Array.isArray(currentUser?.Username) ? currentUser.Username[0] : currentUser?.Username) || null);
      console.debug('[ChatApp] socket connected', conn.id, 'uid=', uid, 'tokenPresent=', !!token);
      setSocketConnected(true);
      setSocketErrorMsg(null);
      setAuthRequired(false);
      if (uid) conn.emit('join-user-room', uid);
    });
    conn.on('chat-message', (payload) => {
      const who = payload.from;
      const isMine = !!(currentUser && ((currentUser?.Id || currentUser?.id || currentUser?.userId || (Array.isArray(currentUser?.Username) ? currentUser.Username[0] : currentUser?.Username)) === who));
      const serverId = payload._id || payload.id;
      const clientId = payload.metadata?.clientId;
      const fromInitial = getAvatarInitial(payload.metadata?.fromName, payload.from);
      const fromAvUrl = payload.metadata?.avatarUrl || null;
      const fromDisplay = payload.metadata?.fromName || null;
      const mapped = { id: serverId || (clientId || `srv-${Date.now()}`), clientId: clientId || null, text: payload.text || payload.message || '', sender: isMine ? 'me' : 'them', time: new Date(payload.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), read: !!payload.read, avatarInitial: fromInitial, avatarUrl: fromAvUrl, displayName: fromDisplay };
      // Play notification sound and show a desktop notification if message is not mine
      if (!isMine) {
        const { sound: soundEnabled, desktop: desktopEnabled, autoOpen, autoOpenPriority, autoOpenMentionsOnly, autoOpenDND, dndStart, dndEnd, autoScrollToNew, cooldownMs } = chatSettings || { sound: true, desktop: true, autoOpen: true };
        const peerId = payload.from;
        const messageText = payload.text || payload.message || '';
        const fromName = payload.metadata?.fromName || payload.from;
        const currentUserId = currentUser?.Id || currentUser?.id || currentUser?.userId || (Array.isArray(currentUser?.Username) ? currentUser.Username[0] : currentUser?.Username);
        
        // Determine if should auto-open based on priority/mention settings
        let shouldAttemptAutoOpen = autoOpen;
        if (autoOpen && autoOpenMentionsOnly) {
          shouldAttemptAutoOpen = hasMention(messageText, currentUser?.Username);
        }
        
        // Check DND hours
        if (shouldAttemptAutoOpen && autoOpenDND && isInDNDHours(dndStart, dndEnd)) {
          shouldAttemptAutoOpen = false;
        }
        
        // Check cooldown
        if (shouldAttemptAutoOpen && !shouldAutoOpen(peerId, cooldownMs)) {
          shouldAttemptAutoOpen = false;
        }
        
        // Check focus (don't auto-open if page is hidden)
        if (shouldAttemptAutoOpen && pageHidden) {
          shouldAttemptAutoOpen = false;
        }
        
        // Auto-open chat window if enabled and all conditions met
        if (shouldAttemptAutoOpen) {
          try {
            window.dispatchEvent(new CustomEvent('open-app', { detail: { appId: 'chat' } }));
            recordAutoOpen(peerId);
          } catch (e) {
            console.debug('[ChatApp] failed to dispatch open-app event', e);
          }
        }
        
        try {
          if (chatMutedMap && chatMutedMap[String(peerId)]) {
            // No desktop or sound notifications for muted conversations
            console.debug('[ChatApp] message for muted conversation', peerId, 'skipping notifications');
          } else {
            if (soundEnabled) {
              try {
                const audio = audioRef.current;
                if (audio) {
                  try {
                    audio.pause();
                    audio.currentTime = 0; // reset
                    // prefer helper that performs a quick HEAD check and fallbacks
                    void playNotificationSound();
                  } catch (playErr) {
                    // fallback to oscillator
                    try {
                      const ctx = new (window.AudioContext || window.webkitAudioContext)();
                      const o = ctx.createOscillator();
                      const g = ctx.createGain();
                      o.type = 'sine';
                      o.frequency.value = 880;
                      o.connect(g);
                      g.connect(ctx.destination);
                      o.start();
                      setTimeout(() => { try { o.stop(); ctx.close(); } catch (_) {} }, 140);
                    } catch (e) { /* ignore fallback errors */ }
                  }
                } else {
                  // No audioRef - fallback to oscillator
                  try {
                    const ctx = new (window.AudioContext || window.webkitAudioContext)();
                    const o = ctx.createOscillator();
                    const g = ctx.createGain();
                    o.type = 'sine';
                    o.frequency.value = 880;
                    o.connect(g);
                    g.connect(ctx.destination);
                    o.start();
                    setTimeout(() => { try { o.stop(); ctx.close(); } catch (_) {} }, 140);
                  } catch (e) { /* ignore fallback errors */ }
                }
              } catch (e) {
                console.warn('[ChatApp] audio play failed', e);
              }
            }
            try {
              const title = payload.metadata?.fromName || payload.from || 'New message';
              const body = (payload.text || payload.message || '').slice(0, 200);
              if (desktopEnabled && typeof Notification !== 'undefined') {
                if (Notification.permission === 'granted') {
                  const n = new Notification(title, { body });
                  n.onclick = () => { window.focus(); setSelected({ id: payload.from, name: payload.metadata?.fromName || payload.from }); };
                } else if (Notification.permission === 'default') {
                  Notification.requestPermission();
                }
              }
            } catch (e) { /* ignore */ }
          }
        } catch(e) {
          console.warn('[ChatApp] notification gating failed', e);
        }
      }

      setMessages((prev) => {
        if (clientId) {
          // Replace optimistic message with clientId
          const idx = prev.findIndex(m => m.clientId === clientId);
          if (idx !== -1) {
            const copy = [...prev]; copy.splice(idx, 1, mapped); return copy;
          }
        }
        // Otherwise append
        const newList = [...prev, mapped];
        // Auto-scroll to new message if enabled
        if (chatSettings?.autoScrollToNew && !isMine) {
          setTimeout(() => scrollToBottom(), 0);
        }
        return newList;
      });
      // If this message is for another conversation, update unread counts
      const activePeerId = selected?.id;
      const shouldIncrease = !isMine && (payload.from !== activePeerId);
      // If this message is from currently selected peer and it's not mine, mark as read
      if (!isMine && payload.from === activePeerId) {
        // Mark as read via API (fire-and-forget)
        try { api.post(`/api/chat/messages/${activePeerId}/read`); } catch (_e) {}
      }
      // Update conversation list: last message/time and unread count; move to top
      updateConversations((prev) => {
        const peerId = isMine ? payload.to : payload.from;
        const peerIdStr = String(peerId);
        const found = prev.findIndex(c => String(c.id) === peerIdStr);
        const updated = prev.map(c => String(c.id) === peerIdStr ? { ...c, lastMsg: payload.text, lastAt: payload.createdAt, unread: (!isMine && String(c.id) === peerIdStr) ? (c.unread || 0) + 1 : (isMine ? c.unread : c.unread) } : c);
        if (found !== -1) {
          const [p] = updated.splice(found,1);
          return [p, ...updated];
        }
        // unknown peer -- add to top
        const newCon = { id: peerId, name: peerId, avatar: getAvatarInitial(null, peerId), avatarUrl: payload.metadata?.avatarUrl || null, muted: (chatMutedMap && chatMutedMap[peerId]) || false, lastMsg: payload.text, lastAt: payload.createdAt, unread: (!isMine ? 1 : 0) };
        return [newCon, ...prev];
      });
    });
    conn.on('connect_error', (err) => {
      const emsg = String(err?.message || err || '');
      setSocketErrorMsg(err?.message || String(err || 'connect_error'));
      // If the server refused the socket because of authentication or invalid/absent user id, show a warning and mark auth required.
      if (emsg.toLowerCase().includes('authentication') || emsg.toLowerCase().includes('cannot determine user id') || emsg.toLowerCase().includes('invalid token') || emsg.toLowerCase().includes('jwt')) {
        console.warn('Chat socket authentication error:', err?.message || err);
        setSocketConnected(false);
        setAuthRequired(true);
        // Stop attempting to reconnect and disconnect
        try { conn.disconnect(); } catch (e) { /* ignore */ }
        try { setSocket(null); } catch (e) { }
        return;
      }
      console.error('Chat socket connect_error:', err?.message || err);
      setSocketConnected(false);
      const msg = String(err?.message || '').toLowerCase();
      // If server explicitly signals auth failure due to missing/determined user id, update UI (auth required) and stop trying to reconnect.
      if (msg.includes('authentication error') || msg.includes('cannot determine user id') || msg.includes('invalid token') || msg.includes('jwt')) {
        console.warn('[ChatApp] Socket authentication error: signaling auth required to UI');
        setAuthRequired(true);
        try { conn.disconnect(); } catch (e) { /* ignore */ }
      }
    });
    conn.on('disconnect', (reason) => {
      console.debug('[ChatApp] socket disconnected', reason);
      setSocketConnected(false);
    });
    conn.on('presence-update', ({ userId, status }) => {
      console.debug('[ChatApp] presence-update', userId, status);
      if (debugEnabled) {
        console.debug('[ChatApp] presence-update debugEnabled: userId=', userId);
      }
      const uidStr = String(userId);
      updateConversations((prev) => prev.map(c => (idMatches(c, uidStr) ? { ...c, online: status === 'online' } : c)));
      setAvailableContacts((prev) => prev.map(c => (String(c.id) === uidStr ? { ...c, online: status === 'online' } : c)));
      setContactResults((prev) => prev.map(c => (idMatches(c, uidStr) ? { ...c, online: status === 'online' } : c)));
      if (debugEnabled) {
        console.debug('[ChatApp] presence-update completed for userId=', uidStr);
      }
      // Also update selected if it's the one that changed
      if (idMatches(selected, uidStr)) {
        setSelected(prev => ({ ...(prev || {}), online: status === 'online' }));
      }
    });
    setSocket(conn);
    return () => { try { conn.emit('typing-stop', { to: selected?.id }); } catch (e) {}; conn.disconnect(); setSocket(null); };
  }, [currentUser, chatSettings, socketTrigger]);

  // Helper to update conversations and broadcast unread counts to AppTray
  const updateConversations = (updater) => {
    setConversations((prev) => {
      const newConvs = typeof updater === 'function' ? updater(prev) : updater;
      // Keep chatMutedMap in sync with updated conversations; ensure new conversation entries have default unmuted false
      const newMuted = { ...chatMutedMap };
      (newConvs || []).forEach(c => {
        if (newMuted[c.id] === undefined) newMuted[c.id] = newMuted[c.id] || false;
      });
      setChatMutedMap(newMuted);
      try { localStorage.setItem('chatMuted', JSON.stringify(newMuted)); } catch (e) {}
      return newConvs;
    });
  };

  // Keep the `selected` object in sync with conversation presence/attributes when the conversation list updates
  useEffect(() => {
    if (!selected) return;
    const uid = String(selected.id || selected?.userId || selected?.Id || selected?.id);
    // Try to find the updated info in conversations, availableContacts, or contactResults
    const updated = (conversations || []).find(c => String(c.id) === uid) || (availableContacts || []).find(c => String(c.id) === uid) || (contactResults || []).find(c => String(c.id) === uid);
    if (updated) {
      // Only update selected when anything actually changed to avoid render loops
      const wasOnline = Boolean(selected.online);
      const nowOnline = Boolean(updated.online);
      if (wasOnline !== nowOnline || selected.name !== updated.name || selected.muted !== updated.muted || selected.avatarUrl !== updated.avatarUrl) {
        setSelected(prev => ({ ...(prev || {}), ...updated }));
      }
    }
  }, [conversations, availableContacts, contactResults, selected?.id]);

  // Check presence for selected peer immediately after selection and update selected and conversations state
  useEffect(() => {
    if (!selected?.id) return;
    let mounted = true;
    const checkPresence = async () => {
      try {
        const ids = encodeURIComponent(String(selected.id));
        const res = await api.get(`/api/chat/presence?ids=${ids}`);
        const onlineMap = res?.data?.online || {};
        // Update conversations and available contacts using the normalized helper
        updateConversations((prev) => prev.map(c => ({ ...c, online: isOnlineForItem(c, onlineMap) })));
        setAvailableContacts((prev) => prev.map(a => ({ ...a, online: isOnlineForItem(a, onlineMap) })));
        // Compute the selected peer's online value using our helper
        const isOnline = isOnlineForItem(selected, onlineMap);
        if (mounted) {
          setSelected(prev => ({ ...(prev || {}), online: isOnline }));
          // Also ensure the conversation in the list is updated
          updateConversations(prev => prev.map(c => String(c.id) === String(selected.id) ? { ...c, online: isOnline } : c));
        }
      } catch (e) {
        // ignore silently - presence check is non-critical
      }
    };
    checkPresence();
    return () => { mounted = false; };
  }, [selected?.id]);

  // Whether we should attempt to use the debug endpoint
  const debugEnabled = Boolean(env('ALLOW_CHAT_DEBUG_DUMP') === 'true' || env('ALLOW_CHAT_DEBUG') === 'true' || (import.meta.env && import.meta.env.DEV));
  // Debug: expose function to fetch debug presence endpoint if available
  const refreshPresenceDebug = async () => {
    try {
      // Prefer debug endpoint if present
      let debugResp = null;
      try {
        // Prefer the full dump endpoint if available, but only when explicitly enabled
        if (!debugEnabled) throw new Error('debug-endpoint-disabled');
        debugResp = await api.get('/api/chat/debug/dump');
        console.debug('[ChatApp] /api/chat/debug/dump:', debugResp?.data);
        const onlineMap = debugResp?.data?.online || {};
        // Update UI mapping for conversations and availableContacts
            updateConversations((prev) => prev.map(c => ({ ...c, online: isOnlineForItem(c, onlineMap) })));
        setAvailableContacts((prev) => prev.map(ac => ({ ...ac, online: isOnlineForItem(ac, onlineMap) })));
        return debugResp.data;
      } catch (_e) {
        // Debug endpoint not available; fallback to presence on known peers
      }
      const ids = [...(conversations.map(c => c.id)), ...(availableContacts.map(c => c.id))].filter(Boolean);
      if (!ids || ids.length === 0) return null;
      const pres = await api.get(`/api/chat/presence?ids=${encodeURIComponent(ids.join(','))}`);
      console.debug('[ChatApp] presence:', pres?.data);
      const onlineMap = pres?.data?.online || {};
      updateConversations((prev) => prev.map(c => ({ ...c, online: isOnlineForItem(c, onlineMap) })));
      setAvailableContacts((prev) => prev.map(a => ({ ...a, online: isOnlineForItem(a, onlineMap) })));
      return pres?.data;
    } catch (e) {
      console.warn('[ChatApp] refreshPresenceDebug failed', e?.message || e);
    }
  };
  // Dispatch unread totals to AppTray in an effect (so we don't trigger updates during render)
  useEffect(() => {
    try {
      const totalUnread = (conversations || []).reduce((s, c) => s + (Number(c.unread) || 0), 0);
      const badgeEnabled = (chatSettings && chatSettings.badge !== false);
      const count = badgeEnabled ? totalUnread : 0;
      // Defer to centralized dispatcher so it can manage timing
      dispatchChatUnread(count);
      // Persist unread count so minimized chat shows correct readouts after refresh
      try { const cs = JSON.parse(localStorage.getItem('chatSettings') || '{}'); const next = { ...(cs || {}), unread: count }; localStorage.setItem('chatSettings', JSON.stringify(next)); } catch (e) {}
    } catch (e) { /* ignore */ }
  }, [conversations, chatSettings && chatSettings.badge]);

  // Typing indicator state
  const [typingMap, setTypingMap] = useState({});
  // UI: per-conversation mute helper
  const toggleMuteSelected = () => {
    if (!selected || !selected.id) return;
    const id = String(selected.id);
    const next = { ...(chatMutedMap || {}) };
    next[id] = !next[id];
    setChatMutedMap(next);
    try { localStorage.setItem('chatMuted', JSON.stringify(next)); } catch (e) {}
    // Update conversations to reflect change
    updateConversations(prev => prev.map(c => (c.id === id ? { ...c, muted: next[id] } : c)));
  };
  const toggleMute = (id) => {
    if (!id) return;
    const next = { ...(chatMutedMap || {}) };
    next[String(id)] = !next[String(id)];
    setChatMutedMap(next);
    try { localStorage.setItem('chatMuted', JSON.stringify(next)); } catch (e) {}
    updateConversations(prev => prev.map(c => String(c.id) === String(id) ? { ...c, muted: !!next[String(id)] } : c));
  };
  useEffect(() => {
    if (!socket) return;
    socket.on('typing-start', ({ from }) => setTypingMap((m) => ({ ...m, [from]: true })));
    socket.on('typing-stop', ({ from }) => setTypingMap((m) => ({ ...m, [from]: false })));
    socket.on('message-read', ({ from, to, count }) => {
      // If I'm the sender, mark my messages as read
      const myId = currentUser && (currentUser?.Id || currentUser?.id || currentUser?.userId || (Array.isArray(currentUser?.Username) ? currentUser.Username[0] : currentUser?.Username));
      if (myId && myId === to) {
        setMessages((prev) => prev.map(m => ({ ...m, read: m.sender === 'me' ? true : m.read })));
        updateConversations((prev) => prev.map(c => c.id === from ? { ...c, unread: 0 } : c));
      }
    });
    socket.on('presence-update', ({ userId, status }) => {
      // status === 'online' or 'offline'
      const isOnline = status === 'online';
      if (debugEnabled) console.debug('[ChatApp] socket.presence-update userId=', userId, 'status=', status);
      setAvailableContacts((prev) => prev.map(a => (idMatches(a, userId) ? { ...a, online: isOnline } : a))); 
      updateConversations((prev) => prev.map(c => (idMatches(c, userId) ? { ...c, online: isOnline } : c))); 
      // Also update `selected` if it matches (and log debug info if requested)
      try {
        if (idMatches(selected, userId)) {
          if (debugEnabled) console.debug('[ChatApp] socket.presence-update selected matches userId:', userId, 'selected.id=', selected?.id);
          setSelected(prev => ({ ...(prev || {}), online: isOnline }));
        }
      } catch (e) {}
    });
    return () => {
      socket.off('typing-start'); socket.off('typing-stop'); socket.off('message-read'); socket.off('presence-update');
    };
  }, [socket, currentUser]);

  // Poll presence periodically as a fallback for clients that don't receive socket presence
  useEffect(() => {
    let t = null;
    if (socket) {
      t = setInterval(() => {
        try { refreshPresenceDebug(); } catch (e) { }
      }, 25000);
    }
    return () => { if (t) clearInterval(t); };
  }, [socket, conversations.length, availableContacts.length]);

  // Keyboard shortcut: Ctrl/Cmd + M to toggle conversations sidebar
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'm' || e.key === 'M')) {
        try {
          e.preventDefault();
          const next = { ...(chatSettings || {}), hideSidebar: !chatSettings?.hideSidebar };
          persistChatSettings(next);
          // notify other windows/components
          window.dispatchEvent(new CustomEvent('chat-settings-changed', { detail: next }));
        } catch (err) {
          // ignore
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [chatSettings]);
  // Toggle emoji popover with Ctrl/Cmd+E for quick access
  useEffect(() => {
    const handler = (e) => {
      // Toggle emoji with Ctrl/Cmd+E
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e') {
        try {
          e.preventDefault();
          // Prefer emoji button anchor; only fallback to input if emoji button not present
          const anchorEl = emojiAnchor ? null : (emojiBtnRef.current || inputRef.current || null);
          let pos = null;
          if (anchorEl && anchorEl.getBoundingClientRect) {
            const r = anchorEl.getBoundingClientRect();
            pos = { top: Math.round(r.top), left: Math.round(r.left + r.width / 2) };
          }
          setEmojiAnchorPos(pos);
          const anchor = anchorEl;
          console.debug('[ChatApp] emoji keyboard toggle; anchor=', anchor);
          setEmojiAnchor(anchor);
          if (!anchor && inputRef.current) inputRef.current.focus();
        } catch (err) {}
      }
      // Close emoji popover on Escape and restore focus
      if (e.key === 'Escape' && emojiAnchor) {
        try { setEmojiAnchor(null); if (inputRef.current) inputRef.current.focus(); } catch (_) {}
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [emojiAnchor]);

  // Log and compute inline positioning for fallback if the Popover doesn't appear
  useEffect(() => {
    try {
      console.debug('[ChatApp] emojiAnchor changed ->', emojiAnchor);
      // Attach composition listeners to input to handle IME composition scenarios
      const el = inputRef.current;
      if (el && !el.__composition_listeners_attached) {
        const onStart = () => { isComposingRef.current = true; };
        const onEnd = () => { isComposingRef.current = false; };
        el.addEventListener('compositionstart', onStart);
        el.addEventListener('compositionend', onEnd);
        el.__composition_listeners_attached = true;
      }
    } catch (e) { console.warn('[ChatApp] failed to attach composition listeners', e); }
  }, [emojiAnchor]);
  // Typing debounce
  const typingTimerRef = useRef(null);
  const startTyping = () => {
    if (!socket || !selected) return;
    socket.emit('typing-start', { to: selected.id });
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      socket.emit('typing-stop', { to: selected.id });
    }, 1200);
  };

  const sendMessage = async () => {
    if (!input.trim() || !selected?.id) return;
    const to = selected?.id;
    try {
      const clientId = `client-${Date.now()}-${Math.round(Math.random() * 10000)}`;
      const myAvatarUrl = currentUser?.photo || currentUser?.Photo || currentUser?.avatarUrl || null;
      const payload = { to, text: input, metadata: { clientId, avatarUrl: myAvatarUrl } };
      await api.post('/api/chat/messages', payload);
      try { socket?.emit('typing-stop', { to }); } catch (e) {}
      const optimisticMsg = {
        id: clientId,
        clientId,
        text: input,
        sender: 'me',
        read: false,
        time: new Date().toLocaleTimeString([], {
          hour: '2-digit', minute: '2-digit',
        }),
        avatar: getAvatarInitial((currentUser && (currentUser?.name || currentUser?.Name || currentUser?.displayName)) || null, (currentUser && (currentUser?.userId || currentUser?.id || currentUser?.Id)) || null),
        avatarUrl: currentUser?.photo || currentUser?.Photo || currentUser?.avatarUrl || null,
      };
      setMessages((prev) => [...prev, optimisticMsg]);
    } catch (e) {
      console.error('Failed to send chat', e);
    }
    setInput("");
  };

    // Basic emoji list for quick insertion
    const EMOJIS = ['😊','😂','😍','👍','🙏','😮','😢','🎉','😅','🤔','😎','🔥','🤝','🙌','💯','👏','😴','😇','🤗','😜','🤩','😬','🤐','🤤','🤒','🤕','😷','🤧','🥳','🫡','💥','🍀','🍻','🍕','🌟','✨','❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎'];
    const SHORTCODE_MAP = {
      ':smile:': '😊', ':laugh:': '😂', ':heart:': '😍', ':thumbsup:': '👍', ':pray:': '🙏', ':surprised:': '😮', ':cry:': '😢', ':tada:': '🎉', ':sweat_smile:': '😅', ':thinking:': '🤔', ':sunglasses:': '😎', ':fire:': '🔥'
    };
    const EMOTICON_MAP = {
      ':)': '😊', ':-)': '😊', ':(': '☹️', ':-(': '☹️', ':D': '😄', 'XD': '😆', ';)' : '😉', ':P': '😛', ':p': '😛', ':/':'😕', ':|':'😐'
    };

    const insertEmojiAtCursor = (emoji) => {
      try {
        const el = inputRef.current;
        if (!el) {
          setInput((prev) => (prev || '') + emoji);
          return;
        }
        const commit = () => {
          try {
            const start = Number.isInteger(el.selectionStart) ? el.selectionStart : 0;
            const end = Number.isInteger(el.selectionEnd) ? el.selectionEnd : start;
            const value = el.value || input || '';
            const next = value.slice(0, start) + emoji + value.slice(end);
            setInput(next);
            setTimeout(() => {
              try {
                el.focus();
                const pos = start + emoji.length;
                if (typeof el.setSelectionRange === 'function') el.setSelectionRange(pos, pos);
                else { el.selectionStart = el.selectionEnd = pos; }
              } catch (e) { /* ignore caret restore error */ }
            }, 8);
          } catch (err) { setInput((prev) => (prev || '') + emoji); }
        };

        const replaceShortcodeAtCursor = (el) => {
          try {
            if (!el) return false;
            const start = Number.isInteger(el.selectionStart) ? el.selectionStart : 0;
            const value = el.value || input || '';
            // find last word before cursor that looks like :shortcode:
            const left = value.slice(0, start);
            const match = left.match(/(:[a-z0-9_+-]+:)$/i);
            let emoji = null;
            if (match && match[1]) {
              const key = match[1].toLowerCase();
              emoji = SHORTCODE_MAP[key];
            }
            // If no shortcode matched, check simpler emoticon patterns
            if (!emoji) {
              // grab last up to 3 characters to match emoticons like ':-)' or 'XD'
              const tail = left.slice(-3);
              const candidates = [tail, tail.slice(-2), tail.slice(-1)];
              for (const c of candidates) {
                if (EMOTICON_MAP[c]) { emoji = EMOTICON_MAP[c]; break; }
              }
            }
            if (!emoji) return false;
            try { console.debug('[ChatApp] replaceShortcodeAtCursor replacing', { key: emoji, s: match ? match[1] : null, tail: left.slice(-3) }); } catch (e) {}
            if (!emoji) return false;
            const s = start - key.length;
            const next = value.slice(0, s) + emoji + value.slice(start);
            setInput(next);
            setTimeout(() => { try { el.focus(); const pos = s + emoji.length; el.setSelectionRange(pos, pos); } catch(_) {} }, 8);
            return true;
          } catch (e) { return false; }
        };
        if (isComposingRef.current) {
          const onComp = () => { commit(); el.removeEventListener('compositionend', onComp); };
          el.addEventListener('compositionend', onComp);
        } else {
          commit();
        }
      } catch (e) { setInput((prev) => (prev || '') + emoji); }
    };

  // Mark messages as read when selecting a conversation or when focused
  useEffect(() => {
    if (!selected || !currentUser) return;
    async function markRead() {
      try {
        await api.post(`/api/chat/messages/${selected.id}/read`);
        // Update UI state
        setMessages((prev) => prev.map(m => ({ ...m, read: true })));
        updateConversations((prev) => prev.map(c => c.id === selected.id ? { ...c, unread: 0 } : c));
      } catch (e) { }
    }
    markRead();
    // Stop typing indicator for previous peer when selection changes
    if (socket) {
      try { socket.emit('typing-stop', { to: selected.id }); } catch (e) {}
    }
  }, [selected, currentUser]);

  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: '100%',
        height: '100%',
        maxHeight: '100%',
        bgcolor: "rgba(20, 20, 35, 0.95)",
        overflow: "hidden",
        boxShadow: "0 24px 48px rgba(0,0,0,0.5)",
        backdropFilter: "blur(30px)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 16,
        display: "flex",
        flexDirection: "column",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      {/* Message Context Menu */}
      <Menu
        open={!!msgContextMenu}
        onClose={() => setMsgContextMenu(null)}
        anchorReference="anchorPosition"
        anchorPosition={msgContextMenu ? { top: msgContextMenu.mouseY, left: msgContextMenu.mouseX } : undefined}
        disablePortal={false}
        container={() => document.body}
        PopoverClasses={{ root: 'chat-delete-menu' }}
        BackdropProps={{
          invisible: true,
          sx: { pointerEvents: 'none' }
        }}
        slotProps={{
          paper: {
            sx: {
              zIndex: 9999999,
              bgcolor: 'rgba(30,30,45,0.98)',
              border: '1px solid rgba(255,255,255,0.1)',
              backdropFilter: 'blur(10px)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.6)'
            },
            elevation: 24
          }
        }}
        MenuListProps={{
          sx: { zIndex: 9999999 },
          onMouseDown: (e) => e.stopPropagation()
        }}
      >
        <MenuItem 
          onClick={() => handleDeleteMessage(msgContextMenu?.messageId, false)}
          sx={{ color: 'white', '&:hover': { bgcolor: 'rgba(0,176,255,0.2)' } }}
        >
          Delete for me
        </MenuItem>
        {msgContextMenu?.isMine && (
          <MenuItem 
            onClick={() => handleDeleteMessage(msgContextMenu?.messageId, true)}
            sx={{ color: '#ff6b6b', '&:hover': { bgcolor: 'rgba(255,107,107,0.2)' } }}
          >
            Delete for everyone
          </MenuItem>
        )}
      </Menu>

      {/* Conversation Context Menu */}
      <Menu
        open={!!convContextMenu}
        anchorEl={convDeleteAnchor}
        onClose={() => { setConvContextMenu(null); setConvDeleteAnchor(null); }}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        disablePortal={false}
        container={() => document.body}
        PopoverClasses={{ root: 'chat-delete-menu' }}
        BackdropProps={{
          invisible: true,
          sx: { pointerEvents: 'none' }
        }}
        slotProps={{
          paper: {
            sx: {
              zIndex: 9999999,
              bgcolor: 'rgba(30,30,45,0.98)',
              border: '1px solid rgba(255,255,255,0.1)',
              backdropFilter: 'blur(10px)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.6)'
            },
            elevation: 24
          }
        }}
        MenuListProps={{
          sx: { zIndex: 9999999 },
          onMouseDown: (e) => e.stopPropagation()
        }}
      >
        <MenuItem 
          onClick={() => { handleDeleteConversation(convContextMenu?.peerId, false); }}
          sx={{ color: 'white', '&:hover': { bgcolor: 'rgba(0,176,255,0.2)' } }}
        >
          Delete for me
        </MenuItem>
        <MenuItem 
          onClick={() => { handleDeleteConversation(convContextMenu?.peerId, true); }}
          sx={{ color: '#ff6b6b', '&:hover': { bgcolor: 'rgba(255,107,107,0.2)' } }}
        >
          Delete for everyone
        </MenuItem>
      </Menu>

            <Box sx={{ display: "flex", flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {/* Sidebar */}
        <Box
          sx={{
            bgcolor: "rgba(15, 15, 28, 0.8)",
            borderRight: "1px solid rgba(255,255,255,0.08)",
            width: chatSettings?.hideSidebar ? 0 : { xs: 0, sm: 280, md: 300 },
            minWidth: chatSettings?.hideSidebar ? 0 : { xs: 0, sm: 280, md: 300 },
            transition: 'width 300ms cubic-bezier(0.4, 0, 0.2, 1)',
            overflow: 'hidden',
            display: { xs: 'none', sm: 'flex' },
            flexDirection: 'column'
          }}
        >
          <Box sx={{ p: 2.5, flexShrink: 0 }}>
            <Box
              sx={{
                bgcolor: "rgba(255,255,255,0.06)",
                borderRadius: 3,
                display: "flex",
                alignItems: "center",
                px: 1.5,
                py: 1,
                transition: 'all 0.2s',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.09)' },
                '&:focus-within': { bgcolor: 'rgba(255,255,255,0.09)', boxShadow: '0 0 0 2px rgba(0,176,255,0.3)' }
              }}
            >
              <InputBase
                placeholder="Search contacts or conversations"
                value={searchQuery}
                onChange={(e) => { 
                  setSearchQuery(e.target.value);
                  if (e.target.value.trim()) {
                    doContactSearch();
                  } else {
                    setContactResults([]);
                  }
                }}
                onKeyDown={(e) => { if (e.key === 'Enter') doContactSearch(); }}
                sx={{ ml: 1, color: '#e0e0e0', width: '100%', fontSize: '0.95rem', '& input::placeholder': { color: 'rgba(255,255,255,0.4)' } }}
              />
              <IconButton size='small' onClick={() => doContactSearch()}>
                <FiSearch color="#888" size={16} />
              </IconButton>
            </Box>
            {!searchQuery && (
              <Box sx={{ px: 0.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1, mt: 2 }}>
                <Typography color='rgba(255,255,255,0.5)' fontSize='0.85rem' fontWeight={500}>Online</Typography>
                <Box sx={{ bgcolor: 'rgba(74,222,128,0.15)', px: 1, py: 0.3, borderRadius: 2 }}>
                  <Typography color='#4ade80' fontSize='0.85rem' fontWeight={600}>{(availableContacts.filter(c => c.online).length + conversations.filter(c => c.online).length)}</Typography>
                </Box>
              </Box>
            )}
          </Box>

          <List sx={{ pt: 0, pb: 0, overflowY: 'auto', overflowX: 'hidden', flex: 1, minHeight: 0 }}>
            {/* Show contact search results if present */}
            {contactResults.length > 0 && (
              <Box>
                <Box sx={{ px: 2, py: 1, bgcolor: 'rgba(0,176,255,0.1)' }}>
                  <Typography color='#00b0ff' fontSize='0.85rem' fontWeight={600}>Search Results ({contactResults.length})</Typography>
                </Box>
                {contactResults.map((c) => (
                  <ListItem key={`contact-${c.id}`} disablePadding>
                    <ListItemButton 
                      onClick={() => { 
                        setSelected({ id: c.id, name: c.name, avatar: (c.name||'U')[0], unread: 0, muted: (chatMutedMap && chatMutedMap[c.id]) || false }); 
                        setContactResults([]);
                        setSearchQuery('');
                      }}
                      sx={{
                        '&:hover': { bgcolor: 'rgba(0,176,255,0.15)' }
                      }}
                    >
                      <Badge
                        overlap='circular'
                        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                        badgeContent={c.online ? <Box sx={{ width: 10, height: 10, bgcolor: '#4ade80', borderRadius: '50%', border: '2px solid #0f0f1a' }} /> : null}
                      >
                          {c.avatarUrl ? <Avatar src={c.avatarUrl} sx={{ width: 36, height: 36, mr: 1.5 }} /> : <Avatar sx={{ bgcolor: avatarColor(c.name || c.id), width: 36, height: 36, mr: 1.5, fontWeight: 'bold' }}>{getAvatarInitial(c.name, c.id)}</Avatar>}
                      </Badge>
                      <Box sx={{ flex: 1 }}>
                        <Typography color='white' fontSize='0.95rem' fontWeight={600}>{c.name}</Typography>
                        {c.email && <Typography variant='caption' color='rgba(255,255,255,0.5)'>{c.email}</Typography>}
                      </Box>
                    </ListItemButton>
                  </ListItem>
                ))}
              </Box>
            )}
            {searchQuery && contactResults.length === 0 && (
              <Box sx={{ p: 3, textAlign: 'center' }}>
                <Typography color='rgba(255,255,255,0.5)' fontSize='0.9rem'>No contacts found</Typography>
              </Box>
            )}
            {!searchQuery && availableContacts.length > 0 && (
              <Box>
                <Box sx={{ px: 2.5, py: 1.5, bgcolor: 'transparent', mb: 0.5 }}>
                  <Typography color='rgba(255,255,255,0.4)' fontSize='0.8rem' fontWeight={700} letterSpacing={0.5}>AVAILABLE USERS</Typography>
                </Box>
                {availableContacts.map((c) => (
                  <ListItem key={`available-${c.id}`} disablePadding>
                    <ListItemButton 
                      onClick={() => { setSelected({ id: c.id, name: c.name, avatar: (c.name||'U')[0], unread: 0, muted: (chatMutedMap && chatMutedMap[c.id]) || false }); }}
                      sx={{ py: 1.2, px: 2, borderRadius: 2, mx: 1, mb: 0.5, transition: 'all 0.2s', '&:hover': { bgcolor: 'rgba(0,176,255,0.1)', transform: 'translateX(4px)' } }}
                    >
                      <Badge
                        overlap='circular'
                        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                        badgeContent={c.online ? <Box sx={{ width: 10, height: 10, bgcolor: '#4ade80', borderRadius: '50%', border: '2.5px solid rgba(15,15,28,0.9)' }} /> : null}
                      >
                        <Avatar sx={{ bgcolor: avatarColor(c.name || c.id), width: 38, height: 38, mr: 1.5, fontSize: '0.95rem', fontWeight: 600 }}>{getAvatarInitial(c.name, c.id)}</Avatar>
                      </Badge>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography color='white' fontSize='0.95rem' fontWeight={600} noWrap>{c.name}</Typography>
                        {c.email && <Typography variant='caption' color='rgba(255,255,255,0.45)' fontSize='0.8rem' noWrap>{c.email}</Typography>}
                      </Box>
                    </ListItemButton>
                  </ListItem>
                ))}
              </Box>
            )}
            {!searchQuery && conversations.length > 0 && (
              <Box sx={{ px: 2.5, py: 1.5, bgcolor: 'transparent', mt: availableContacts.length > 0 ? 2 : 0, mb: 0.5 }}>
                <Typography color='rgba(255,255,255,0.4)' fontSize='0.8rem' fontWeight={700} letterSpacing={0.5}>CONVERSATIONS</Typography>
              </Box>
            )}
            {!searchQuery && conversations.map((c) => (
              <ListItem key={c.id} disablePadding>
                <ListItemButton
                  selected={selected?.id === c.id}
                  onClick={() => setSelected(c)}
                  sx={{
                    py: 1.2,
                    px: 2,
                    position: "relative",
                    borderRadius: 2,
                    mx: 1,
                    mb: 0.5,
                    transition: 'all 0.2s',
                    bgcolor:
                      selected?.id === c.id
                        ? "rgba(0, 176, 255, 0.18)"
                        : "transparent",
                    "&:hover": { bgcolor: selected?.id === c.id ? "rgba(0, 176, 255, 0.18)" : "rgba(0, 176, 255, 0.1)", transform: 'translateX(4px)' },
                  }}
                >
                  {/* Avatar with online badge */}
                  <Badge
                    overlap="circular"
                    anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                    badgeContent={
                      c.online ? (
                        <Box
                          sx={{
                            width: 10,
                            height: 10,
                            bgcolor: "#4ade80",
                            border: "2px solid rgba(15,15,28,0.9)",
                            borderRadius: "50%",
                          }}
                        />
                      ) : null
                    }
                  >
                      {c.avatarUrl ? <Avatar src={c.avatarUrl} sx={{ width: 44, height: 44, fontSize: '1rem', fontWeight: 600 }} /> : <Avatar sx={{ width: 44, height: 44, bgcolor: avatarColor(c.name || c.id), fontSize: '1rem', fontWeight: 600 }} >{c.avatar || getAvatarInitial(c.name, c.id)}</Avatar>}
                  </Badge>

                  <Box sx={{ ml: 1.5, flex: 1, textAlign: 'left', minWidth: 0 }}>
                    <Typography fontWeight={600} color='white' sx={{ fontSize: '0.95rem', mb: 0.3 }} noWrap>{c.name}</Typography>
                    <Typography variant='caption' color='rgba(255,255,255,0.5)' sx={{ fontSize: '0.85rem' }} noWrap>{c.lastMsg}</Typography>
                  </Box>
                  <Box sx={{ position: 'absolute', top: 12, right: 88 }}>
                    <Typography variant='caption' color='rgba(255,255,255,0.35)' fontSize='0.75rem' fontWeight={500}>{typeof c.time === 'string' ? c.time : (c.time ? new Date(c.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '')}</Typography>
                  </Box>
                  <Box sx={{ position: 'absolute', top: 10, right: 52 }}>
                    <IconButton size='small' onClick={(e) => { e.stopPropagation(); toggleMute(c.id); }} sx={{ color: 'rgba(255,255,255,0.5)', '&:hover': { color: '#00b0ff', bgcolor: 'rgba(0,176,255,0.1)' } }} title={chatMutedMap && chatMutedMap[c.id] ? 'Unmute' : 'Mute'}>
                      {chatMutedMap && chatMutedMap[c.id] ? <FiBellOff size={16} /> : <FiBell size={16} />}
                    </IconButton>
                  </Box>
                  <Box sx={{ position: 'absolute', top: 10, right: 20 }}>
                    <IconButton 
                      size='small' 
                      onClick={(e) => { 
                        e.stopPropagation();
                        e.preventDefault();
                        // Toggle menu - close if already open for this conversation
                        const isOpen = convContextMenu?.peerId === c.id && convDeleteAnchor;
                        if (isOpen) {
                          setConvContextMenu(null);
                          setConvDeleteAnchor(null);
                        } else {
                          setConvDeleteAnchor(e.currentTarget);
                          setConvContextMenu({ peerId: c.id });
                        }
                      }} 
                      sx={{ 
                        color: convContextMenu?.peerId === c.id ? '#ff6b6b' : 'rgba(255,255,255,0.5)',
                        '&:hover': { color: '#ff6b6b', bgcolor: 'rgba(255,107,107,0.1)' }
                      }} 
                      title='Delete options'
                    >
                      <FiTrash2 size={16} />
                    </IconButton>
                  </Box>
                  {c.muted && (
                    <Box sx={{ position: 'absolute', top: 6, right: 80 }} title='Muted'>
                      <FiBellOff color='rgba(255,255,255,0.7)' />
                    </Box>
                  )}
                  {/* Unread count badge */}
                  {c.unread > 0 && (
                    <Box
                      sx={{
                        position: "absolute",
                        top: 8,
                        right: 12,
                        bgcolor: "#ff3b30",
                        color: "white",
                        borderRadius: "50%",
                        width: 17,
                        height: 17,
                        fontSize: 11,
                        fontWeight: "bold",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {c.unread}
                    </Box>
                  )}
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Box>

        {/* Main Chat */}
        {chatSettings?.hideSidebar && (
          <Box sx={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', zIndex: 1400 }}>
            <IconButton size='small' onClick={() => { const next = { ...chatSettings, hideSidebar: false }; persistChatSettings(next); }} sx={{ bgcolor: 'rgba(0,0,0,0.45)', color: '#fff', '&:hover': { bgcolor: 'rgba(0,0,0,0.6)' } }} title='Show conversations'>
              <FiChevronRight />
            </IconButton>
          </Box>
        )}
        <Box
          sx={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            bgcolor: "rgba(20,20,35,0.95)",
          }}
        >
          {/* Chat Header */}
          <Box
            sx={{
              py: 1,
              px: 2,
              borderBottom: "1px solid rgba(255,255,255,0.08)",
              display: "flex",
              alignItems: "center",
              gap: 2,
            }}
          >
            <Badge
              overlap="circular"
              anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
              badgeContent={
                selected?.online ? (
                  <Box
                    sx={{
                      width: 14,
                      height: 14,
                      bgcolor: "#4ade80",
                      border: "3px solid #141421",
                      borderRadius: "50%",
                    }}
                  />
                ) : null
              }
            >
              {selected?.avatarUrl ? (
                <Avatar
                  src={selected.avatarUrl}
                  sx={{
                    width: chatSettings.compact ? 36 : 44,
                    height: chatSettings.compact ? 36 : 44,
                  }}
                />
              ) : (
                <Avatar
                  sx={{
                    bgcolor: "#00b0ff",
                    width: chatSettings.compact ? 36 : 44,
                    height: chatSettings.compact ? 36 : 44,
                    fontWeight: "bold",
                  }}
                >
                  {selected?.avatar || ''}
                </Avatar>
              )}
            </Badge>
              <Box>
              <Typography fontWeight="700" color="white">
                {selected?.name || 'No conversation selected'}
              </Typography>
              <Typography variant="caption" color="#00b0ff">
                {typingMap[selected?.id] ? 'Typing...' : (selected?.online ? 'Active now' : 'Offline')}
              </Typography>
            </Box>
          </Box>
            <Box sx={{ ml: 2, display: 'flex', alignItems: 'center' }}>
            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: socketConnected ? '#4ade80' : '#666', mr: 1 }} title={socketConnected ? 'Connected' : 'Disconnected'} />
            <Typography variant='caption' color='rgba(255,255,255,0.6)'> {socketConnected ? 'Connected' : 'Disconnected'}</Typography>
            {(!socketConnected && socketErrorMsg) && (
              <Box sx={{ ml: 1, display: 'flex', alignItems: 'center' }}>
                <Typography variant='caption' sx={{ color: '#ff6666', mr: 1 }}>{socketErrorMsg}</Typography>
                <Button size='small' onClick={() => { setSocketErrorMsg(null); setSocketConnected(false); setAuthRequired(false); setSocketTrigger(s => s + 1); }} sx={{ ml: 1, color: 'white' }} title='Retry connection'>Retry</Button>
              </Box>
            )}
            <IconButton size='small' onClick={() => { refreshPresenceDebug(); }} sx={{ ml: 1, color: 'white' }} title='Refresh Presence (debug)'><FiRefreshCw /></IconButton>
            <IconButton size='small' onClick={() => toggleMuteSelected()} sx={{ ml: 1, color: 'white' }} title={selected && selected.id && (chatMutedMap[selected.id] ? 'Unmute' : 'Mute')}>{(selected && selected.id && chatMutedMap[selected.id]) ? <FiBellOff /> : <FiBell />}</IconButton>
            <IconButton size='small' onClick={() => { const next = { ...chatSettings, hideSidebar: !chatSettings.hideSidebar }; persistChatSettings(next); }} sx={{ ml: 1, color: 'white' }} title={chatSettings && chatSettings.hideSidebar ? 'Show conversations' : 'Hide conversations'}>
              {(chatSettings && chatSettings.hideSidebar) ? <FiChevronRight /> : <FiChevronLeft />}
            </IconButton>
            <IconButton size='small' onClick={(e) => { const next = { ...chatSettings, pinned: !(chatSettings && chatSettings.pinned === false) }; persistChatSettings(next); setSocketTrigger(s => s + 1); }} sx={{ ml: 1, color: chatSettings && chatSettings.pinned !== false ? '#ffd700' : 'white' }} title={chatSettings && chatSettings.pinned !== false ? 'Pinned: click to unpin' : 'Unpinned: click to pin'} aria-pressed={chatSettings && chatSettings.pinned !== false}><FiMapPin /></IconButton>
            <IconButton size='small' onClick={(e) => { setSettingsAnchor(prev => !prev); }} sx={{ ml: 1, color: 'white' }} title='Chat Settings'><FiSettings /></IconButton>
            <Dialog
              open={Boolean(settingsAnchor)}
              onClose={() => setSettingsAnchor(null)}
              maxWidth="sm"
              fullWidth
              PaperProps={{ 
                sx: { 
                  bgcolor: 'rgba(28,28,32,0.98)',
                  color: '#eaeaea',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  zIndex: 999999
                } 
              }}
              BackdropProps={{
                sx: { zIndex: 999998 }
              }}
            >
              <DialogTitle sx={{ borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                Chat Settings
                <IconButton size='small' onClick={() => setSettingsAnchor(null)} sx={{ color: 'rgba(255,255,255,0.7)' }}>
                  <FiX size={20} />
                </IconButton>
              </DialogTitle>
              <DialogContent sx={{ pt: 3, maxHeight: '70vh', overflowY: 'auto' }}>
                <Typography variant='subtitle2' sx={{ mb: 1.5, fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>Notifications</Typography>
                <FormControlLabel control={<Switch checked={!!chatSettings?.sound} onChange={(e) => { const next = { ...chatSettings, sound: e.target.checked }; persistChatSettings(next); if (e.target.checked) { try { const ctx = new (window.AudioContext || window.webkitAudioContext)(); const o = ctx.createOscillator(); const g = ctx.createGain(); o.type='sine'; o.frequency.value=880; o.connect(g); g.connect(ctx.destination); o.start(); setTimeout(() => { try { o.stop(); ctx.close(); } catch (_) {} }, 120); } catch(_){} } }} />} label='Sound' />
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 1, ml: 4 }}>
                  <select value={soundFile} onChange={(e) => { const next = e.target.value; setSoundFile(next); try { localStorage.setItem('chatSoundFile', next); } catch (_) {} }} style={{ padding: 6, background: 'transparent', color: '#fff', borderRadius: 6, border: '1px solid rgba(255,255,255,0.06)', fontSize: '12px' }}>
                    <option value="/sounds/chat-notify.mp3">Default</option>
                    <option value="/sounds/chat-success.mp3">Chime</option>
                    <option value="/sounds/chat-pop.mp3">Pop</option>
                  </select>
                  <Button size='small' onClick={() => { try { if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; playNotificationSound(); } } catch(e) {} }}>Test</Button>
                  <input type='file' accept='audio/*' onChange={(e) => { const f = e.target.files?.[0]; if (f) { const url = URL.createObjectURL(f); setSoundFile(url); try { localStorage.setItem('chatSoundFile', url); } catch (_) {} } }} style={{ display: 'inline-block' }} title='Upload custom sound' />
                </Box>
                <FormControlLabel control={<Switch checked={!!chatSettings?.desktop} onChange={(e) => { const next = { ...chatSettings, desktop: e.target.checked }; persistChatSettings(next); if (e.target.checked && typeof Notification !== 'undefined' && Notification.permission === 'default') { try { Notification.requestPermission(); } catch(_){} } }} />} label='Desktop notifications' />
                
                <Typography variant='subtitle2' sx={{ mb: 1.5, mt: 2.5, fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>Auto-Open Behavior</Typography>
                <FormControlLabel control={<Switch checked={!!chatSettings?.autoOpen} onChange={(e) => { const next = { ...chatSettings, autoOpen: e.target.checked }; persistChatSettings(next); }} />} label='Auto-open chat on new messages' />
                <FormControlLabel control={<Switch disabled={!chatSettings?.autoOpen} checked={!!chatSettings?.autoOpenMentionsOnly && chatSettings?.autoOpen} onChange={(e) => { const next = { ...chatSettings, autoOpenMentionsOnly: e.target.checked }; persistChatSettings(next); }} />} label='  Only for @mentions' sx={{ ml: 2 }} />
                <FormControlLabel control={<Switch disabled={!chatSettings?.autoOpen} checked={!!chatSettings?.autoOpenDND && chatSettings?.autoOpen} onChange={(e) => { const next = { ...chatSettings, autoOpenDND: e.target.checked }; persistChatSettings(next); }} />} label='  Respect Do Not Disturb' sx={{ ml: 2 }} />
                {chatSettings?.autoOpenDND && (
                  <Box sx={{ ml: 4, mt: 1, display: 'flex', gap: 2, alignItems: 'center' }}>
                    <Box>
                      <Typography variant='caption' sx={{ display: 'block', mb: 0.5 }}>From:</Typography>
                      <input type='time' value={chatSettings?.dndStart || '22:00'} onChange={(e) => { const next = { ...chatSettings, dndStart: e.target.value }; persistChatSettings(next); }} style={{ padding: 4, background: 'rgba(255,255,255,0.06)', color: '#fff', borderRadius: 4, border: '1px solid rgba(255,255,255,0.1)', fontSize: '12px' }} />
                    </Box>
                    <Box>
                      <Typography variant='caption' sx={{ display: 'block', mb: 0.5 }}>To:</Typography>
                      <input type='time' value={chatSettings?.dndEnd || '08:00'} onChange={(e) => { const next = { ...chatSettings, dndEnd: e.target.value }; persistChatSettings(next); }} style={{ padding: 4, background: 'rgba(255,255,255,0.06)', color: '#fff', borderRadius: 4, border: '1px solid rgba(255,255,255,0.1)', fontSize: '12px' }} />
                    </Box>
                  </Box>
                )}
                <Box sx={{ mt: 1.5, display: 'flex', gap: 1, alignItems: 'center' }}>
                  <Typography variant='caption' sx={{ color: 'rgba(255,255,255,0.7)' }}>Cooldown (sec):</Typography>
                  <input type='number' min='5' max='300' step='5' value={Math.round((chatSettings?.cooldownMs || 30000) / 1000)} onChange={(e) => { const next = { ...chatSettings, cooldownMs: parseInt(e.target.value) * 1000 }; persistChatSettings(next); }} style={{ width: 60, padding: 4, background: 'rgba(255,255,255,0.06)', color: '#fff', borderRadius: 4, border: '1px solid rgba(255,255,255,0.1)', fontSize: '12px' }} />
                </Box>
                
                <Typography variant='subtitle2' sx={{ mb: 1.5, mt: 2.5, fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>Display & Layout</Typography>
                <FormControlLabel control={<Switch checked={!!(chatSettings?.pinned !== false)} onChange={(e) => { const next = { ...chatSettings, pinned: e.target.checked }; persistChatSettings(next); }} />} label='Pin chat to corner' />
                <FormControlLabel control={<Switch checked={!!chatSettings?.dimOnOpen} onChange={(e) => { const next = { ...chatSettings, dimOnOpen: e.target.checked }; persistChatSettings(next); }} />} label='Dim background when chat opens' />
                <FormControlLabel control={<Switch checked={!!chatSettings?.badge} onChange={(e) => { const next = { ...chatSettings, badge: e.target.checked }; persistChatSettings(next); }} />} label='Show tray badge' />
                <FormControlLabel control={<Switch checked={!!chatSettings?.autoScrollToNew} onChange={(e) => { const next = { ...chatSettings, autoScrollToNew: e.target.checked }; persistChatSettings(next); }} />} label='Auto-scroll to new messages' />
                <FormControlLabel control={<Switch checked={!!chatSettings?.compact} onChange={(e) => { const next = { ...chatSettings, compact: e.target.checked }; persistChatSettings(next); }} />} label='Compact view' />
                <FormControlLabel control={<Switch checked={!!chatSettings?.leftAlignMessages} onChange={(e) => { const next = { ...chatSettings, leftAlignMessages: e.target.checked }; persistChatSettings(next); }} />} label='Left align messages' />
                <FormControlLabel control={<Switch checked={!!chatSettings?.hideSidebar} onChange={(e) => { const next = { ...chatSettings, hideSidebar: e.target.checked }; persistChatSettings(next); }} />} label='Hide conversations' />
              </DialogContent>
            </Dialog>
            <Drawer anchor='right' open={drawerOpen} onClose={() => setDrawerOpen(false)}>
              <Box sx={{ width: 320, p: 2, overflowY: 'auto', maxHeight: '100vh' }}>
                <Typography variant='subtitle1' sx={{ mb: 2 }}>Chat settings</Typography>
                <Typography variant='subtitle2' sx={{ mb: 1, fontWeight: 600, fontSize: '12px', color: '#666' }}>Notifications</Typography>
                <FormControlLabel control={<Switch checked={chatSettings.sound} onChange={(e) => { const next = { ...chatSettings, sound: e.target.checked }; persistChatSettings(next); if (e.target.checked) { try { const ctx = new (window.AudioContext || window.webkitAudioContext)(); const o = ctx.createOscillator(); const g = ctx.createGain(); o.type='sine'; o.frequency.value=880; o.connect(g); g.connect(ctx.destination); o.start(); setTimeout(() => { try { o.stop(); ctx.close(); } catch (_) {} }, 120); } catch(_){} } }} />} label='Sound' />
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 1, ml: 4 }}>
                  <select value={soundFile} onChange={(e) => { const next = e.target.value; setSoundFile(next); try { localStorage.setItem('chatSoundFile', next); } catch (_) {} }} style={{ padding: 6, background: 'transparent', color: '#111', borderRadius: 6, border: '1px solid rgba(0,0,0,0.06)', fontSize: '12px' }}>
                    <option value="/sounds/chat-notify.mp3">Default</option>
                    <option value="/sounds/chat-success.mp3">Chime</option>
                    <option value="/sounds/chat-pop.mp3">Pop</option>
                  </select>
                  <Button size='small' onClick={() => { try { if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; playNotificationSound(); } } catch(e) {} }}>Test</Button>
                  <input type='file' accept='audio/*' onChange={(e) => { const f = e.target.files?.[0]; if (f) { const url = URL.createObjectURL(f); setSoundFile(url); try { localStorage.setItem('chatSoundFile', url); } catch (_) {} } }} style={{ display: 'inline-block' }} title='Upload custom sound' />
                </Box>
                <FormControlLabel control={<Switch checked={!!chatSettings?.desktop} onChange={(e) => { const next = { ...chatSettings, desktop: e.target.checked }; persistChatSettings(next); if (e.target.checked && typeof Notification !== 'undefined' && Notification.permission === 'default') { try { Notification.requestPermission(); } catch(_){} } }} />} label='Desktop notifications' />
                
                <Typography variant='subtitle2' sx={{ mb: 1, mt: 2, fontWeight: 600, fontSize: '12px', color: '#666' }}>Auto-Open Behavior</Typography>
                <FormControlLabel control={<Switch checked={!!chatSettings?.autoOpen} onChange={(e) => { const next = { ...chatSettings, autoOpen: e.target.checked }; persistChatSettings(next); }} />} label='Auto-open on messages' />
                <FormControlLabel control={<Switch disabled={!chatSettings?.autoOpen} checked={!!chatSettings?.autoOpenMentionsOnly && chatSettings?.autoOpen} onChange={(e) => { const next = { ...chatSettings, autoOpenMentionsOnly: e.target.checked }; persistChatSettings(next); }} />} label='  @mentions only' sx={{ ml: 2 }} />
                <FormControlLabel control={<Switch disabled={!chatSettings?.autoOpen} checked={!!chatSettings?.autoOpenDND && chatSettings?.autoOpen} onChange={(e) => { const next = { ...chatSettings, autoOpenDND: e.target.checked }; persistChatSettings(next); }} />} label='  Respect DND' sx={{ ml: 2 }} />
                
                <Typography variant='subtitle2' sx={{ mb: 1, mt: 2, fontWeight: 600, fontSize: '12px', color: '#666' }}>Display & Layout</Typography>
                <FormControlLabel control={<Switch checked={!!(chatSettings?.pinned !== false)} onChange={(e) => { const next = { ...chatSettings, pinned: e.target.checked }; persistChatSettings(next); }} />} label='Pin to corner' />
                <FormControlLabel control={<Switch checked={!!chatSettings?.dimOnOpen} onChange={(e) => { const next = { ...chatSettings, dimOnOpen: e.target.checked }; persistChatSettings(next); }} />} label='Dim background' />
                <FormControlLabel control={<Switch checked={!!chatSettings?.badge} onChange={(e) => { const next = { ...chatSettings, badge: e.target.checked }; persistChatSettings(next); }} />} label='Show badge' />
                <FormControlLabel control={<Switch checked={!!chatSettings?.autoScrollToNew} onChange={(e) => { const next = { ...chatSettings, autoScrollToNew: e.target.checked }; persistChatSettings(next); }} />} label='Auto-scroll to new' />
                <FormControlLabel control={<Switch checked={!!chatSettings?.compact} onChange={(e) => { const next = { ...chatSettings, compact: e.target.checked }; persistChatSettings(next); }} />} label='Compact view' />
                <FormControlLabel control={<Switch checked={!!chatSettings?.leftAlignMessages} onChange={(e) => { const next = { ...chatSettings, leftAlignMessages: e.target.checked }; persistChatSettings(next); }} />} label='Left align messages' />
                <FormControlLabel control={<Switch checked={!!chatSettings?.hideSidebar} onChange={(e) => { const next = { ...chatSettings, hideSidebar: e.target.checked }; persistChatSettings(next); }} />} label='Hide conversations' />
              </Box>
            </Drawer>
          </Box>
              {serverOffline && (
                <Box sx={{ ml: 2, display: 'flex', alignItems: 'center', color: '#ffcc00' }}>
                  <Typography variant='caption'>Server database not connected — chat is limited in dev mode.</Typography>
                </Box>
              )}
              {authRequired && (
                <Box sx={{ ml: 2, display: 'flex', alignItems: 'center', color: '#ff6666' }}>
                  <Typography variant='caption'>Authentication required to view conversations — please sign in.</Typography>
                </Box>
              )}

          {/* Messages */}
          <Box
            sx={{
              flex: 1,
              overflowY: "auto",
              overflowX: 'hidden',
              p: 3,
              backgroundImage: `url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><defs><pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M 10 0 L 0 0 0 10" fill="none" stroke="%23333333" stroke-width="0.5"/></pattern></defs><rect width="100" height="100" fill="url(%23grid)"/></svg>')`,
              backgroundAttachment: "fixed",
              // Subtle, thin scrollbar styling to avoid the large default scrollbar and keep it visually minimal
              scrollbarWidth: 'thin', // Firefox
              scrollbarColor: 'rgba(255,255,255,0.12) transparent',
              '&::-webkit-scrollbar': { width: 8, height: 8 },
              // Darken the thumb and increase contrast so the thumb is visible on dark backgrounds
              '&::-webkit-scrollbar-thumb': { backgroundColor: 'rgba(255,255,255,0.20)', borderRadius: 6, border: '2px solid rgba(0,0,0,0.0)' },
              '&:hover::-webkit-scrollbar-thumb': { backgroundColor: 'rgba(255,255,255,0.30)' },
              '&::-webkit-scrollbar-track': { background: 'transparent' },
              // Keep the space for the scrollbar stable to avoid layout shifts on show/hide
              scrollbarGutter: 'stable',
            }}
          >
            {page < totalPages && (
              <Box sx={{ mb: 1, display: 'flex', justifyContent: 'center' }}>
                <IconButton size='small' onClick={loadMoreMessages} sx={{ bgcolor: 'rgba(255,255,255,0.03)', color: '#ddd' }}>Load more</IconButton>
              </Box>
            )}
            {messages.length > 0 ? messages.map((msg) => (
              <Box
                key={msg.id}
                sx={{
                  mb: 2.5,
                  display: 'flex',
                  justifyContent: (chatSettings.leftAlignMessages ? 'flex-start' : (msg.sender === 'me' ? 'flex-end' : 'flex-start')),
                }}
              >
                {msg.sender !== 'me' && (
                  <Box sx={{ display: 'flex', alignItems: 'flex-end', mr: 1 }}>
                    {msg.avatarUrl ? (
                      <Avatar src={msg.avatarUrl} sx={{ width: chatSettings.compact ? 22 : 28, height: chatSettings.compact ? 22 : 28 }} />
                    ) : (
                      <Avatar sx={{ bgcolor: avatarColor(msg.displayName || msg.avatarInitial), width: chatSettings.compact ? 22 : 28, height: chatSettings.compact ? 22 : 28, fontSize: '0.9rem' }}>{msg.avatarInitial || 'U'}</Avatar>
                    )}
                  </Box>
                )}
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: (chatSettings.leftAlignMessages ? 'flex-start' : (msg.sender === 'me' ? 'flex-end' : 'flex-start')) }}>
                  {msg.sender !== 'me' && msg.displayName && (
                    <Typography variant='caption' sx={{ color: 'rgba(255,255,255,0.85)', fontWeight: 600, mb: 0.5, maxWidth: '72%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{msg.displayName}</Typography>
                  )}
                      <Box
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setMsgContextMenu({
                        mouseX: e.clientX,
                        mouseY: e.clientY,
                        messageId: msg.id,
                        isMine: msg.sender === 'me'
                      });
                    }}
                    sx={{
                      maxWidth: '82%',
                      ml: msg.sender === 'me' ? 0 : 1,
                      px: chatSettings.compact ? 1.5 : 2.5,
                      py: chatSettings.compact ? 1 : 1.8,
                      borderRadius: 10,
                      // Less extreme rounding for the chat bubbles; more pill-like but not too circular
                      borderTopLeftRadius: msg.sender === 'me' ? 12 : 6,
                      borderTopRightRadius: msg.sender === 'me' ? 6 : 12,
                      borderBottomLeftRadius: 12,
                      borderBottomRightRadius: 12,
                      bgcolor: msg.sender === 'me' ? 'linear-gradient(135deg, #00b0ff, #0b93f6)' : 'rgba(230,230,235,0.95)',
                      color: msg.sender === 'me' ? 'white' : '#111',
                      boxShadow: msg.sender === 'me' ? '0 8px 20px rgba(0,176,255,0.3)' : 'none',
                      backdropFilter: 'blur(10px)',
                      position: 'relative',
                      transition: 'transform 140ms ease, box-shadow 140ms ease',
                      cursor: 'context-menu',
                      overflow: 'hidden',
                    }}
                  >
                    <Typography variant='body1' sx={{ lineHeight: 1.4, wordBreak: 'break-word', whiteSpace: 'pre-wrap', fontSize: chatSettings.compact ? '0.92rem' : '1rem' }}>{msg.text}</Typography>
                    <Typography variant='caption' sx={{ opacity: 0.7, fontSize: '0.7rem', display: 'block', textAlign: 'right', mt: 0.5 }}>{msg.time}</Typography>
                    {msg.sender === 'me' && (
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                        {msg.read ? <FiCheck size={14} color='#4ade80' /> : <Typography variant='caption' sx={{ opacity: 0.6, fontSize: '0.65rem' }}>Sent</Typography>}
                      </Box>
                    )}
                  </Box>
                </Box>
              </Box>
            )) : null}
            <div ref={messagesEndRef} />
          </Box>

          {/* Input */}
          <Box
            sx={{
              borderTop: "1px solid rgba(255,255,255,0.08)",
              bgcolor: "rgba(15,15,25,0.8)",
              flexShrink: 0,
            }}
          >
            <InputBase
              fullWidth
              multiline
              maxRows={4}
              placeholder="Type a message..."
              value={input}
              inputRef={inputRef}
              onChange={(e) => { setInput(e.target.value); startTyping(); }}
              onKeyDown={(e) => {
                try {
                  // When the user types space/punctuation/enter/tab, attempt to replace any shortcode
                  if (e.key === ' ' || e.key === 'Enter' || e.key === 'Tab' || /[.,!?:;]/.test(e.key)) {
                    const el = e.currentTarget;
                    const replaced = replaceShortcodeAtCursor(el);
                    if (replaced) {
                      e.preventDefault();
                      return;
                    }
                  }
                } catch (err) { /* ignore */ }
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              sx={{
                bgcolor: "rgba(255,255,255,0.07)",
                px: 3,
                py: 1,
                color: "white",
                fontSize: "1rem",
                backdropFilter: "blur(10px)",
                border: "1px solid rgba(255,255,255,0.1)",
                width: '100%',
                maxWidth: '100%',
                boxSizing: 'border-box',
                "&:hover": { borderColor: "rgba(0,176,255,0.4)" },
                "&:focus": { outline: "none", borderColor: "#00b0ff" },
              }}
              endAdornment={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <IconButton size='small' ref={emojiBtnRef} onClick={(e) => { e.stopPropagation(); setEmojiAnchor(emojiAnchor ? null : emojiBtnRef.current); if (emojiAnchor && inputRef.current) try { inputRef.current.focus(); } catch (err) {} }} aria-label='Open emoji picker' aria-haspopup='true' aria-expanded={Boolean(emojiAnchor)} title='Emoji' sx={{ color: 'rgba(255,255,255,0.85)', bgcolor: 'transparent' }}>
                    <span style={{ fontSize: 18 }}>😊</span>
                  </IconButton>
                  {emojiAnchor && (
                    <Box
                      sx={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        zIndex: 209999,
                        backdropFilter: 'blur(0px)',
                        bgcolor: 'transparent'
                      }}
                      onClick={() => {
                        setEmojiAnchor(null);
                        try {
                          if (inputRef.current) inputRef.current.focus();
                        } catch (_) {}
                      }}
                    />
                  )}
                  <Box
                    sx={{
                      position: 'fixed',
                      bottom: 20,
                      right: 20,
                      zIndex: 210000,
                      p: 2,
                      borderRadius: 2,
                      bgcolor: 'rgba(28,28,32,0.98)',
                      color: '#eaeaea',
                      minWidth: 320,
                      maxHeight: '420px',
                      overflowY: 'auto',
                      boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                      display: emojiAnchor ? 'block' : 'none',
                      '&::-webkit-scrollbar': {
                        width: '8px'
                      },
                      '&::-webkit-scrollbar-track': {
                        bgcolor: 'transparent'
                      },
                      '&::-webkit-scrollbar-thumb': {
                        bgcolor: 'rgba(255,255,255,0.2)',
                        borderRadius: '4px',
                        '&:hover': {
                          bgcolor: 'rgba(255,255,255,0.3)'
                        }
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, pb: 1, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                      <Typography sx={{ fontWeight: 600, fontSize: '0.95rem' }}>Pick an emoji</Typography>
                      <IconButton 
                        size="small" 
                        onClick={() => { 
                          setEmojiAnchor(null); 
                          try { if (inputRef.current) inputRef.current.focus(); } catch(_) {} 
                        }} 
                        sx={{ color: 'rgba(255,255,255,0.7)', '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' } }}
                        title="Close"
                      >
                        <FiX size={18} />
                      </IconButton>
                    </Box>
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 1.5 }}>
                      {EMOJIS.map((em) => (
                        <Button key={em} onClick={() => { insertEmojiAtCursor(em); setEmojiAnchor(null); try { if (inputRef.current) inputRef.current.focus(); } catch(_) {} }} sx={{ minWidth: 44, minHeight: 44, p: 1, borderRadius: 1, bgcolor: 'transparent', color: '#eaeaea', fontSize: '1.5rem', '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' }, transition: 'all 0.2s' }}>{em}</Button>
                      ))}
                    </Box>
                  </Box>
                  <IconButton
                    onClick={sendMessage}
                    disabled={!input.trim() || !selected?.id}
                    sx={{
                      bgcolor: input.trim() ? "#0b93f6" : "rgba(255,255,255,0.06)",
                      color: input.trim() ? 'white' : 'rgba(255,255,255,0.6)',
                      borderRadius: '50%',
                      width: 44,
                      height: 44,
                      ml: 1,
                      "&:hover": { bgcolor: "#0099e6" },
                      transition: "all 0.2s",
                    }}
                  >
                    <IoSend />
                  </IconButton>
                </Box>
              }
            />
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
