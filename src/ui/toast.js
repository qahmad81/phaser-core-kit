/**
 * Create a simple toast notification system.
 * The toast will appear at the bottom of the container and disappear after a short delay.
 *
 * @param {HTMLElement} container Parent container to attach toast overlay.
 * @returns {(msg: string, duration?: number) => void}
 */
export function createToast(container) {
  let toastEl = document.createElement('div');
  toastEl.className = 'pcore-toast';
  Object.assign(toastEl.style, {
    position: 'absolute',
    bottom: '1rem',
    left: '50%',
    transform: 'translateX(-50%)',
    padding: '0.5rem 1rem',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    color: '#fff',
    borderRadius: '4px',
    fontFamily: 'sans-serif',
    opacity: '0',
    transition: 'opacity 0.3s',
    pointerEvents: 'none',
    zIndex: 950,
  });
  container.appendChild(toastEl);
  let hideTimeout;
  return function toast(msg, duration = 2000) {
    toastEl.textContent = msg;
    toastEl.style.opacity = '1';
    clearTimeout(hideTimeout);
    hideTimeout = setTimeout(() => {
      toastEl.style.opacity = '0';
    }, duration);
  };
}