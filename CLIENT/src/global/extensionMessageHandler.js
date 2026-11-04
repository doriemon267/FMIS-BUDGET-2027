/**
 * Extension Message Handler
 * Intercepts and gracefully handles any browser extension communication
 * to prevent "Uncaught (in promise) Error: A listener indicated an asynchronous response..."
 * 
 * This prevents console errors from extensions like PNPKI trying to communicate with the page.
 */

(function () {
  if (
    typeof window === 'undefined' ||
    typeof chrome === 'undefined' ||
    !chrome.runtime?.onMessage ||
    typeof chrome.runtime.onMessage.addListener !== 'function'
  ) {
    return;
  }

  // Store original onMessage listener setup
  const originalAddListener = chrome.runtime.onMessage.addListener;

  // Wrap the addListener to handle any external extension messages
  if (originalAddListener) {
    chrome.runtime.onMessage.addListener = function (callback, ...args) {
      // Create a wrapper that ensures we always send a response
      const wrappedCallback = (message, sender, sendResponse) => {
        try {
          // Call the original callback
          const result = callback(message, sender, (response) => {
            try {
              // Ensure sendResponse is called safely
              if (typeof sendResponse === 'function') {
                sendResponse(response);
              }
            } catch (e) {
              console.warn('[Extension Handler] Error sending response:', e?.message);
            }
          });

          // If callback returns true, we need to ensure a response is sent
          if (result === true) {
            // Always send an acknowledgment if one wasn't sent already
            try {
              if (typeof sendResponse === 'function') {
                // Send a minimal response to satisfy the async contract
                sendResponse({ received: true });
              }
            } catch (e) {
              // Port might be closed, which is expected in some cases
              console.warn('[Extension Handler] Could not send response (port closed):', e?.message);
            }
          }

          return result;
        } catch (e) {
          console.warn('[Extension Handler] Error in message handler:', e?.message);
          // Attempt to send error response
          try {
            if (typeof sendResponse === 'function') {
              sendResponse({ error: e?.message });
            }
          } catch (err) {
            // Ignore if port is already closed
          }
          return false;
        }
      };

      // Call the original addListener with wrapped callback
      return originalAddListener.call(this, wrappedCallback, ...args);
    };
  }

  // Also set up a catch-all listener if no other listener has been set up
  // This prevents "Could not establish connection" errors
  try {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      // This is a fallback handler for messages not caught by application code
      try {
        // Try to send a response if this looks like it expects one
        sendResponse({ status: 'received', fromPage: true });
      } catch (e) {
        // Port already closed, this is normal
      }
      return false; // Don't keep the port open if no async operations
    });
  } catch (e) {
    // In case the API is restricted, just silently fail
  }
})();
