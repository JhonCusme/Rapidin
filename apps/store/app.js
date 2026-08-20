/* ==========================================================================
   RAPIDIN - PANEL DE COMERCIOS (Acceso, Dashboard, Pedidos)
   ========================================================================== */

function fmtMoneyStore(n) { return '$' + Number(n || 0).toFixed(2); }

let currentOrdersTab = 'all';
let currentOrdersCache = [];
let currentRejectingOrderId = null;

// ==========================================
// AUTH GATE
// ==========================================
function checkAuthGate() {
  const store = window.rapidinDB.getCurrentUser('store');
  if (store) {
    document.getElementById('auth-gate-screen').style.display = 'none';
    document.getElementById('main-app-content').style.display = 'block';
    document.getElementById('store-header-name').textContent = store.name || 'Comercio';
    loadDashboard();
    loadStoreOrders();
  } else {
    document.getElementById('auth-gate-screen').style.display = 'flex';
    document.getElementById('main-app-content').style.display = 'none';
  }
}

document.getElementById('gate-store-form-login')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('gate-store-login-email').value;
  const pass = document.getElementById('gate-store-login-password').value;
  const errorEl = document.getElementById('gate-login-error');
  errorEl.style.display = 'none';

  const res = await window.rapidinDB.login(email, pass, 'store');
  if (res.success) {
    checkAuthGate();
  } else {
    errorEl.textContent = res.message || 'No se pudo iniciar sesión.';
    errorEl.style.display = 'block';
  }
});

document.getElementById('form-store-register')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const storeData = {
    role: 'store',
    name: document.getElementById('reg-store-name').value,
    category: document.getElementById('reg-store-cat').value,
    email: document.getElementById('reg-store-email').value,
    password: document.getElementById('reg-store-password').value,
    address: document.getElementById('reg-store-address').value
  };

  const errorEl = document.getElementById('register-error');
  errorEl.style.display = 'none';

  const res = await window.rapidinDB.registerUser(storeData);
  if (res.success) {
    document.getElementById('modal-store-register').classList.remove('active');
    window.rapidinAlert(`🏪 ¡Comercio "${storeData.name}" registrado correctamente!`);
    checkAuthGate();
  } else {
    errorEl.textContent = res.message || 'No se pudo completar el registro.';
    errorEl.style.display = 'block';
  }
});

document.getElementById('btn-close-store-reg')?.addEventListener('click', () => {
  document.getElementById('modal-store-register').classList.remove('active');
});

document.getElementById('btn-store-logout')?.addEventListener('click', () => {
  if (!confirm('¿Deseas cerrar sesión?')) return;
  window.rapidinDB.logout('store');
  window.location.reload();
});

// ==========================================
// DASHBOARD
// ==========================================
async function loadDashboard() {
  const data = await window.rapidinDB.getStoreDashboard();
  if (!data) return;

  document.getElementById('stat-new-count').textContent = data.newCount;
  document.getElementById('stat-preparing-count').textContent = data.preparingCount;
  document.getElementById('stat-ready-count').textContent = data.readyCount;
  document.getElementById('stat-today-sales').textContent = fmtMoneyStore(data.todaySales);
  document.getElementById('stat-today-orders').textContent = data.todayOrders;

  if (data.rating != null) {
    document.getElementById('store-header-rating').textContent = `⭐ ${data.rating}`;
  }

  renderStatusPill(data.isOpen, data.pausedUntil);
}

function renderStatusPill(isOpen, pausedUntil) {
  const pill = document.getElementById('btn-toggle-store-status');
  const text = document.getElementById('store-status-text');
  const paused = pausedUntil && new Date(pausedUntil + 'Z') > new Date();

  pill.classList.remove('paused', 'closed');
  if (!isOpen) {
    pill.classList.add('closed');
    text.textContent = 'CERRADO';
  } else if (paused) {
    pill.classList.add('paused');
    const mins = Math.max(1, Math.round((new Date(pausedUntil + 'Z') - new Date()) / 60000));
    text.textContent = `PAUSADO • reactiva en ${mins} min`;
  } else {
    text.textContent = 'ABIERTO • RECIBIENDO PEDIDOS';
  }
}

