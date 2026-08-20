/* ==========================================================================
   RAPIDIN - PANEL DE SUPER ADMIN (Monitoreo, Comercios, Repartidores, Comisión)
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  let storesList = [];
  let driversList = [];

  async function renderAdminOverview() {
    const tbody = document.getElementById('admin-orders-table-body');
    if (!tbody) return;

    const [overview, orders, settings] = await Promise.all([
      window.rapidinDB.getAdminOverview(),
      window.rapidinDB.getAdminOrders(),
      window.rapidinDB.getAdminSettings()
    ]);

    if (overview) {
      document.getElementById('admin-gmv').textContent = `$${(overview.gmv || 0).toFixed(2)}`;
      document.getElementById('admin-net-commission').textContent = `$${(overview.commission || 0).toFixed(2)}`;
      document.getElementById('admin-store-count').textContent = overview.storeCount;
      document.getElementById('admin-drivers-online').textContent = overview.driversOnline;
      document.getElementById('admin-driver-total').textContent = overview.driverCount;
      document.getElementById('tab-store-count').textContent = overview.storeCount;
      document.getElementById('tab-driver-count').textContent = overview.driverCount;
    }

    if (settings) {
      document.getElementById('fee-pct-badge').textContent = Math.round(settings.commissionRate * 100);
      document.getElementById('fee-slider-val').textContent = `${Math.round(settings.commissionRate * 100)}%`;
      document.getElementById('fee-range-input').value = Math.round(settings.commissionRate * 100);
      document.getElementById('status-stripe').innerHTML = settings.stripeConfigured
        ? '<span style="color: #10B981;">● Configurado</span>' : '<span style="color: #EF4444;">○ No configurado</span>';
      document.getElementById('status-payphone').innerHTML = settings.payphoneConfigured
        ? '<span style="color: #10B981;">● Configurado</span>' : '<span style="color: #EF4444;">○ No configurado</span>';
      const payphoneSourceEl = document.getElementById('status-payphone-source');
      if (payphoneSourceEl) {
        payphoneSourceEl.textContent = settings.payphoneConfigured
          ? (settings.payphoneCredentialsSource === 'env' ? 'Configurado por .env del servidor' : 'Configurado desde este panel')
          : 'Configúralo abajo';
      }
      const deleteBtn = document.getElementById('btn-delete-payphone-creds');
      if (deleteBtn) {
        deleteBtn.style.display = (settings.payphoneConfigured && settings.payphoneCredentialsSource === 'db') ? '' : 'none';
      }
      document.getElementById('status-twilio').innerHTML = settings.twilioConfigured
        ? '<span style="color: #10B981;">● Configurado</span>' : '<span style="color: #F59E0B;">○ Modo de prueba (código 123456)</span>';

      const radioStripe = document.getElementById('provider-radio-stripe');
      const radioPayphone = document.getElementById('provider-radio-payphone');
      const optStripe = document.getElementById('provider-option-stripe');
      const optPayphone = document.getElementById('provider-option-payphone');
      if (radioStripe && radioPayphone) {
        radioStripe.checked = settings.activePaymentProvider === 'stripe';
        radioPayphone.checked = settings.activePaymentProvider === 'payphone';
        radioStripe.disabled = !settings.stripeConfigured;
        radioPayphone.disabled = !settings.payphoneConfigured;
        optStripe.style.opacity = settings.stripeConfigured ? '1' : '0.5';
        optPayphone.style.opacity = settings.payphoneConfigured ? '1' : '0.5';
        optStripe.style.borderColor = settings.activePaymentProvider === 'stripe' ? '#8B5CF6' : 'transparent';
        optPayphone.style.borderColor = settings.activePaymentProvider === 'payphone' ? '#8B5CF6' : 'transparent';
      }
    }

    if (!orders.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="padding: 2rem; text-align: center; color: var(--text-secondary);">Todavía no hay pedidos en la plataforma.</td></tr>`;
      return;
    }

    tbody.innerHTML = orders.map(order => `
      <tr style="border-bottom: 1px solid var(--border-color);">
        <td style="padding: 1rem; font-weight: 800; color: var(--brand-primary);">${escapeHtml(order.id)}</td>
        <td style="padding: 1rem; font-weight: 700;">${escapeHtml(order.storeName || 'Comercio eliminado')}</td>
        <td style="padding: 1rem; color: var(--text-secondary);">${escapeHtml(order.customerName || 'Invitado')}</td>
        <td style="padding: 1rem; font-weight: 800; color: #10B981;">$${(order.total || 0).toFixed(2)}</td>
        <td style="padding: 1rem; font-weight: 800; color: #8B5CF6;">+$${(order.commission || 0).toFixed(2)}</td>
        <td style="padding: 1rem;">
          <span class="badge" style="background: rgba(139,92,246,0.15); color: #8B5CF6; border: 1px solid #8B5CF6;">
            ${escapeHtml(order.statusText || '')}
          </span>
        </td>
      </tr>
    `).join('');
  }

  async function renderStoresAdmin() {
    const container = document.getElementById('admin-stores-list');
    if (!container) return;

    storesList = await window.rapidinDB.getAdminUsers('store');

    if (!storesList.length) {
      container.innerHTML = `<p style="color: var(--text-secondary);">Todavía no hay comercios registrados.</p>`;
      return;
    }

    container.innerHTML = storesList.map(s => `
      <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1.25rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
          <h3 style="font-size: 1.1rem;">${escapeHtml(s.name)}</h3>
          <span class="badge" style="background: ${s.active ? '#10B981' : '#FF3366'}; color: ${s.active ? '#000' : '#fff'};">
            ${s.active ? 'ACTIVO' : 'SUSPENDIDO'}
          </span>
        </div>
        <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1rem;">
          Correo: ${escapeHtml(s.email)}
        </div>
        <button class="badge" style="background: var(--bg-main); border: 1px solid var(--border-color); color: var(--text-primary); cursor: pointer; padding: 0.4rem 0.8rem;" onclick="toggleUserStatusAdmin('${s.id}')">
          ${s.active ? 'Suspender cuenta' : 'Reactivar cuenta'}
        </button>
      </div>
    `).join('');
  }

  async function renderDriversAdmin() {
    const container = document.getElementById('admin-drivers-list');
    if (!container) return;

    driversList = await window.rapidinDB.getAdminUsers('driver');

    if (!driversList.length) {
      container.innerHTML = `<p style="color: var(--text-secondary);">Todavía no hay repartidores registrados.</p>`;
      return;
    }

    container.innerHTML = driversList.map(d => `
      <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1.25rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
          <h3 style="font-size: 1.1rem;">${escapeHtml(d.name)}</h3>
          <span class="badge" style="background: ${d.active ? '#10B981' : '#FF3366'}; color: ${d.active ? '#000' : '#fff'};">
            ${d.active ? 'ACTIVO' : 'SUSPENDIDO'}
          </span>
        </div>
        <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1rem;">
          Correo: ${escapeHtml(d.email)}
        </div>
        <button class="badge" style="background: var(--bg-main); border: 1px solid var(--border-color); color: var(--text-primary); cursor: pointer; padding: 0.4rem 0.8rem;" onclick="toggleUserStatusAdmin('${d.id}')">
          ${d.active ? 'Suspender cuenta' : 'Reactivar cuenta'}
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

  // Comisión global de la plataforma
  const feeSlider = document.getElementById('fee-range-input');
  const feeValText = document.getElementById('fee-slider-val');

  if (feeSlider && feeValText) {
    feeSlider.addEventListener('input', (e) => {
      feeValText.textContent = `${e.target.value}%`;
    });
  }

  window.saveFeeSetting = async function() {
    const pct = Number(document.getElementById('fee-range-input').value);
    const res = await window.rapidinDB.updateAdminSettings(pct / 100);
    if (res.success) {
      window.rapidinAlert(`🛡️ Comisión global de Rapidín actualizada al ${pct}%. Se aplicará a los pedidos nuevos.`);
      renderAdminOverview();
    } else {
      window.rapidinAlert(res.message || 'No se pudo actualizar la comisión.');
    }
  };

  window.savePayphoneCredentials = async function() {
    const token = document.getElementById('payphone-token-input').value.trim();
    const storeId = document.getElementById('payphone-storeid-input').value.trim();
    const msgEl = document.getElementById('payphone-creds-msg');
    if (!token || !storeId) {
      if (msgEl) { msgEl.style.color = '#EF4444'; msgEl.textContent = 'Completa el Token y el StoreId.'; }
      return;
    }
    const res = await window.rapidinDB.savePayphoneCredentials(token, storeId);
    if (res.success) {
      if (msgEl) { msgEl.style.color = '#10B981'; msgEl.textContent = '✅ Credenciales de Payphone guardadas y cifradas.'; }
      document.getElementById('payphone-token-input').value = '';
      document.getElementById('payphone-storeid-input').value = '';
      renderAdminOverview();
    } else {
      if (msgEl) { msgEl.style.color = '#EF4444'; msgEl.textContent = res.message || 'No se pudieron guardar las credenciales.'; }
    }
  };

  window.deletePayphoneCredentials = async function() {
    if (!confirm('¿Eliminar las credenciales de Payphone guardadas en el panel? Si Payphone es la pasarela activa, se volverá a Stripe automáticamente.')) return;
    const res = await window.rapidinDB.deletePayphoneCredentials();
    const msgEl = document.getElementById('payphone-creds-msg');
    if (res.success) {
      if (msgEl) { msgEl.style.color = '#10B981'; msgEl.textContent = '🗑️ Credenciales de Payphone eliminadas.'; }
      renderAdminOverview();
    } else {
      if (msgEl) { msgEl.style.color = '#EF4444'; msgEl.textContent = res.message || 'No se pudieron eliminar las credenciales.'; }
    }
  };

  window.savePaymentProvider = async function() {
    const selected = document.querySelector('input[name="payment-provider"]:checked');
    const msgEl = document.getElementById('provider-save-msg');
    if (!selected) {
      if (msgEl) { msgEl.style.color = '#EF4444'; msgEl.textContent = 'Elige una pasarela primero.'; }
      return;
    }
    const res = await window.rapidinDB.updateActivePaymentProvider(selected.value);
    if (res.success) {
      if (msgEl) { msgEl.style.color = '#10B981'; msgEl.textContent = `✅ Pasarela activa: ${selected.value === 'stripe' ? 'Stripe' : 'Payphone'}.`; }
      renderAdminOverview();
    } else {
      if (msgEl) { msgEl.style.color = '#EF4444'; msgEl.textContent = res.message || 'No se pudo actualizar la pasarela.'; }
    }
  };

  // Manejo de Pestañas
  const tabBtnOverview = document.getElementById('atab-btn-overview');
  const tabBtnStores = document.getElementById('atab-btn-stores');
  const tabBtnDrivers = document.getElementById('atab-btn-drivers');
  const tabBtnFees = document.getElementById('atab-btn-fees');
  const tabBtnIntegrations = document.getElementById('atab-btn-integrations');

  const tabOverview = document.getElementById('atab-content-overview');
  const tabStores = document.getElementById('atab-content-stores');
  const tabDrivers = document.getElementById('atab-content-drivers');
  const tabFees = document.getElementById('atab-content-fees');
  const tabIntegrations = document.getElementById('atab-content-integrations');

  function switchAdminTab(activeBtn, activeTab) {
    [tabBtnOverview, tabBtnStores, tabBtnDrivers, tabBtnFees, tabBtnIntegrations].forEach(b => b?.classList.remove('active'));
    [tabOverview, tabStores, tabDrivers, tabFees, tabIntegrations].forEach(t => { if (t) t.style.display = 'none'; });

    if (activeBtn) activeBtn.classList.add('active');
    if (activeTab) activeTab.style.display = 'block';
  }

  tabBtnOverview?.addEventListener('click', () => switchAdminTab(tabBtnOverview, tabOverview));
  tabBtnStores?.addEventListener('click', () => { renderStoresAdmin(); switchAdminTab(tabBtnStores, tabStores); });
  tabBtnDrivers?.addEventListener('click', () => { renderDriversAdmin(); switchAdminTab(tabBtnDrivers, tabDrivers); });
  tabBtnFees?.addEventListener('click', () => switchAdminTab(tabBtnFees, tabFees));
  tabBtnIntegrations?.addEventListener('click', () => switchAdminTab(tabBtnIntegrations, tabIntegrations));

  window.rapidinSync.subscribe('ORDER_CREATED', () => renderAdminOverview());
  window.rapidinSync.subscribe('ORDER_STATUS_CHANGED', () => renderAdminOverview());

  window.loadAdminApp = function() {
    renderAdminOverview();
  };
});
