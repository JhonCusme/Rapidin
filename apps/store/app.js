/* ==========================================================================
   RAPIDIN - PANEL DE COMERCIOS (Acceso, Dashboard, Pedidos)
   ========================================================================== */

function fmtMoneyStore(n) { return '$' + Number(n || 0).toFixed(2); }

let currentOrdersTab = 'all';
let currentOrdersCache = [];
let currentRejectingOrderId = null;
let currentCategoriesCache = [];
let currentProductsCache = [];
let currentCatalogFilter = 'all';
let currentOptionGroups = [];

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
    loadCatalog();
  } else {
    document.getElementById('auth-gate-screen').style.display = 'flex';
    document.getElementById('main-app-content').style.display = 'none';
  }
}

// ==========================================
// NAVEGACIÓN PRINCIPAL
// ==========================================
window.switchMainView = function(view) {
  document.querySelectorAll('.main-nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  ['inicio', 'pedidos', 'catalogo', 'resenas', 'promos'].forEach(v => {
    document.getElementById('view-' + v).style.display = v === view ? 'block' : 'none';
  });
  if (view === 'resenas') loadReviews();
  if (view === 'promos') loadPromotions();
};

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
// CATÁLOGO: CATEGORÍAS
// ==========================================
async function loadCatalog() {
  const store = window.rapidinDB.getCurrentUser('store');
  if (!store) return;
  currentCategoriesCache = await window.rapidinDB.getStoreCategories();
  currentProductsCache = await window.rapidinDB.getStoreProducts();
  renderCategoryFilters();
  renderCategorySelectOptions();
  renderCatalogGrid();
}

function renderCategoryFilters() {
  const container = document.getElementById('catalog-category-filters');
  const chips = ['<button type="button" class="category-chip ' + (currentCatalogFilter === 'all' ? 'active' : '') + '" data-cat="all" onclick="filterCatalogByCategory(\'all\')">Todos</button>'];
  currentCategoriesCache.forEach(c => {
    chips.push(`<button type="button" class="category-chip ${currentCatalogFilter === c.id ? 'active' : ''}" data-cat="${c.id}" onclick="filterCatalogByCategory('${c.id}')">${escapeHtml(c.name)}</button>`);
  });
  container.innerHTML = chips.join('');
}

function renderCategorySelectOptions() {
  const select = document.getElementById('product-category-input');
  const current = select.value;
  select.innerHTML = '<option value="">Sin categoría</option>' + currentCategoriesCache.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
  select.value = current;
}

window.filterCatalogByCategory = function(catId) {
  currentCatalogFilter = catId;
  renderCategoryFilters();
  renderCatalogGrid();
};

window.openCategoryModal = function() {
  document.getElementById('modal-categories').classList.add('active');
  renderCategoriesManageList();
};

function renderCategoriesManageList() {
  const list = document.getElementById('categories-manage-list');
  if (!currentCategoriesCache.length) {
    list.innerHTML = '<p style="color: var(--text-secondary); font-size: 0.85rem; text-align: center; padding: 1rem 0;">Todavía no tienes categorías.</p>';
    return;
  }
  list.innerHTML = currentCategoriesCache.map(c => `
    <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.6rem 0; border-bottom: 1px solid var(--border-color);">
      <span style="font-weight: 700;">${escapeHtml(c.name)}</span>
      <div style="display: flex; gap: 0.5rem;">
        <button type="button" class="btn-action-store outline" style="padding: 0.3rem 0.6rem; font-size: 0.75rem;" onclick="renameCategory('${c.id}', '${escapeHtml(c.name).replace(/'/g, "\\'")}')"><i class="fa-solid fa-pen"></i></button>
        <button type="button" class="btn-action-store danger" style="padding: 0.3rem 0.6rem; font-size: 0.75rem;" onclick="removeCategory('${c.id}')"><i class="fa-solid fa-trash"></i></button>
      </div>
    </div>
  `).join('');
}

document.getElementById('form-new-category')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = document.getElementById('new-category-name');
  const res = await window.rapidinDB.createStoreCategory(input.value.trim());
  if (res.success) {
    input.value = '';
    await loadCatalog();
    renderCategoriesManageList();
  } else {
    window.rapidinAlert(res.message || 'No se pudo crear la categoría.');
  }
});