document.getElementById('btn-toggle-store-status')?.addEventListener('click', () => {
  const pill = document.getElementById('btn-toggle-store-status');
  if (pill.classList.contains('paused') || pill.classList.contains('closed')) {
    if (confirm('¿Quieres volver a recibir pedidos ahora?')) resumeStoreOrders();
  } else {
    document.getElementById('modal-pause-orders').classList.add('active');
  }
});

window.pauseStoreOrders = async function(minutes) {
  document.getElementById('modal-pause-orders').classList.remove('active');
  const payload = minutes === null ? { isOpen: false } : { pauseMinutes: minutes };
  const res = await window.rapidinDB.updateStoreStatus(payload);
  if (res.success) {
    renderStatusPill(res.isOpen, res.pausedUntil);
    window.rapidinAlert(minutes === null ? 'Negocio cerrado. Actívalo cuando quieras seguir recibiendo pedidos.' : `Pausado por ${minutes} minutos.`);
  } else {
    window.rapidinAlert(res.message || 'No se pudo actualizar el estado.');
  }
};

// Reactivar (llamado cuando el negocio está pausado o cerrado y el comercio toca el pill)
async function resumeStoreOrders() {
  const res = await window.rapidinDB.updateStoreStatus({ isOpen: true, resume: true });
  if (res.success) {
    renderStatusPill(res.isOpen, res.pausedUntil);
    window.rapidinAlert('¡Ya estás recibiendo pedidos de nuevo!');
  }
}

// ==========================================
// PEDIDOS
// ==========================================
window.switchOrdersTab = function(tab) {
  currentOrdersTab = tab;
  document.querySelectorAll('.order-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  renderOrdersList();
};

function filterOrdersByTab(orders, tab) {
  switch (tab) {
    case 'new': return orders.filter(o => !o.is_cancelled && o.status_step === 0);
    case 'preparing': return orders.filter(o => !o.is_cancelled && o.status_step === 1);
    case 'ready': return orders.filter(o => !o.is_cancelled && o.status_step === 2);
    case 'completed': return orders.filter(o => !o.is_cancelled && o.status_step >= 4);
    case 'cancelled': return orders.filter(o => o.is_cancelled);
    default: return orders;
  }
}

async function loadStoreOrders() {
  const store = window.rapidinDB.getCurrentUser('store');
  if (!store || !store.storeId) return;
  currentOrdersCache = await window.rapidinDB.getStoreOrders(store.storeId);
  renderOrdersList();
}

function orderStatusLabel(order) {
  if (order.is_cancelled) return { text: order.cancel_reason || 'Cancelado', color: '#EF4444' };
  const labels = ['🔴 Nuevo, esperando confirmación', '🟠 En preparación', '🟢 Listo, esperando repartidor', '🚴 En camino', '✅ Entregado'];
  const colors = ['var(--brand-primary)', '#F59E0B', '#10B981', '#3B82F6', '#10B981'];
  return { text: order.status_text || labels[order.status_step] || '', color: colors[order.status_step] || 'var(--text-primary)' };
}

function orderActionsHtml(order) {
  if (order.is_cancelled || order.status_step >= 3) return '';
  if (order.status_step === 0) {
    return `
      <button class="btn-action-store" onclick="acceptOrder('${order.id}')">
        <i class="fa-solid fa-check"></i> Aceptar
      </button>
      <button class="btn-action-store danger" onclick="openRejectModal('${order.id}')">
        <i class="fa-solid fa-xmark"></i> Rechazar
      </button>
    `;
  }
  if (order.status_step === 1) {
    return `
      <button class="btn-action-store" style="background: #10B981;" onclick="markOrderReady('${order.id}')">
        <i class="fa-solid fa-bag-shopping"></i> Marcar listo
      </button>
    `;
  }
  if (order.status_step === 2) {
    return `<span class="badge" style="background: rgba(16,185,129,0.15); color: #10B981; padding: 0.5rem 1rem;"><i class="fa-solid fa-clock"></i> Esperando que un repartidor lo recoja</span>`;
  }
  return '';
}

function renderOrdersList() {
  const listEl = document.getElementById('store-orders-list');
  if (!listEl) return;

  const orders = filterOrdersByTab(currentOrdersCache, currentOrdersTab);

  if (!orders.length) {
    listEl.innerHTML = `
      <div style="text-align: center; padding: 3rem; background: var(--bg-card); border-radius: var(--radius-lg); border: 1px solid var(--border-color);">
        <i class="fa-solid fa-receipt" style="font-size: 3rem; color: var(--text-muted); margin-bottom: 1rem;"></i>
        <h3>No hay pedidos en esta categoría</h3>
        <p style="color: var(--text-secondary);">Los nuevos pedidos aparecerán aquí automáticamente.</p>
      </div>
    `;
    return;
  }

  listEl.innerHTML = orders.map(order => {
    const status = orderStatusLabel(order);
    const items = order.items || [];
    const date = order.created_at ? new Date(order.created_at.replace(' ', 'T') + 'Z').toLocaleString('es-PE', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }) : '';
    return `
      <div class="order-card-store ${order.status_step === 0 && !order.is_cancelled ? 'new-alert' : ''}">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.5rem;">
          <div>
            <span class="badge" style="background: var(--brand-primary); color: #fff; margin-bottom: 0.4rem;">PEDIDO #${escapeHtml(order.id)}</span>
            <h3 style="font-size: 1.1rem;">${escapeHtml(order.customerName || 'Cliente')}</h3>
            <span style="font-size: 0.82rem; color: var(--text-secondary);"><i class="fa-solid fa-location-dot"></i> ${escapeHtml(order.customer_address || '')} • ${escapeHtml(date)}</span>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 1.3rem; font-weight: 900; color: #10B981;">${fmtMoneyStore(order.total_amount_usd)}</div>
          </div>
        </div>

        <div style="background: var(--bg-main); padding: 1rem; border-radius: var(--radius-md); margin-bottom: 1rem;">
          <div style="font-size: 0.8rem; font-weight: 700; color: var(--text-muted); margin-bottom: 0.5rem; text-transform: uppercase;">Productos:</div>
          ${items.map(item => `
            <div style="display: flex; justify-content: space-between; font-size: 0.9rem; padding: 0.25rem 0;">
              <span><strong>${item.quantity}x</strong> ${escapeHtml(item.name)}</span>
              <span style="font-weight: 700;">${fmtMoneyStore(item.price * item.quantity)}</span>
            </div>
          `).join('')}
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
          <span style="font-weight: 700; font-size: 0.9rem; color: ${status.color};">${escapeHtml(status.text)}</span>
          <div style="display: flex; gap: 0.6rem; flex-wrap: wrap;">${orderActionsHtml(order)}</div>
        </div>
      </div>
    `;
  }).join('');
}

