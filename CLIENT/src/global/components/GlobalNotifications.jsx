import { Snackbar, Alert } from '@mui/material';
import { createRoot } from 'react-dom/client';

// Global notification system for real-time updates
class NotificationManager {
  constructor() {
    this.container = null;
    this.root = null;
    this.currentSnackbar = null;
  }

  init() {
    // Create container if it doesn't exist
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = 'global-notifications';
      document.body.appendChild(this.container);
      this.root = createRoot(this.container);
    }
  }

  show(message, severity = 'info', duration = 6000) {
    this.init();

    const NotificationComponent = () => (
      <Snackbar
        open={true}
        autoHideDuration={duration}
        onClose={() => this.hide()}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert
          onClose={() => this.hide()}
          severity={severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {message}
        </Alert>
      </Snackbar>
    );

    this.root.render(<NotificationComponent />);
    this.currentSnackbar = NotificationComponent;

    // Auto-hide after duration
    setTimeout(() => {
      this.hide();
    }, duration);
  }

  hide() {
    if (this.root && this.currentSnackbar) {
      this.root.render(null);
      this.currentSnackbar = null;
    }
  }

  success(message, duration) {
    this.show(message, 'success', duration);
  }

  error(message, duration) {
    this.show(message, 'error', duration);
  }

  warning(message, duration) {
    this.show(message, 'warning', duration);
  }

  info(message, duration) {
    this.show(message, 'info', duration);
  }
}

// Create global instance
const notificationManager = new NotificationManager();

// Make it globally available
if (typeof window !== 'undefined') {
  window.showSnackbar = (message, severity = 'info', duration = 6000) => {
    notificationManager.show(message, severity, duration);
  };
  window.showSuccess = (message, duration) => notificationManager.success(message, duration);
  window.showError = (message, duration) => notificationManager.error(message, duration);
  window.showWarning = (message, duration) => notificationManager.warning(message, duration);
  window.showInfo = (message, duration) => notificationManager.info(message, duration);
}

export default notificationManager;