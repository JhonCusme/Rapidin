/* ==========================================================================
   RAPIDIN - PARTNER STORE APP LOGIC
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  const storeCatalog = [
    { id: 'p1', name: 'Double Bacon Smoked Burger', price: 11.90, available: true, image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400' },
    { id: 'p2', name: 'Truffle Smash Burger', price: 13.50, available: true, image: 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=400' },
    { id: 'p3', name: 'Papas Supremas Cheddar & Tocino', price: 5.90, available: true, image: 'https://images.unsplash.com/photo-1576107232684-1279f3908594?w=400' }
  ];

  let storeIsOpen = true;

  async function renderOrders() {
    const listEl = document.getElementById('store-orders-list');
    const badgeEl = document.getElementById('orders-badge-count');
    if (!listEl) return;

    const store = window.rapidinDB.getCurrentUser('store');
    if (!store || !store.storeId) return;

    try {
      const response = await fetch(`${window.RAPIDIN_API_BASE}/api/orders/store/${store.storeId}`, {
        headers: window.rapidinDB.getAuthHeaders('store')
      });
      const data = await response.json();
      const orders = data.success ? data.orders : [];

      if (badgeEl) badgeEl.textContent = orders.length;

      if (orders.length === 0) {
      listEl.innerHTML = `
        <div style="text-align: center; padding: 3rem; background: var(--bg-card); border-radius: var(--radius-lg); border: 1px solid var(--border-color);">
          <i class="fa-solid fa-utensils" style="font-size: 3rem; color: var(--text-muted); margin-bottom: 1rem;"></i>
          <h3>No hay pedidos pendientes</h3>
          <p style="color: var(--text-secondary);">Los nuevos pedidos aparecerán aquí automáticamente.</p>
        </div>
      `;
      return;
    }

    listEl.innerHTML = orders.map(order => `
      <div class="order-card-store ${order.statusStep === 0 ? 'new-alert' : ''}">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
          <div>
            <span class="badge" style="background: var(--brand-primary); color: #fff; margin-bottom: 0.4rem;">ORDEN #${escapeHtml(order.id)}</span>
            <h3 style="font-size: 1.15rem;">Cliente: ${escapeHtml(order.customerName)}</h3>
            <span style="font-size: 0.85rem; color: var(--text-secondary);"><i class="fa-solid fa-location-dot"></i> ${escapeHtml(order.customerAddress)} • ${escapeHtml(order.createdAt || 'Hace instantes')}</span>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 1.4rem; font-weight: 900; color: #10B981;">$${order.total.toFixed(2)}</div>
            <span style="font-size: 0.75rem; color: var(--text-muted);">Pago Aprobado (Tarjeta)</span>
          </div>
        </div>

        <div style="background: var(--bg-main); padding: 1rem; border-radius: var(--radius-md); margin-bottom: 1rem;">
          <div style="font-size: 0.8rem; font-weight: 700; color: var(--text-muted); margin-bottom: 0.5rem; text-transform: uppercase;">Items a preparar:</div>
          ${order.items.map(item => `
            <div style="display: flex; justify-content: space-between; font-size: 0.9rem; padding: 0.25rem 0;">
              <span><strong>${item.quantity}x</strong> ${escapeHtml(item.name)} ${item.notes ? `<span style="color: var(--brand-secondary);">(${escapeHtml(item.notes)})</span>` : ''}</span>
              <span style="font-weight: 700;">$${(item.price * item.quantity).toFixed(2)}</span>
            </div>
          `).join('')}
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <span style="font-size: 0.85rem; font-weight: 700; color: var(--text-secondary);">Estado Actual: </span>
            <span class="badge" style="background: rgba(255,255,255,0.1); color: var(--text-primary);">${escapeHtml(order.statusText)}</span>
          </div>

          <div>
            ${order.statusStep === 0 ? `
              <button class="btn-action-store" onclick="updateOrderStep('${order.id}', 1, 'En Preparación por la Cocina')">
                <i class="fa-solid fa-fire-burner"></i> Aceptar y Empezar a Preparar
              </button>
            ` : order.statusStep === 1 ? `
              <button class="btn-action-store" style="background: var(--brand-secondary);" onclick="updateOrderStep('${order.id}', 2, 'Listo para Recojo por Repartidor')">
                <i class="fa-solid fa-box-check"></i> Marcar Listo para Recojo 🛍️
              </button>
            ` : `
              <span class="badge" style="background: #10B981; color: #000; padding: 0.5rem 1rem;">
                <i class="fa-solid fa-check"></i> ENTREGADO A REPARTIDOR (${escapeHtml(order.courier ? order.courier.name : 'Asignado')})
              </span>
            `}
          </div>
        </div>
      </div>
    `).join('');
    } catch (e) {
      console.error('Error fetching store orders:', e);
    }
  }

  function renderCatalog() {
    const container = document.getElementById('catalog-items-grid');
    if (!container) return;

    container.innerHTML = storeCatalog.map(p => `
      <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1.25rem; display: flex; gap: 1rem; align-items: center;">
        <img src="${p.image}" style="width: 70px; height: 70px; border-radius: 12px; object-fit: cover;">
        <div style="flex: 1;">
          <h4 style="font-size: 1rem;">${p.name}</h4>
          <div style="font-weight: 800; color: #10B981; margin: 0.2rem 0;">$${p.price.toFixed(2)}</div>
          <span class="badge" style="background: ${p.available ? 'rgba(16,185,129,0.2)' : 'rgba(255,51,102,0.2)'}; color: ${p.available ? '#10B981' : '#FF3366'};">
            ${p.available ? '● DISPONIBLE' : '○ AGOTADO / PAUSADO'}
          </span>
        </div>
        <button class="btn-action-store" style="padding: 0.4rem 0.8rem; font-size: 0.75rem; background: var(--bg-main); border: 1px solid var(--border-color);" onclick="toggleProductStock('${p.id}')">
          Cambiar
        </button>
      </div>
    `).join('');
  }

  window.toggleProductStock = function(pId) {
    const prod = storeCatalog.find(p => p.id === pId);
    if (prod) {
      prod.available = !prod.available;
      renderCatalog();
    }
  };

  window.updateOrderStep = async function(orderId, newStep, statusText) {
    await window.rapidinSync.updateOrderStatus(orderId, newStep, { statusText });
    renderOrders();
  };

  // Manejo de Pestañas
  const tabBtnOrders = document.getElementById('tab-btn-orders');
  const tabBtnCatalog = document.getElementById('tab-btn-catalog');
  const tabBtnMetrics = document.getElementById('tab-btn-metrics');

  const tabOrders = document.getElementById('tab-content-orders');
  const tabCatalog = document.getElementById('tab-content-catalog');
  const tabMetrics = document.getElementById('tab-content-metrics');

  function switchTab(activeBtn, activeTab) {
    [tabBtnOrders, tabBtnCatalog, tabBtnMetrics].forEach(b => b?.classList.remove('active'));
    [tabOrders, tabCatalog, tabMetrics].forEach(t => { if (t) t.style.display = 'none'; });

    if (activeBtn) activeBtn.classList.add('active');
    if (activeTab) activeTab.style.display = 'block';
  }

  tabBtnOrders?.addEventListener('click', () => switchTab(tabBtnOrders, tabOrders));
  tabBtnCatalog?.addEventListener('click', () => {
    renderCatalog();
    switchTab(tabBtnCatalog, tabCatalog);
  });
  tabBtnMetrics?.addEventListener('click', () => switchTab(tabBtnMetrics, tabMetrics));

  // Toggle Estado Tienda Abierto/Cerrado
  document.getElementById('btn-toggle-store-status')?.addEventListener('click', () => {
    storeIsOpen = !storeIsOpen;
    const txt = document.getElementById('store-status-text');
    if (txt) txt.textContent = storeIsOpen ? 'ABIERTO • RECIBIENDO PEDIDOS' : 'CERRADO TEMPORALMENTE';
  });

  window.rapidinSync.subscribe('ORDER_CREATED', () => renderOrders());
  window.rapidinSync.subscribe('ORDER_STATUS_CHANGED', () => renderOrders());

  renderOrders();
});
