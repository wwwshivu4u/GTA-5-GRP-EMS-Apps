/**
 * UI Toast Notification System.
 */
window.MarketApp = window.MarketApp || {};

(function(exports) {
  let container = null;

  function ensureContainer() {
    if (!container || !document.body.contains(container)) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'fixed bottom-5 right-5 z-50 flex flex-col space-y-2 pointer-events-none max-w-sm w-full px-4 sm:px-0';
      document.body.appendChild(container);
    }
    return container;
  }

  function showToast(message, type = 'info', duration = 3200) {
    const parent = ensureContainer();
    const toast = document.createElement('div');
    toast.className = 'toast-item pointer-events-auto flex items-center justify-between p-3.5 rounded-xl border text-xs font-medium backdrop-blur-md transition-all duration-300 transform translate-y-4 opacity-0';

    let icon = 'ℹ️';
    let themeClasses = 'bg-gray-900/90 border-gray-700 text-gray-200';

    if (type === 'success') {
      icon = '✅';
      themeClasses = 'bg-emerald-950/90 border-emerald-600/50 text-emerald-200 shadow-emerald-950/50';
    } else if (type === 'warning') {
      icon = '⚠️';
      themeClasses = 'bg-amber-950/90 border-amber-600/50 text-amber-200 shadow-amber-950/50';
    } else if (type === 'error') {
      icon = '❌';
      themeClasses = 'bg-red-950/90 border-red-600/50 text-red-200 shadow-red-950/50';
    }

    toast.className += ` ${themeClasses}`;
    toast.innerHTML = `
      <div class="flex items-center space-x-2.5">
        <span class="text-sm">${icon}</span>
        <span class="leading-snug">${message}</span>
      </div>
      <button class="ml-3 text-gray-400 hover:text-white text-base leading-none p-1">&times;</button>
    `;

    const closeBtn = toast.querySelector('button');
    closeBtn.addEventListener('click', () => removeToast(toast));

    parent.appendChild(toast);

    // Trigger enter animation
    requestAnimationFrame(() => {
      toast.classList.remove('translate-y-4', 'opacity-0');
      toast.classList.add('translate-y-0', 'opacity-100');
    });

    // Auto-dismiss
    const timer = setTimeout(() => {
      removeToast(toast);
    }, duration);

    toast.dataset.timer = timer;
  }

  function removeToast(toast) {
    if (toast.dataset.timer) {
      clearTimeout(parseInt(toast.dataset.timer, 10));
    }
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 250);
  }

  exports.Notifications = {
    show: showToast,
    success: (msg, dur) => showToast(msg, 'success', dur),
    warning: (msg, dur) => showToast(msg, 'warning', dur),
    error: (msg, dur) => showToast(msg, 'error', dur),
    info: (msg, dur) => showToast(msg, 'info', dur)
  };
})(window.MarketApp);
