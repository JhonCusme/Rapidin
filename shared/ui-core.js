/* ==========================================================================
   RAPIDIN - UI CORE UTILITIES (TOASTS, ANIMATIONS)
   ========================================================================== */

// Escapa texto antes de insertarlo con innerHTML, para evitar XSS con datos
// que vienen de otros usuarios (nombres, direcciones, mensajes de chat, etc).
window.escapeHtml = function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

class RapidinUI {
  constructor() {
    this.toastContainer = null;
    this.initToastContainer();
  }

  initToastContainer() {
    if (document.getElementById('rapidin-toast-container')) {
      this.toastContainer = document.getElementById('rapidin-toast-container');
      return;
    }
    this.toastContainer = document.createElement('div');
    this.toastContainer.id = 'rapidin-toast-container';
    this.toastContainer.className = 'rapidin-toast-container';
    document.body.appendChild(this.toastContainer);
  }

  showToast(title, message, type = 'info') {
    if (!this.toastContainer) this.initToastContainer();

    const toast = document.createElement('div');
    toast.className = 'rapidin-toast';

    let icon = 'fa-info-circle';
    let color = 'var(--brand-info)';
    if (type === 'success') { icon = 'fa-check-circle'; color = 'var(--brand-success)'; }
    else if (type === 'error') { icon = 'fa-times-circle'; color = 'var(--brand-primary)'; }
    else if (type === 'warning') { icon = 'fa-exclamation-triangle'; color = 'var(--brand-warning)'; }

    toast.innerHTML = `
      <div class="rapidin-toast-icon" style="color: ${color}">
        <i class="fa-solid ${icon}"></i>
      </div>
      <div>
        <h4 style="margin: 0; font-size: 0.95rem; font-weight: 700;">${escapeHtml(title)}</h4>
        <p style="margin: 0; font-size: 0.85rem; color: var(--text-secondary);">${escapeHtml(message)}</p>
      </div>
    `;

    this.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('hiding');
      toast.addEventListener('animationend', () => {
        if (this.toastContainer.contains(toast)) {
          this.toastContainer.removeChild(toast);
        }
      });
    }, 4000);
  }
}

window.rapidinUI = new RapidinUI();

// Utilidad global para reemplazar window.alert si se desea
window.rapidinAlert = (msg) => window.rapidinUI.showToast('Atención', msg, 'info');
