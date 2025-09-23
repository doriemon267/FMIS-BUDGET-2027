import CustomSnackbar from './CustomSnackbar';
import { createRoot } from 'react-dom/client';

// Global notification system for real-time updates
class NotificationManager {
  constructor() {
    this.container = null;
    this.root = null;
    this.currentSnackbar = null;
    this.isVisible = false;
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

  show(message, severity = 'info', duration = 6000, onClick = null) {
    this.init();
    this.isVisible = true;

    const NotificationComponent = () => (
      <CustomSnackbar
        open={this.isVisible}
        message={message}
        severity={severity}
        autoHideDuration={duration}
        onClose={() => this.hide()}
        onClick={onClick}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      />
    );

    this.root.render(<NotificationComponent />);
    this.currentSnackbar = NotificationComponent;

    // Auto-hide after duration
    setTimeout(() => {
      this.hide();
    }, duration);
  }

  hide() {
    if (!this.root) return;
    this.isVisible = false;
    this.root.render(null);
    this.currentSnackbar = null;
  }

  success(message, duration, onClick = null) {
    this.show(message, 'success', duration, onClick);
  }

  error(message, duration, onClick = null) {
    this.show(message, 'error', duration, onClick);
  }

  warning(message, duration, onClick = null) {
    this.show(message, 'warning', duration, onClick);
  }

  info(message, duration, onClick = null) {
    this.show(message, 'info', duration, onClick);
  }
}

// Create global instance
const notificationManager = new NotificationManager();

// Make it globally available
if (typeof window !== 'undefined') {
  window.showSnackbar = (message, severity = 'info', duration = 6000, onClick = null) => {
    notificationManager.show(message, severity, duration, onClick);
  };
  window.showSuccess = (message, duration, onClick = null) => notificationManager.success(message, duration, onClick);
  window.showError = (message, duration, onClick = null) => notificationManager.error(message, duration, onClick);
  window.showWarning = (message, duration, onClick = null) => notificationManager.warning(message, duration, onClick);
  window.showInfo = (message, duration, onClick = null) => notificationManager.info(message, duration, onClick);
}

export default notificationManager;