window.renameCategory = async function(id, currentName) {
  const name = prompt('Nuevo nombre de la categoría:', currentName);
  if (!name || !name.trim()) return;
  const res = await window.rapidinDB.updateStoreCategory(id, name.trim());
  if (res.success) {
    await loadCatalog();
    renderCategoriesManageList();
  } else {
    window.rapidinAlert(res.message || 'No se pudo renombrar la categoría.');
  }
};

window.removeCategory = async function(id) {
  if (!confirm('¿Eliminar esta categoría? Los productos quedarán sin categoría.')) return;
  const res = await window.rapidinDB.deleteStoreCategory(id);
  if (res.success) {
    await loadCatalog();
    renderCategoriesManageList();
  } else {
    window.rapidinAlert(res.message || 'No se pudo eliminar la categoría.');
  }
};

// ==========================================
// CATÁLOGO: PRODUCTOS
// ==========================================
const AVAILABILITY_LABELS = {
  available: { text: '● Disponible', color: '#10B981' },
  out_of_stock: { text: '○ Agotado', color: '#EF4444' },
  paused: { text: '‖ Pausado', color: '#F59E0B' }
};

function renderCatalogGrid() {
  const container = document.getElementById('catalog-products-grid');
  const products = currentCatalogFilter === 'all'
    ? currentProductsCache
    : currentProductsCache.filter(p => p.category_id === currentCatalogFilter);

  if (!products.length) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; background: var(--bg-card); border-radius: var(--radius-lg); border: 1px solid var(--border-color);">
        <i class="fa-solid fa-utensils" style="font-size: 3rem; color: var(--text-muted); margin-bottom: 1rem;"></i>
        <h3>Todavía no hay productos aquí</h3>
        <p style="color: var(--text-secondary);">Agrega tu primer producto con el botón "Nuevo producto".</p>
      </div>
    `;
    return;
  }

  container.innerHTML = products.map(p => {
    const avail = AVAILABILITY_LABELS[p.availability_status] || AVAILABILITY_LABELS.available;
    const imgStyle = p.image_url ? `background-image:url('${escapeHtml(p.image_url)}'); background-size:cover; background-position:center;` : 'display: flex; align-items: center; justify-content: center; font-size: 1.8rem;';
    return `
      <div class="product-card-store">
        <div style="width: 64px; height: 64px; border-radius: 12px; background: var(--bg-main); flex-shrink: 0; ${imgStyle}">${p.image_url ? '' : '🍽️'}</div>
        <div style="flex: 1; min-width: 0;">
          <h4 style="font-size: 0.95rem;">${escapeHtml(p.name)}</h4>
          <div style="font-weight: 800; color: #10B981; margin: 0.2rem 0;">${fmtMoneyStore(p.price_usd)}</div>
          <select class="avail-select" style="color: ${avail.color};" onchange="changeProductAvailability('${p.id}', this.value)">
            <option value="available" ${p.availability_status === 'available' ? 'selected' : ''}>● Disponible</option>
            <option value="out_of_stock" ${p.availability_status === 'out_of_stock' ? 'selected' : ''}>○ Agotado</option>
            <option value="paused" ${p.availability_status === 'paused' ? 'selected' : ''}>‖ Pausado</option>
          </select>
        </div>
        <div style="display: flex; flex-direction: column; gap: 0.4rem;">
          <button class="btn-action-store outline" style="padding: 0.35rem 0.6rem; font-size: 0.75rem;" onclick="openProductModal('${p.id}')"><i class="fa-solid fa-pen"></i></button>
          <button class="btn-action-store danger" style="padding: 0.35rem 0.6rem; font-size: 0.75rem;" onclick="removeProduct('${p.id}')"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
    `;
  }).join('');
}

window.changeProductAvailability = async function(id, status) {
  const res = await window.rapidinDB.setProductAvailability(id, status);
  if (res.success) {
    const p = currentProductsCache.find(x => x.id === id);
    if (p) p.availability_status = status;
  } else {
    window.rapidinAlert(res.message || 'No se pudo actualizar la disponibilidad.');
    renderCatalogGrid();
  }
};

window.removeProduct = async function(id) {
  if (!confirm('¿Eliminar este producto del catálogo?')) return;
  const res = await window.rapidinDB.deleteStoreProduct(id);
  if (res.success) await loadCatalog();
  else window.rapidinAlert(res.message || 'No se pudo eliminar el producto.');
};

// --- Modal de producto: variantes y extras ---
window.addOptionGroup = function(existing) {
  currentOptionGroups.push(existing || { title: '', required: false, type: 'radio', choices: [{ name: '', extra: 0 }] });
  renderOptionGroups();
};

function renderOptionGroups() {
  const container = document.getElementById('product-options-editor');
  if (!currentOptionGroups.length) {
    container.innerHTML = '<p style="color: var(--text-secondary); font-size: 0.85rem;">Sin variantes ni extras. Ej: "Punto de cocción" (variante) o "Extras" (complementos).</p>';
    return;
  }
  container.innerHTML = currentOptionGroups.map((g, gi) => `
    <div class="option-group-card">
      <div style="display: flex; gap: 0.5rem; margin-bottom: 0.6rem;">
        <input type="text" class="coupon-input" style="flex: 1;" placeholder="Ej: Tamaño" value="${escapeHtml(g.title)}" oninput="updateOptionGroup(${gi}, 'title', this.value)">
        <select class="coupon-input" style="width: 120px;" onchange="updateOptionGroup(${gi}, 'type', this.value)">
          <option value="radio" ${g.type === 'radio' ? 'selected' : ''}>Única</option>
          <option value="checkbox" ${g.type === 'checkbox' ? 'selected' : ''}>Múltiple</option>
        </select>
        <button type="button" class="btn-action-store danger" style="padding: 0.5rem 0.7rem;" onclick="removeOptionGroup(${gi})"><i class="fa-solid fa-trash"></i></button>
      </div>
      <label style="display: flex; align-items: center; gap: 0.4rem; font-size: 0.8rem; margin-bottom: 0.6rem; cursor: pointer;">
        <input type="checkbox" ${g.required ? 'checked' : ''} onchange="updateOptionGroup(${gi}, 'required', this.checked)"> Obligatorio elegir
      </label>
      ${g.choices.map((c, ci) => `
        <div class="option-choice-row">
          <input type="text" class="coupon-input" style="flex: 1;" placeholder="Opción" value="${escapeHtml(c.name)}" oninput="updateOptionChoice(${gi}, ${ci}, 'name', this.value)">
          <input type="number" class="coupon-input" style="width: 90px;" step="0.01" min="0" placeholder="+$" value="${c.extra}" oninput="updateOptionChoice(${gi}, ${ci}, 'extra', this.value)">
          <button type="button" class="btn-action-store danger" style="padding: 0.4rem 0.6rem;" onclick="removeOptionChoice(${gi}, ${ci})"><i class="fa-solid fa-xmark"></i></button>
        </div>
      `).join('')}
      <button type="button" class="btn-action-store outline" style="padding: 0.35rem 0.7rem; font-size: 0.75rem; margin-top: 0.3rem;" onclick="addOptionChoice(${gi})"><i class="fa-solid fa-plus"></i> Opción</button>
    </div>
  `).join('');
}

window.updateOptionGroup = function(gi, field, value) { currentOptionGroups[gi][field] = value; if (field === 'type') renderOptionGroups(); };
window.removeOptionGroup = function(gi) { currentOptionGroups.splice(gi, 1); renderOptionGroups(); };
window.addOptionChoice = function(gi) { currentOptionGroups[gi].choices.push({ name: '', extra: 0 }); renderOptionGroups(); };
window.updateOptionChoice = function(gi, ci, field, value) { currentOptionGroups[gi].choices[ci][field] = field === 'extra' ? Number(value) || 0 : value; };
window.removeOptionChoice = function(gi, ci) { currentOptionGroups[gi].choices.splice(ci, 1); renderOptionGroups(); };

window.openProductModal = function(productId) {
  const errorEl = document.getElementById('product-error');
  errorEl.style.display = 'none';
  document.getElementById('form-product').reset();
  document.getElementById('product-id-input').value = productId || '';

  const existing = productId ? currentProductsCache.find(p => p.id === productId) : null;
  document.getElementById('product-modal-title').textContent = existing ? 'Editar producto' : 'Nuevo producto';
  document.getElementById('product-name-input').value = existing ? existing.name : '';
  document.getElementById('product-description-input').value = existing ? (existing.description || '') : '';
  document.getElementById('product-price-input').value = existing ? existing.price_usd : '';
  document.getElementById('product-image-input').value = existing ? (existing.image_url || '') : '';
  document.getElementById('product-calories-input').value = existing ? (existing.calories || '') : '';
  renderCategorySelectOptions();
  document.getElementById('product-category-input').value = existing && existing.category_id ? existing.category_id : '';

  currentOptionGroups = existing && existing.options ? JSON.parse(JSON.stringify(existing.options)) : [];
  renderOptionGroups();

  document.getElementById('modal-product').classList.add('active');
};

document.getElementById('form-product')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById('product-error');
  errorEl.style.display = 'none';

  const id = document.getElementById('product-id-input').value;
  const payload = {
    name: document.getElementById('product-name-input').value.trim(),
    description: document.getElementById('product-description-input').value.trim(),
    price: Number(document.getElementById('product-price-input').value),
    categoryId: document.getElementById('product-category-input').value || null,
    image: document.getElementById('product-image-input').value.trim(),
    calories: document.getElementById('product-calories-input').value.trim(),
    options: currentOptionGroups.filter(g => g.title.trim())
  };

  const res = id ? await window.rapidinDB.updateStoreProduct(id, payload) : await window.rapidinDB.createStoreProduct(payload);
  if (res.success) {
    document.getElementById('modal-product').classList.remove('active');
    await loadCatalog();
  } else {
    errorEl.textContent = res.message || 'No se pudo guardar el producto.';
    errorEl.style.display = 'block';
  }
});

// ==========================================
// REPUTACIÓN: RESEÑAS
// ==========================================
let currentReviewsCache = [];

async function loadReviews() {
  const data = await window.rapidinDB.getStoreReviews();
  currentReviewsCache = data.reviews;
  document.getElementById('stat-avg-rating').textContent = data.averageRating != null ? `⭐ ${data.averageRating}` : '—';
  document.getElementById('stat-total-reviews').textContent = data.totalReviews;
  renderReviewsList();
}

function renderReviewsList() {
  const list = document.getElementById('reviews-list');
  if (!currentReviewsCache.length) {
    list.innerHTML = `
      <div style="text-align: center; padding: 3rem; background: var(--bg-card); border-radius: var(--radius-lg); border: 1px solid var(--border-color);">
        <i class="fa-solid fa-star" style="font-size: 3rem; color: var(--text-muted); margin-bottom: 1rem;"></i>
        <h3>Todavía no tienes reseñas</h3>
        <p style="color: var(--text-secondary);">Aparecerán aquí cuando tus clientes califiquen sus pedidos.</p>
      </div>
    `;
    return;
  }
  list.innerHTML = currentReviewsCache.map(r => {
    const stars = '★'.repeat(r.rating_store) + '☆'.repeat(5 - r.rating_store);
    const date = new Date(r.created_at.replace(' ', 'T') + 'Z').toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' });
    const replyHtml = r.store_reply_text
      ? `<div style="background: var(--bg-main); border-radius: var(--radius-md); padding: 0.85rem; margin-top: 0.75rem;">
           <div style="font-size: 0.75rem; font-weight: 700; color: var(--text-muted); margin-bottom: 0.3rem;">TU RESPUESTA</div>
           <div style="font-size: 0.85rem;">${escapeHtml(r.store_reply_text)}</div>
         </div>`
      : `<button type="button" class="btn-action-store outline" style="padding: 0.4rem 0.8rem; font-size: 0.8rem; margin-top: 0.6rem;" onclick="openReplyModal('${r.orderId}')"><i class="fa-solid fa-reply"></i> Responder</button>`;
    return `
      <div class="card-job">
        <div style="display: flex; justify-content: space-between; margin-bottom: 0.4rem;">
          <span style="font-weight: 700;">${escapeHtml(r.customerName)}</span>
          <span style="color: #F59E0B;">${stars}</span>
        </div>
        <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.5rem;">Pedido #${escapeHtml(r.orderId)} · ${date}</div>
        <div style="font-size: 0.9rem;">${escapeHtml(r.review_text || 'Sin comentario.')}</div>
        ${replyHtml}
      </div>
    `;
  }).join('');
}

window.openReplyModal = function(orderId) {
  document.getElementById('reply-order-id-input').value = orderId;
  document.getElementById('reply-text-input').value = '';
  document.getElementById('modal-reply-review').classList.add('active');
};

document.getElementById('form-reply-review')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const orderId = document.getElementById('reply-order-id-input').value;
  const text = document.getElementById('reply-text-input').value.trim();
  const res = await window.rapidinDB.replyToReview(orderId, text);
  if (res.success) {
    document.getElementById('modal-reply-review').classList.remove('active');
    await loadReviews();
  } else {
    window.rapidinAlert(res.message || 'No se pudo enviar tu respuesta.');
  }
});

// ==========================================
// PROMOCIONES PROPIAS DEL COMERCIO
// ==========================================
let currentPromotionsCache = [];

async function loadPromotions() {
  currentPromotionsCache = await window.rapidinDB.getStorePromotions();
  renderPromotionsList();
}

const PROMOTION_TYPE_LABELS = { general: 'General', '2x1': '2x1', envio_gratis: 'Envío gratis', flash: 'Flash' };

function renderPromotionsList() {
  const list = document.getElementById('promotions-list');
  if (!currentPromotionsCache.length) {
    list.innerHTML = `
      <div style="text-align: center; padding: 3rem; background: var(--bg-card); border-radius: var(--radius-lg); border: 1px solid var(--border-color);">
        <i class="fa-solid fa-tag" style="font-size: 3rem; color: var(--text-muted); margin-bottom: 1rem;"></i>
        <h3>Todavía no tienes promociones</h3>
        <p style="color: var(--text-secondary);">Crea un cupón para atraer más pedidos a tu negocio.</p>
      </div>
    `;
    return;
  }
  list.innerHTML = currentPromotionsCache.map(p => {
    const discountLabel = p.discount_type === 'percent' ? `${Math.round(p.discount_value * 100)}% OFF`
      : p.discount_type === 'shipping' ? 'Envío gratis'
      : `$${Number(p.discount_value).toFixed(2)} OFF`;
    const expired = p.expires_at && new Date(p.expires_at.replace(' ', 'T') + 'Z') < new Date();
    return `
      <div class="card-job">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;">
          <div>
            <span class="badge" style="background: var(--brand-secondary); color: #fff; margin-bottom: 0.4rem;">${escapeHtml(p.code)}</span>
            <h3 style="font-size: 1.05rem;">${escapeHtml(p.title)}</h3>
            <p style="color: var(--text-secondary); font-size: 0.85rem;">${escapeHtml(p.description || '')}</p>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 1.2rem; font-weight: 900; color: #10B981;">${discountLabel}</div>
            <span style="font-size: 0.75rem; color: var(--text-muted);">${PROMOTION_TYPE_LABELS[p.promo_type] || 'General'}</span>
          </div>
        </div>
        <div style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 0.75rem;">
          ${p.min_order_usd ? `Pedido mínimo $${Number(p.min_order_usd).toFixed(2)} · ` : ''}${p.expires_at ? (expired ? 'Venció el ' : 'Vence el ') + new Date(p.expires_at).toLocaleDateString('es-PE') : 'Sin fecha de vencimiento'}
        </div>
        <div style="display: flex; gap: 0.6rem; flex-wrap: wrap;">
          <button type="button" class="btn-action-store outline" style="padding: 0.4rem 0.8rem; font-size: 0.8rem;" onclick="openPromotionModal('${p.id}')"><i class="fa-solid fa-pen"></i> Editar</button>
          <button type="button" class="btn-action-store ${p.is_active ? 'danger' : ''}" style="padding: 0.4rem 0.8rem; font-size: 0.8rem; ${!p.is_active ? 'background: #10B981;' : ''}" onclick="togglePromotion('${p.id}', ${p.is_active ? 'false' : 'true'})">
            <i class="fa-solid ${p.is_active ? 'fa-pause' : 'fa-play'}"></i> ${p.is_active ? 'Pausar' : 'Activar'}
          </button>
          <button type="button" class="btn-action-store danger" style="padding: 0.4rem 0.8rem; font-size: 0.8rem;" onclick="removePromotion('${p.id}')"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
    `;
  }).join('');
}

window.togglePromotionValueField = function() {
  const type = document.getElementById('promotion-discount-type-input').value;
  document.getElementById('promotion-value-wrapper').style.display = type === 'shipping' ? 'none' : 'block';
};

window.openPromotionModal = function(promotionId) {
  const errorEl = document.getElementById('promotion-error');
  errorEl.style.display = 'none';
  document.getElementById('form-promotion').reset();
  document.getElementById('promotion-id-input').value = promotionId || '';

  const existing = promotionId ? currentPromotionsCache.find(p => p.id === promotionId) : null;
  document.getElementById('promotion-modal-title').textContent = existing ? 'Editar promoción' : 'Nueva promoción';
  document.getElementById('promotion-code-input').value = existing ? existing.code : '';
  document.getElementById('promotion-code-input').disabled = !!existing;
  document.getElementById('promotion-title-input').value = existing ? existing.title : '';
  document.getElementById('promotion-description-input').value = existing ? (existing.description || '') : '';
  document.getElementById('promotion-discount-type-input').value = existing ? existing.discount_type : 'percent';
  document.getElementById('promotion-value-input').value = existing ? existing.discount_value : 0;
  document.getElementById('promotion-minorder-input').value = existing ? existing.min_order_usd : 0;
  document.getElementById('promotion-type-input').value = existing ? existing.promo_type : 'general';
  document.getElementById('promotion-expires-input').value = existing && existing.expires_at ? existing.expires_at.slice(0, 10) : '';
  togglePromotionValueField();

  document.getElementById('modal-promotion').classList.add('active');
};

document.getElementById('form-promotion')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById('promotion-error');
  errorEl.style.display = 'none';

  const id = document.getElementById('promotion-id-input').value;
  const discountType = document.getElementById('promotion-discount-type-input').value;
  const rawValue = Number(document.getElementById('promotion-value-input').value) || 0;
  const payload = {
    code: document.getElementById('promotion-code-input').value.trim(),
    title: document.getElementById('promotion-title-input').value.trim(),
    description: document.getElementById('promotion-description-input').value.trim(),
    discountType,
    discountValue: discountType === 'percent' ? rawValue / 100 : (discountType === 'shipping' ? 0 : rawValue),
    minOrder: Number(document.getElementById('promotion-minorder-input').value) || 0,
    promoType: document.getElementById('promotion-type-input').value,
    expiresAt: document.getElementById('promotion-expires-input').value || null
  };

  const res = id ? await window.rapidinDB.updateStorePromotion(id, payload) : await window.rapidinDB.createStorePromotion(payload);
  if (res.success) {
    document.getElementById('modal-promotion').classList.remove('active');
    await loadPromotions();
  } else {
    errorEl.textContent = res.message || 'No se pudo guardar la promoción.';
    errorEl.style.display = 'block';
  }
});

window.togglePromotion = async function(id, activate) {
  const res = await window.rapidinDB.toggleStorePromotion(id, activate);
  if (res.success) await loadPromotions();
  else window.rapidinAlert(res.message || 'No se pudo actualizar la promoción.');
};

window.removePromotion = async function(id) {
  if (!confirm('¿Eliminar esta promoción?')) return;
  const res = await window.rapidinDB.deleteStorePromotion(id);
  if (res.success) await loadPromotions();
  else window.rapidinAlert(res.message || 'No se pudo eliminar la promoción.');
};

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
