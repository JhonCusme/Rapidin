/* ==========================================================================
   RAPIDIN - SUPER ADMIN DASHBOARD LOGIC
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  let commissionPct = 0.15;

  let storesList = [];
  let driversList = [];

  async function renderAdminOverview() {
    const tbody = document.getElementById('admin-orders-table-body');
    if (!tbody) return;

    const overview = await window.rapidinDB.getAdminOverview();
    const orders = await window.rapidinDB.getAdminOrders();

    if (overview) {
      document.getElementById('admin-gmv').textContent = `$${(overview.gmv || 0).toFixed(2)}`;
      document.getElementById('admin-net-commission').textContent = `$${(overview.commission || 0).toFixed(2)}`;
    }
    
    const pctBadge = document.getElementById('fee-pct-badge');
    if (pctBadge) pctBadge.textContent = Math.round(commissionPct * 100);

    tbody.innerHTML = orders.map(order => {
      const commission = order.total * commissionPct; // Para mostrar un cálculo local o podríamos usar el de BD
      return `
        <tr style="border-bottom: 1px solid var(--border-color);">
          <td style="padding: 1rem; font-weight: 800; color: var(--brand-primary);">${escapeHtml(order.id)}</td>
          <td style="padding: 1rem; font-weight: 700;">${escapeHtml(order.storeName || 'Tienda Rapidin')}</td>
          <td style="padding: 1rem; color: var(--text-secondary);">${escapeHtml(order.customerName || 'Invitado')}</td>
          <td style="padding: 1rem; font-weight: 800; color: #10B981;">$${(order.total || 0).toFixed(2)}</td>
          <td style="padding: 1rem; font-weight: 800; color: #8B5CF6;">+$${commission.toFixed(2)}</td>
          <td style="padding: 1rem;">
            <span class="badge" style="background: rgba(139,92,246,0.15); color: #8B5CF6; border: 1px solid #8B5CF6;">
              ${escapeHtml(order.statusText)}
            </span>
          </td>
        </tr>
      `;
    }).join('');
  }

  async function renderStoresAdmin() {
    const container = document.getElementById('admin-stores-list');
    if (!container) return;
    
    storesList = await window.rapidinDB.getAdminUsers('store');

    container.innerHTML = storesList.map(s => `
      <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1.25rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
          <h3 style="font-size: 1.1rem;">${escapeHtml(s.name)}</h3>
          <span class="badge" style="background: ${s.active ? '#10B981' : '#FF3366'}; color: ${s.active ? '#000' : '#fff'};">
            ${s.active ? 'ACTIVO' : 'PAUSADO'}
          </span>
        </div>
        <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1rem;">
          Correo: ${escapeHtml(s.email)}
        </div>
        <button class="badge" style="background: var(--bg-main); border: 1px solid var(--border-color); color: var(--text-primary); cursor: pointer; padding: 0.4rem 0.8rem;" onclick="toggleUserStatusAdmin('${s.id}')">
          ${s.active ? 'Pausar Comercio' : 'Activar Comercio'}
        </button>
      </div>
    `).join('');
  }

  async function renderDriversAdmin() {
    const container = document.getElementById('admin-drivers-list');
    if (!container) return;

    driversList = await window.rapidinDB.getAdminUsers('driver');

    container.innerHTML = driversList.map(d => `
      <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1.25rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
          <h3 style="font-size: 1.1rem;">${escapeHtml(d.name)}</h3>
          <span class="badge" style="background: ${d.active ? '#10B981' : '#FF3366'}; color: ${d.active ? '#000' : '#fff'};">
            ${d.active ? 'APROBADO' : 'SUSPENDIDO'}
          </span>
        </div>
        <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1rem;">
          Correo: ${escapeHtml(d.email)}
        </div>
        <button class="badge" style="background: var(--bg-main); border: 1px solid var(--border-color); color: var(--text-primary); cursor: pointer; padding: 0.4rem 0.8rem;" onclick="toggleUserStatusAdmin('${d.id}')">
          ${d.active ? 'Suspender Chofer' : 'Aprobar Chofer'}
        </button>
      </div>
    `).join('');
  }

  window.toggleUserStatusAdmin = async function(id) {
    const res = await window.rapidinDB.toggleUserStatus(id);
    if (res !== null) {
      renderStoresAdmin();
      renderDriversAdmin();
    }
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
    window.rapidinAlert(`🛡️ ¡Comisión global de Rapidin actualizada al ${(commissionPct * 100).toFixed(0)}%!`);
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
