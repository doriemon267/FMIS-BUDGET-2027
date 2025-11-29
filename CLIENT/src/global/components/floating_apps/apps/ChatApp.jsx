// src/components/apps/ChatApp.jsx
import { useState, useRef, useEffect } from "react";
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
  Popover
} from "@mui/material";
import { IoSend } from "react-icons/io5";
import { FiSearch, FiRefreshCw, FiSettings, FiCheck, FiBell, FiBellOff } from "react-icons/fi";
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
  const [serverOffline, setServerOffline] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const { currentUser } = useUser();
  const [chatSettings, setChatSettings] = useState({ sound: true, desktop: true, badge: true, compact: false });
  const [chatMutedMap, setChatMutedMap] = useState({});
  const [settingsAnchor, setSettingsAnchor] = useState(null);
  const [soundFile, setSoundFile] = useState(localStorage.getItem('chatSoundFile') || '/sounds/chat-notify.mp3');
  const audioRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
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
            setContactResults(contacts.map(c => ({ ...c, online: !!onlineMap[c.id]?.online })));
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
      setChatSettings({ sound: s.sound !== false, desktop: s.desktop !== false, badge: s.badge !== false, compact: s.compact === true });
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

  // Initialize audioRef whenever soundFile changes
  useEffect(() => {
    try {
      if (!soundFile) { audioRef.current = null; return; }
      const a = new Audio(soundFile);
      a.preload = 'auto';
      audioRef.current = a;
    } catch (e) {
      console.warn('[ChatApp] failed to init audio', e);
      audioRef.current = null;
    }
    return () => {
      try { if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; } } catch (e) {}
    }
  }, [soundFile]);

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
          id: c._id || c.id,
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
              updateConversations((prev) => prev.map(c => ({ ...c, online: !!onlineMap[c.id]?.online })));
            }
          } catch (e) { console.warn('[ChatApp] presence API call failed', e); }
        }
        // If there are no conversations, fetch available contacts (scoped assignments) so we can show an online roster
        if (!convs || convs.length === 0) {
          try {
            const contactsRes = await api.get('/api/chat/contacts');
            const contacts = contactsRes?.data?.contacts || [];
            if (contacts.length > 0) {
              const ids = contacts.map(c => c.id).join(',');
              const pres = ids ? await api.get(`/api/chat/presence?ids=${encodeURIComponent(ids)}`) : null;
              const onlineMap = pres?.data?.online || {};
              const enriched = contacts.map(c => ({ ...c, online: !!onlineMap[c.id] }));
              console.debug('[ChatApp] available contacts:', enriched);
              setAvailableContacts(enriched);
            }
          } catch (e) {
            console.warn('[ChatApp] failed to fetch available contacts', e);
            setAvailableContacts([]);
          }
        } else {
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
    const authObj = {};
    if (token) authObj.token = token;
    if (devUserId) authObj.devUserId = String(devUserId);
    const conn = io(serverUrl, { path: '/socket.io', transports: ['polling', 'websocket'], withCredentials: true, auth: authObj });
    if (devUserId) console.debug('[ChatApp] Passing devUserId to socket auth (if ALLOW_MOCK_AUTH enabled)');
    conn.on('connect', () => {
      const uid = (currentUser?.Id || currentUser?.id || currentUser?.userId || (Array.isArray(currentUser?.Username) ? currentUser.Username[0] : currentUser?.Username) || null);
      console.debug('[ChatApp] socket connected', conn.id, 'uid=', uid, 'tokenPresent=', !!token);
      setSocketConnected(true);
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
        const { sound: soundEnabled, desktop: desktopEnabled } = chatSettings || { sound: true, desktop: true };
        // If the conversation is muted, skip notifications
        const peerId = payload.from;
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
                    void audio.play();
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
        return [...prev, mapped];
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
        const found = prev.findIndex(c => c.id === peerId);
        const updated = prev.map(c => c.id === peerId ? { ...c, lastMsg: payload.text, lastAt: payload.createdAt, unread: (!isMine && c.id === peerId) ? (c.unread || 0) + 1 : (isMine ? c.unread : c.unread) } : c);
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
      console.error('Chat socket connect_error:', err?.message || err);
      setSocketConnected(false);
    });
    conn.on('disconnect', (reason) => {
      console.debug('[ChatApp] socket disconnected', reason);
      setSocketConnected(false);
    });
    conn.on('presence-update', ({ userId, status }) => {
      console.debug('[ChatApp] presence-update', userId, status);
      updateConversations((prev) => prev.map(c => c.id === userId ? { ...c, online: status === 'online' } : c));
      setAvailableContacts((prev) => prev.map(c => c.id === userId ? { ...c, online: status === 'online' } : c));
      setContactResults((prev) => prev.map(c => c.id === userId ? { ...c, online: status === 'online' } : c));
    });
    setSocket(conn);
    return () => { try { conn.emit('typing-stop', { to: selected?.id }); } catch (e) {}; conn.disconnect(); setSocket(null); };
  }, [currentUser, chatSettings]);

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

  // Debug: expose function to fetch debug presence endpoint if available
  const refreshPresenceDebug = async () => {
    try {
      // Prefer debug endpoint if present
      let debugResp = null;
      try {
        // Prefer the full dump endpoint if available
        debugResp = await api.get('/api/chat/debug/dump');
        console.debug('[ChatApp] /api/chat/debug/dump:', debugResp?.data);
        const onlineMap = debugResp?.data?.online || {};
        // Update UI mapping for conversations and availableContacts
            updateConversations((prev) => prev.map(c => ({ ...c, online: !!onlineMap[c.id]?.online })));
        setAvailableContacts((prev) => prev.map(ac => ({ ...ac, online: !!onlineMap[ac.id]?.online })));
        return debugResp.data;
      } catch (_e) {
        // Debug endpoint not available; fallback to presence on known peers
      }
      const ids = [...(conversations.map(c => c.id)), ...(availableContacts.map(c => c.id))].filter(Boolean);
      if (!ids || ids.length === 0) return null;
      const pres = await api.get(`/api/chat/presence?ids=${encodeURIComponent(ids.join(','))}`);
      console.debug('[ChatApp] presence:', pres?.data);
      const onlineMap = pres?.data?.online || {};
      updateConversations((prev) => prev.map(c => ({ ...c, online: !!onlineMap[c.id]?.online })));
      setAvailableContacts((prev) => prev.map(a => ({ ...a, online: !!onlineMap[a.id]?.online })));
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
    updateConversations(prev => prev.map(c => c.id === String(id) ? { ...c, muted: !!next[String(id)] } : c));
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
      setAvailableContacts((prev) => prev.map(a => ({ ...a, online: a.id === String(userId) ? isOnline : a.online }))); 
      updateConversations((prev) => prev.map(c => ({ ...c, online: c.id === String(userId) ? isOnline : c.online }))); 
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
      const payload = { to, text: input, metadata: { clientId } };
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
      };
      setMessages((prev) => [...prev, optimisticMsg]);
    } catch (e) {
      console.error('Failed to send chat', e);
    }
    setInput("");
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
        width: 480,
        overflowX: 'hidden',
        height: 620,
        bgcolor: "rgba(15, 15, 25, 0.95)",
        overflow: "hidden",
        boxShadow: "0 20px 40px rgba(0,0,0,0.6)",
        backdropFilter: "blur(20px)",
        border: "1px solid rgba(255,255,255,0.08)",
        display: "flex",
        flexDirection: "column",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <Box sx={{ display: "flex", flex: 1, minHeight: 0, overflowX: 'hidden' }}>
        {/* Sidebar */}
        <Box
          sx={{
            bgcolor: "rgba(10, 10, 20, 0.7)",
            borderRight: "1px solid rgba(255,255,255,0.05)",
            width: 260,
            minWidth: 260,
          }}
        >
          <Box sx={{ p: 1 }}>
            <Box
              sx={{
                bgcolor: "rgba(255,255,255,0.08)",
                borderRadius: 3,
                display: "flex",
                alignItems: "center",
                p: 1,
              }}
            >
              <InputBase
                placeholder="Search contacts or conversations"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') doContactSearch(); }}
                sx={{ ml: 1, color: '#ddd', width: '100%' }}
              />
              <IconButton size='small' onClick={() => doContactSearch()}>
                <FiSearch color="#888" />
              </IconButton>
            </Box>
            <Box sx={{ px: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography color='rgba(255,255,255,0.6)' fontSize='0.8rem'>Online</Typography>
              <Typography color='rgba(255,255,255,0.6)' fontSize='0.8rem'>{(availableContacts.filter(c => c.online).length + conversations.filter(c => c.online).length)}</Typography>
            </Box>
          </Box>

          <List sx={{ pt: 0 }}>
            {/* Show contact search results if present */}
            {contactResults.length > 0 && (
              <Box sx={{ px: 1, pb: 1 }}>
                {contactResults.map((c) => (
                  <ListItem key={`contact-${c.id}`} disablePadding>
                    <ListItemButton onClick={() => { setSelected({ id: c.id, name: c.name, avatar: (c.name||'U')[0], unread: 0, muted: (chatMutedMap && chatMutedMap[c.id]) || false }); setContactResults([]); }}>
                      <Badge
                        overlap='circular'
                        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                        badgeContent={c.online ? <Box sx={{ width: 10, height: 10, bgcolor: '#4ade80', borderRadius: '50%', border: '2px solid #0f0f1a' }} /> : null}
                      >
                          {c.avatarUrl ? <Avatar src={c.avatarUrl} sx={{ width: chatSettings.compact ? 28 : 32, height: chatSettings.compact ? 28 : 32, mr: 1 }} /> : <Avatar sx={{ bgcolor: avatarColor(c.name || c.id), width: chatSettings.compact ? 28 : 32, height: chatSettings.compact ? 28 : 32, mr: 1 }}>{getAvatarInitial(c.name, c.id)}</Avatar>}
                      </Badge>
                      <Box>
                        <Typography color='white' fontSize='0.9rem'>{c.name}</Typography>
                            width: chatSettings.compact ? 420 : 480,
                      </Box>
                    </ListItemButton>
                  </ListItem>
                ))}
              </Box>
            )}
            {availableContacts.length > 0 && (
              <Box>
                <Box sx={{ p: 1 }}>
                  <Typography color='rgba(255,255,255,0.6)' fontSize='0.8rem' sx={{ px: 1, mb: 1 }}>Available</Typography>
                </Box>
                <Box sx={{ px: 1, pb: 1 }}>
                  {availableContacts.map((c) => (
                    <ListItem key={`available-${c.id}`} disablePadding>
                      <ListItemButton onClick={() => { setSelected({ id: c.id, name: c.name, avatar: (c.name||'U')[0], unread: 0, muted: (chatMutedMap && chatMutedMap[c.id]) || false }); }}>
                        <Badge
                          overlap='circular'
                          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                          badgeContent={c.online ? <Box sx={{ width: 10, height: 10, bgcolor: '#4ade80', borderRadius: '50%', border: '2px solid #0f0f1a' }} /> : null}
                        >
                          <Avatar sx={{ bgcolor: '#00b0ff', width: 32, height: 32, mr: 1 }}>{getAvatarInitial(c.name, c.id)}</Avatar>
                        </Badge>
                        <Box>
                          <Typography color='white' fontSize='0.9rem'>{c.name}</Typography>
                          <Typography variant='caption' color='rgba(255,255,255,0.5)'>{c.email}</Typography>
                        </Box>
                      </ListItemButton>
                    </ListItem>
                  ))}
                </Box>
              </Box>
            )}
            {conversations.map((c) => (
              <ListItem key={c.id} disablePadding>
                <ListItemButton
                  selected={selected?.id === c.id}
                  onClick={() => setSelected(c)}
                  sx={{
                    flexDirection: "column",
                    position: "relative",
                    bgcolor:
                      selected?.id === c.id
                        ? "rgba(0, 176, 255, 0.15)"
                        : "transparent",
                    "&:hover": { bgcolor: "rgba(0, 176, 255, 0.08)" },
                    borderRadius: 1,
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
                            width: 14,
                            height: 14,
                            bgcolor: "#4ade80",
                            border: "3px solid #0f0f1a",
                            borderRadius: "50%",
                          }}
                        />
                      ) : null
                    }
                  >
                      {c.avatarUrl ? <Avatar src={c.avatarUrl} sx={{ width: 36, height: 36, fontWeight: 'bold', fontSize: '1.1rem', boxShadow: '0 4px 12px rgba(0,176,255,0.3)', }} /> : <Avatar sx={{ width: 36, height: 36, bgcolor: avatarColor(c.name || c.id), fontWeight: 'bold', fontSize: '1.1rem', boxShadow: '0 4px 12px rgba(0,176,255,0.3)', }} >{c.avatar || getAvatarInitial(c.name, c.id)}</Avatar>}
                  </Badge>

                  <Box sx={{ ml: 1, flex: 1, textAlign: 'left' }}>
                    <Typography fontWeight={600} color='white' sx={{ fontSize: chatSettings.compact ? '0.85rem' : '0.95rem' }}>{c.name}</Typography>
                    <Typography variant='caption' color='rgba(255,255,255,0.5)' sx={{ display: 'block' , fontSize: chatSettings.compact ? '0.7rem' : '0.8rem' }}>{c.lastMsg}</Typography>
                  </Box>
                  <Box sx={{ position: 'absolute', top: 6, right: 48 }}>
                    <Typography variant='caption' color='rgba(255,255,255,0.5)'>{typeof c.time === 'string' ? c.time : (c.time ? new Date(c.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '')}</Typography>
                  </Box>
                  <Box sx={{ position: 'absolute', top: 6, right: 20 }}>
                    <IconButton size='small' onClick={(e) => { e.stopPropagation(); toggleMute(c.id); }} sx={{ color: 'rgba(255,255,255,0.7)' }} title={chatMutedMap && chatMutedMap[c.id] ? 'Unmute' : 'Mute'}>
                      {chatMutedMap && chatMutedMap[c.id] ? <FiBellOff /> : <FiBell />}
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
            <IconButton size='small' onClick={() => { refreshPresenceDebug(); }} sx={{ ml: 1, color: 'white' }} title='Refresh Presence (debug)'><FiRefreshCw /></IconButton>
            <IconButton size='small' onClick={() => toggleMuteSelected()} sx={{ ml: 1, color: 'white' }} title={selected && selected.id && (chatMutedMap[selected.id] ? 'Unmute' : 'Mute')}>{(selected && selected.id && chatMutedMap[selected.id]) ? <FiBellOff /> : <FiBell />}</IconButton>
            <IconButton size='small' onClick={(e) => setSettingsAnchor(e.currentTarget)} sx={{ ml: 1, color: 'white' }} title='Chat Settings'><FiSettings /></IconButton>
            <Popover
              open={Boolean(settingsAnchor)}
              anchorEl={settingsAnchor}
              onClose={() => setSettingsAnchor(null)}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
              <Box sx={{ p: 2, width: 240 }}>
                <Typography variant='subtitle1' sx={{ mb: 1 }}>Chat settings</Typography>
                <FormControlLabel control={<Switch checked={chatSettings.sound} onChange={(e) => { const next = { ...chatSettings, sound: e.target.checked }; setChatSettings(next); try { localStorage.setItem('chatSettings', JSON.stringify(next)); } catch (x) {} if (e.target.checked) { try { const ctx = new (window.AudioContext || window.webkitAudioContext)(); const o = ctx.createOscillator(); const g = ctx.createGain(); o.type='sine'; o.frequency.value=880; o.connect(g); g.connect(ctx.destination); o.start(); setTimeout(() => { try { o.stop(); ctx.close(); } catch (_) {} }, 120); } catch(_){} } }} />} label='Sound' />
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 1 }}>
                  <select value={soundFile} onChange={(e) => { const next = e.target.value; setSoundFile(next); try { localStorage.setItem('chatSoundFile', next); } catch (_) {} }} style={{ padding: 6, background: 'transparent', color: '#fff', borderRadius: 6, border: '1px solid rgba(255,255,255,0.06)' }}>
                    <option value="/sounds/chat-notify.mp3">Default</option>
                    <option value="/sounds/chat-success.mp3">Chime</option>
                    <option value="/sounds/chat-pop.mp3">Pop</option>
                  </select>
                  <Button size='small' onClick={() => { try { if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; audioRef.current.play().catch(e => {}); } } catch(e) {} }}>Test</Button>
                  <input type='file' accept='audio/*' onChange={(e) => { const f = e.target.files?.[0]; if (f) { const url = URL.createObjectURL(f); setSoundFile(url); try { localStorage.setItem('chatSoundFile', url); } catch (_) {} } }} style={{ display: 'inline-block' }} title='Upload custom sound' />
                </Box>
                <FormControlLabel control={<Switch checked={chatSettings.desktop} onChange={(e) => { const next = { ...chatSettings, desktop: e.target.checked }; setChatSettings(next); try { localStorage.setItem('chatSettings', JSON.stringify(next)); } catch (x) {} if (e.target.checked && typeof Notification !== 'undefined' && Notification.permission === 'default') { try { Notification.requestPermission(); } catch(_){} } }} />} label='Desktop notifications' />
                <FormControlLabel control={<Switch checked={chatSettings.badge} onChange={(e) => { const next = { ...chatSettings, badge: e.target.checked }; setChatSettings(next); try { localStorage.setItem('chatSettings', JSON.stringify(next)); } catch (x) {} }} />} label='Show tray badge' />
                <FormControlLabel control={<Switch checked={chatSettings.compact} onChange={(e) => { const next = { ...chatSettings, compact: e.target.checked }; setChatSettings(next); try { localStorage.setItem('chatSettings', JSON.stringify(next)); } catch (x) {} }} />} label='Compact view' />
              </Box>
            </Popover>
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
            }}
          >
            {page < totalPages && (
              <Box sx={{ mb: 1, display: 'flex', justifyContent: 'center' }}>
                <IconButton size='small' onClick={loadMoreMessages} sx={{ bgcolor: 'rgba(255,255,255,0.03)', color: '#ddd' }}>Load more</IconButton>
              </Box>
            )}
            {messages.map((msg) => (
              <Box
                key={msg.id}
                sx={{
                  mb: 2.5,
                  display: "flex",
                  justifyContent:
                    msg.sender === "me" ? "flex-end" : "flex-start",
                }}
              >
                            {msg.sender !== 'me' && (
                              <Box sx={{ display: 'flex', alignItems: 'flex-end', mr: 1 }}>
                                {msg.avatarUrl ? <Avatar src={msg.avatarUrl} sx={{ width: chatSettings.compact ? 22 : 28, height: chatSettings.compact ? 22 : 28 }} /> : <Avatar sx={{ bgcolor: avatarColor(msg.displayName || msg.avatarInitial), width: chatSettings.compact ? 22 : 28, height: chatSettings.compact ? 22 : 28, fontSize: '0.9rem' }}>{msg.avatarInitial || 'U'}</Avatar>}
                              </Box>
                            )}
                <Box
                  sx={{
                    maxWidth: "82%",
                    ml: msg.sender === 'me' ? 0 : 1,
                    px: chatSettings.compact ? 1.5 : 2.5,
                    py: chatSettings.compact ? 1 : 1.8,
                    borderRadius: 3,
                    borderTopLeftRadius: msg.sender === "me" ? 18 : 4,
                    borderTopRightRadius: msg.sender === "me" ? 4 : 18,
                    borderBottomLeftRadius: msg.sender === "me" ? 18 : 18,
                    borderBottomRightRadius: msg.sender === "me" ? 4 : 18,
                    bgcolor:
                    msg.sender === "me"
                      ? "linear-gradient(135deg, #00b0ff, #0b93f6)"
                      : "rgba(230,230,235,0.95)",
                    color: msg.sender === "me" ? "white" : "#111",
                    boxShadow:
                    msg.sender === "me"
                      ? "0 8px 20px rgba(0,176,255,0.3)"
                      : "none",
                    backdropFilter: "blur(10px)",
                    position: "relative",
                    transition: 'transform 140ms ease, box-shadow 140ms ease',
                  }}
                >
                  <Typography
                    variant="body1"
                    sx={{ lineHeight: 1.4, wordBreak: "break-word", whiteSpace: 'pre-wrap', fontSize: chatSettings.compact ? '0.92rem' : '1rem' }}
                  >
                    {msg.text}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      opacity: 0.7,
                      fontSize: "0.7rem",
                      display: "block",
                      textAlign: "right",
                      mt: 0.5,
                    }}
                  >
                    {msg.time}
                  </Typography>
                  {msg.sender === 'me' && (
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                      {msg.read ? <FiCheck size={14} color='#4ade80' /> : <Typography variant='caption' sx={{ opacity: 0.6, fontSize: '0.65rem' }}>Sent</Typography>}
                    </Box>
                  )}
                </Box>
              </Box>
            ))}
            <div ref={messagesEndRef} />
          </Box>

          {/* Input */}
          <Box
            sx={{
              borderTop: "1px solid rgba(255,255,255,0.08)",
              bgcolor: "rgba(15,15,25,0.8)",
            }}
          >
            <InputBase
              fullWidth
              multiline
              maxRows={4}
              placeholder="Type a message..."
              value={input}
              onChange={(e) => { setInput(e.target.value); startTyping(); }}
              onKeyDown={(e) =>
                e.key === "Enter" &&
                !e.shiftKey &&
                (e.preventDefault(), sendMessage())
              }
              sx={{
                bgcolor: "rgba(255,255,255,0.07)",
                px: 3,
                py: 1,
                color: "white",
                fontSize: "1rem",
                backdropFilter: "blur(10px)",
                border: "1px solid rgba(255,255,255,0.1)",
                "&:hover": { borderColor: "rgba(0,176,255,0.4)" },
                "&:focus": { outline: "none", borderColor: "#00b0ff" },
              }}
              endAdornment={
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
              }
            />
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
