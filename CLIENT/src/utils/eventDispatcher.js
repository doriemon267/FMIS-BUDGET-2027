// Centralized event dispatch helpers for the client app

export function safeDispatchEvent(name, detail = {}) {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
  try {
    // Defer dispatch to next task to avoid setState-in-render warnings.
    setTimeout(() => {
      try { window.dispatchEvent(new CustomEvent(name, { detail })); } catch (e) { /* ignore */ }
    }, 0);
  } catch (err) {
    // ignore
  }
}

export function dispatchChatUnread(count) {
  safeDispatchEvent('chat-unread', { count });
}

export default { safeDispatchEvent, dispatchChatUnread };