window.acceptOrder = async function(orderId) {
  const res = await window.rapidinDB.updateOrderStatusAsStore(orderId, 1, 'El comercio aceptó tu pedido y lo está preparando 👨‍🍳');
  if (!res.success && window.rapidinAlert) window.rapidinAlert(res.message || 'No se pudo aceptar el pedido.');
  loadStoreOrders();
  loadDashboard();
};

window.markOrderReady = async function(orderId) {
  const res = await window.rapidinDB.updateOrderStatusAsStore(orderId, 2, 'Tu pedido está listo, esperando repartidor 🛍️');
  if (!res.success && window.rapidinAlert) window.rapidinAlert(res.message || 'No se pudo marcar el pedido como listo.');
  loadStoreOrders();
  loadDashboard();
};

window.openRejectModal = function(orderId) {
  currentRejectingOrderId = orderId;
  document.getElementById('modal-reject-order').classList.add('active');
};

document.getElementById('form-reject-order')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentRejectingOrderId) return;
  const reason = document.getElementById('reject-reason-select').value;
  const res = await window.rapidinDB.rejectOrder(currentRejectingOrderId, reason);
  document.getElementById('modal-reject-order').classList.remove('active');
  currentRejectingOrderId = null;
  if (res.success) {
    loadStoreOrders();
    loadDashboard();
  } else {
    window.rapidinAlert(res.message || 'No se pudo rechazar el pedido.');
  }
});

// ==========================================
// TIEMPO REAL
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  checkAuthGate();

  window.rapidinSync.subscribe('ORDER_CREATED', (payload) => {
    const store = window.rapidinDB.getCurrentUser('store');
    if (!store || payload.storeId !== store.storeId) return;
    loadStoreOrders();
    loadDashboard();
  });

  window.rapidinSync.subscribe('ORDER_STATUS_CHANGED', () => {
    loadStoreOrders();
    loadDashboard();
  });
});
