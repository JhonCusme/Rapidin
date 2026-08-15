/* ==========================================================================
   RAPIDIN - SUPER ADMIN DASHBOARD LOGIC
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  let commissionPct = 0.15;

  const mockStoresList = [
    { id: 's1', name: 'Burger Prime & Grill', category: 'Restaurantes', rating: 4.9, active: true },
    { id: 's2', name: 'Rapidin Turbo Market', category: 'Turbo 15m', rating: 4.95, active: true },
    { id: 's3', name: 'Sakura Sushi Bar', category: 'Restaurantes', rating: 4.8, active: true },
    { id: 's4', name: 'Farmacia Express 24h', category: 'Farmacia', rating: 4.9, active: true },
    { id: 's5', name: 'Napoli Pizza Woodfire', category: 'Restaurantes', rating: 4.85, active: true }
  ];

  const mockDriversList = [
    { id: 'd1', name: 'Carlos Ruiz', vehicle: 'Honda CB 190 (RPD-77)', rating: 4.96, active: true },
    { id: 'd2', name: 'Andrea Gómez', vehicle: 'Yamaha FZ 150 (RPD-88)', rating: 4.92, active: true },
    { id: 'd3', name: 'Miguel Ángel', vehicle: 'Bicicleta Electric (RPD-12)', rating: 4.88, active: true }
  ];

  function renderAdminOverview() {
    const tbody = document.getElementById('admin-orders-table-body');
    if (!tbody) return;

    const orders = window.rapidinSync.getOrders();

    let totalGmv = 1482.50;
    orders.forEach(o => totalGmv += o.total);

    const netCommission = totalGmv * commissionPct;

    document.getElementById('admin-gmv').textContent = `$${totalGmv.toFixed(2)}`;
    document.getElementById('admin-net-commission').textContent = `$${netCommission.toFixed(2)}`;
    const pctBadge = document.getElementById('fee-pct-badge');
    if (pctBadge) pctBadge.textContent = Math.round(commissionPct * 100);

    tbody.innerHTML = orders.map(order => {
      const commission = order.total * commissionPct;

      return `
        <tr style="border-bottom: 1px solid var(--border-color);">
          <td style="padding: 1rem; font-weight: 800; color: var(--brand-primary);">${order.id}</td>
          <td style="padding: 1rem; font-weight: 700;">${order.storeName}</td>
          <td style="padding: 1rem; color: var(--text-secondary);">${order.customerName}</td>
          <td style="padding: 1rem; font-weight: 800; color: #10B981;">$${order.total.toFixed(2)}</td>
          <td style="padding: 1rem; font-weight: 800; color: #8B5CF6;">+$${commission.toFixed(2)}</td>
          <td style="padding: 1rem;">
            <span class="badge" style="background: rgba(139,92,246,0.15); color: #8B5CF6; border: 1px solid #8B5CF6;">
              ${order.statusText}
            </span>
          </td>
        </tr>
      `;
    }).join('');
  }

  function renderStoresAdmin() {
    const container = document.getElementById('admin-stores-list');
    if (!container) return;

    container.innerHTML = mockStoresList.map(s => `
      <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1.25rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
          <h3 style="font-size: 1.1rem;">${s.name}</h3>
          <span class="badge" style="background: ${s.active ? '#10B981' : '#FF3366'}; color: ${s.active ? '#000' : '#fff'};">
            ${s.active ? 'ACTIVO' : 'PAUSADO'}
          </span>
        </div>
        <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1rem;">
          Categoría: ${s.category} • Calificación: ★ ${s.rating}
        </div>
        <button class="badge" style="background: var(--bg-main); border: 1px solid var(--border-color); color: var(--text-primary); cursor: pointer; padding: 0.4rem 0.8rem;" onclick="toggleStoreAdmin('${s.id}')">
          ${s.active ? 'Pausar Comercio' : 'Activar Comercio'}
        </button>
      </div>
    `).join('');
  }

  function renderDriversAdmin() {
    const container = document.getElementById('admin-drivers-list');
    if (!container) return;

    container.innerHTML = mockDriversList.map(d => `
      <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1.25rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
          <h3 style="font-size: 1.1rem;">${d.name}</h3>
          <span class="badge" style="background: ${d.active ? '#10B981' : '#FF3366'}; color: ${d.active ? '#000' : '#fff'};">
            ${d.active ? 'APROBADO' : 'SUSPENDIDO'}
          </span>
        </div>
        <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1rem;">
          Vehículo: ${d.vehicle} • ★ ${d.rating}
        </div>
        <button class="badge" style="background: var(--bg-main); border: 1px solid var(--border-color); color: var(--text-primary); cursor: pointer; padding: 0.4rem 0.8rem;" onclick="toggleDriverAdmin('${d.id}')">
          ${d.active ? 'Suspender Chofer' : 'Aprobar Chofer'}
        </button>
      </div>
    `).join('');
  }

  window.toggleStoreAdmin = function(id) {
    const s = mockStoresList.find(item => item.id === id);
    if (s) { s.active = !s.active; renderStoresAdmin(); }
  };

  window.toggleDriverAdmin = function(id) {
    const d = mockDriversList.find(item => item.id === id);
    if (d) { d.active = !d.active; renderDriversAdmin(); }
  };

  // Manejo de Rango de Comisión
  const feeSlider = document.getElementById('fee-range-input');
  const feeValText = document.getElementById('fee-slider-val');

  if (feeSlider && feeValText) {
    feeSlider.addEventListener('input', (e) => {
      const val = e.target.value;
      feeValText.textContent = `${val}%`;
      commissionPct = val / 100;
      renderAdminOverview();
    });
  }

  window.saveFeeSetting = function() {
    alert(`🛡️ ¡Comisión global de Rapidin actualizada al ${(commissionPct * 100).toFixed(0)}%!`);
  };

  // Manejo de Pestañas
  const tabBtnOverview = document.getElementById('atab-btn-overview');
  const tabBtnStores = document.getElementById('atab-btn-stores');
  const tabBtnDrivers = document.getElementById('atab-btn-drivers');
  const tabBtnFees = document.getElementById('atab-btn-fees');

  const tabOverview = document.getElementById('atab-content-overview');
  const tabStores = document.getElementById('atab-content-stores');
  const tabDrivers = document.getElementById('atab-content-drivers');
  const tabFees = document.getElementById('atab-content-fees');

  function switchAdminTab(activeBtn, activeTab) {
    [tabBtnOverview, tabBtnStores, tabBtnDrivers, tabBtnFees].forEach(b => b?.classList.remove('active'));
    [tabOverview, tabStores, tabDrivers, tabFees].forEach(t => { if (t) t.style.display = 'none'; });

    if (activeBtn) activeBtn.classList.add('active');
    if (activeTab) activeTab.style.display = 'block';
  }

  tabBtnOverview?.addEventListener('click', () => switchAdminTab(tabBtnOverview, tabOverview));
  tabBtnStores?.addEventListener('click', () => { renderStoresAdmin(); switchAdminTab(tabBtnStores, tabStores); });
  tabBtnDrivers?.addEventListener('click', () => { renderDriversAdmin(); switchAdminTab(tabBtnDrivers, tabDrivers); });
  tabBtnFees?.addEventListener('click', () => switchAdminTab(tabBtnFees, tabFees));

  window.rapidinSync.subscribe('ORDER_CREATED', () => renderAdminOverview());
  window.rapidinSync.subscribe('ORDER_STATUS_CHANGED', () => renderAdminOverview());

  renderAdminOverview();
});
