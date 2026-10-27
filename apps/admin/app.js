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
  const tabBtnSupport = document.getElementById('atab-btn-support');
  const tabBtnCoupons = document.getElementById('atab-btn-coupons');

  const tabOverview = document.getElementById('atab-content-overview');
  const tabStores = document.getElementById('atab-content-stores');
  const tabDrivers = document.getElementById('atab-content-drivers');
  const tabFees = document.getElementById('atab-content-fees');
  const tabIntegrations = document.getElementById('atab-content-integrations');
  const tabSupport = document.getElementById('atab-content-support');
  const tabCoupons = document.getElementById('atab-content-coupons');

  function switchAdminTab(activeBtn, activeTab) {
    [tabBtnOverview, tabBtnStores, tabBtnDrivers, tabBtnFees, tabBtnIntegrations, tabBtnSupport, tabBtnCoupons].forEach(b => b?.classList.remove('active'));
    [tabOverview, tabStores, tabDrivers, tabFees, tabIntegrations, tabSupport, tabCoupons].forEach(t => { if (t) t.style.display = 'none'; });

    if (activeBtn) activeBtn.classList.add('active');
    if (activeTab) activeTab.style.display = 'block';
  }

  tabBtnOverview?.addEventListener('click', () => switchAdminTab(tabBtnOverview, tabOverview));
  tabBtnStores?.addEventListener('click', () => { renderStoresAdmin(); switchAdminTab(tabBtnStores, tabStores); });
  tabBtnDrivers?.addEventListener('click', () => { renderDriversAdmin(); switchAdminTab(tabBtnDrivers, tabDrivers); });
  tabBtnFees?.addEventListener('click', () => switchAdminTab(tabBtnFees, tabFees));
  tabBtnIntegrations?.addEventListener('click', () => switchAdminTab(tabBtnIntegrations, tabIntegrations));
  tabBtnSupport?.addEventListener('click', () => { loadSupportTickets('open'); switchAdminTab(tabBtnSupport, tabSupport); });
  tabBtnCoupons?.addEventListener('click', () => { renderAdminCoupons(); switchAdminTab(tabBtnCoupons, tabCoupons); });

  // ==========================================
  // SOPORTE: bandeja de casos de los clientes
  // ==========================================
  const SUPPORT_CATEGORY = { pedido: '📦 Pedido', pago: '💳 Pago', cuenta: '👤 Cuenta', app: '📱 App', otro: '💬 Otro' };
  let supportFilter = 'open';

  window.loadSupportTickets = async function(status) {
    supportFilter = status || supportFilter;
    const list = document.getElementById('admin-support-list');
    const setBtn = (id, on) => {
      const b = document.getElementById(id);
      if (!b) return;
      b.style.background = on ? '#8B5CF6' : 'var(--bg-card)';
      b.style.color = on ? '#fff' : 'var(--text-secondary)';
      b.style.border = on ? 'none' : '1px solid var(--border-color)';
    };
    setBtn('support-filter-open', supportFilter === 'open');
    setBtn('support-filter-closed', supportFilter === 'closed');

    const tickets = await window.rapidinDB.getAdminSupportTickets(supportFilter);
    if (supportFilter === 'open') {
      const counter = document.getElementById('tab-support-count');
      if (counter) counter.textContent = tickets.length ? `(${tickets.length})` : '';
    }
    if (!tickets.length) {
      list.innerHTML = `<p style="color: var(--text-secondary); padding: 2rem; text-align: center;">${supportFilter === 'open' ? 'No hay casos abiertos. ¡Todo al día! 🎉' : 'Todavía no hay casos cerrados.'}</p>`;
      return;
    }
    list.innerHTML = tickets.map(t => `
      <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 1.25rem; margin-bottom: 1rem;" id="ticket-${escapeHtml(t.id)}">
        <div style="display: flex; justify-content: space-between; gap: 1rem; flex-wrap: wrap; margin-bottom: 0.5rem;">
          <div>
            <span class="badge" style="background: rgba(139,92,246,0.15); color: #8B5CF6; border: 1px solid #8B5CF6;">${escapeHtml(SUPPORT_CATEGORY[t.category] || t.category)}</span>
            ${t.lastSender === 'user' && t.status === 'open' ? '<span class="badge" style="background: rgba(239,68,68,0.15); color: #EF4444; border: 1px solid #EF4444; margin-left: 0.4rem;">Espera respuesta</span>' : ''}
            <h3 style="font-size: 1.05rem; margin-top: 0.5rem;">${escapeHtml(t.subject)}</h3>
            <div style="font-size: 0.85rem; color: var(--text-secondary);">${escapeHtml(t.userName || 'Cliente')} · ${escapeHtml(t.userEmail || '')}${t.userPhone ? ' · ' + escapeHtml(t.userPhone) : ''}${t.order_id ? ' · Pedido ' + escapeHtml(t.order_id) : ''}</div>
          </div>
          <div style="font-size: 0.8rem; color: var(--text-muted);">${escapeHtml(t.created_at || '')}</div>
        </div>
        <div style="display: flex; gap: 0.5rem; margin-top: 0.75rem;">
          <button class="badge" style="background: #8B5CF6; color: #fff; padding: 0.5rem 1rem; cursor: pointer;" onclick="openSupportTicket('${escapeHtml(t.id)}')">Abrir conversación</button>
          ${t.status === 'open' ? `<button class="badge" style="background: transparent; color: var(--text-secondary); border: 1px solid var(--border-color); padding: 0.5rem 1rem; cursor: pointer;" onclick="closeSupportTicket('${escapeHtml(t.id)}')">Cerrar caso</button>` : ''}
        </div>
        <div id="ticket-thread-${escapeHtml(t.id)}" style="display: none; margin-top: 1rem;"></div>
      </div>`).join('');
  };

  window.openSupportTicket = async function(id) {
    const box = document.getElementById('ticket-thread-' + id);
    if (!box) return;
    if (box.style.display === 'block') { box.style.display = 'none'; return; }
    const messages = await window.rapidinDB.getAdminSupportMessages(id);
    const bubbles = messages.map(m => {
      const mine = m.sender_role === 'support';
      return `<div style="display: flex; justify-content: ${mine ? 'flex-end' : 'flex-start'}; margin-bottom: 0.5rem;">
        <div style="max-width: 80%; padding: 0.6rem 0.9rem; border-radius: 14px; font-size: 0.9rem; background: ${mine ? '#8B5CF6' : 'var(--bg-main)'}; color: ${mine ? '#fff' : 'var(--text-primary)'};">
          ${escapeHtml(m.text || '')}${m.image_url ? '<div style="font-size:0.75rem;opacity:0.8;">📎 imagen adjunta</div>' : ''}
          <div style="font-size: 0.7rem; opacity: 0.65; margin-top: 0.2rem;">${mine ? 'Soporte' : 'Cliente'} · ${escapeHtml(m.created_at || '')}</div>
        </div></div>`;
    }).join('');
    box.innerHTML = `
      <div style="background: var(--bg-card); border-top: 1px solid var(--border-color); padding-top: 1rem;">${bubbles || '<p style="color: var(--text-secondary);">Sin mensajes.</p>'}</div>
      <div style="display: flex; gap: 0.5rem; margin-top: 0.75rem;">
        <input class="coupon-input" id="reply-input-${escapeHtml(id)}" placeholder="Escribe tu respuesta al cliente…" style="flex: 1;">
        <button class="badge" style="background: #10B981; color: #fff; padding: 0.6rem 1.1rem; cursor: pointer;" onclick="sendSupportReply('${escapeHtml(id)}')">Enviar</button>
      </div>`;
    box.style.display = 'block';
  };

  window.sendSupportReply = async function(id) {
    const input = document.getElementById('reply-input-' + id);
    const text = input.value.trim();
    if (!text) return;
    const res = await window.rapidinDB.replyAdminSupportTicket(id, text);
    if (res.success) {
      const box = document.getElementById('ticket-thread-' + id);
      box.style.display = 'none';
      await window.openSupportTicket(id);
    } else {
      window.rapidinAlert(res.message || 'No se pudo enviar la respuesta.');
    }
  };

  window.closeSupportTicket = async function(id) {
    if (!confirm('¿Cerrar este caso? El cliente ya no podrá escribir en él.')) return;
    const res = await window.rapidinDB.closeAdminSupportTicket(id);
    if (res.success) loadSupportTickets(supportFilter);
    else window.rapidinAlert(res.message || 'No se pudo cerrar el caso.');
  };

  // ==========================================
  // CUPONES de la plataforma
  // ==========================================
  async function renderAdminCoupons() {
    const list = document.getElementById('admin-coupons-list');
    const coupons = await window.rapidinDB.getAdminCoupons();
    if (!coupons.length) {
      list.innerHTML = '<p style="color: var(--text-secondary);">Todavía no hay cupones de la plataforma.</p>';
      return;
    }
    const label = (c) => c.discount_type === 'percent' ? `${Math.round(c.discount_value * 100)}% OFF` : c.discount_type === 'fixed' ? `$${Number(c.discount_value).toFixed(2)} OFF` : 'Envío gratis';
    list.innerHTML = `<div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-lg); overflow-x: auto;">
      <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.9rem;">
        <thead><tr style="background: var(--bg-main); color: var(--text-muted); font-size: 0.8rem; text-transform: uppercase;">
          <th style="padding: 0.9rem;">Código</th><th style="padding: 0.9rem;">Descuento</th><th style="padding: 0.9rem;">Mínimo</th><th style="padding: 0.9rem;">Vence</th><th style="padding: 0.9rem;">Canjes / Usos</th><th style="padding: 0.9rem;">Estado</th></tr></thead>
        <tbody>${coupons.map(c => {
          const expired = c.expires_at && new Date(c.expires_at.replace(' ', 'T') + 'Z') < new Date();
          return `<tr style="border-top: 1px solid var(--border-color); ${c.is_active ? '' : 'opacity: 0.55;'}">
            <td style="padding: 0.9rem; font-weight: 800; color: #8B5CF6;">${escapeHtml(c.code)}<div style="font-weight: 500; font-size: 0.8rem; color: var(--text-secondary);">${escapeHtml(c.title)}</div></td>
            <td style="padding: 0.9rem;">${escapeHtml(label(c))}</td>
            <td style="padding: 0.9rem;">${c.min_order_usd ? '$' + Number(c.min_order_usd).toFixed(2) : '—'}</td>
            <td style="padding: 0.9rem; ${expired ? 'color: #EF4444;' : ''}">${c.expires_at ? escapeHtml(c.expires_at.slice(0, 10)) + (expired ? ' (vencido)' : '') : 'Sin vencimiento'}</td>
            <td style="padding: 0.9rem;">${c.redeemedCount} / ${c.usedCount}</td>
            <td style="padding: 0.9rem;"><button class="badge" style="background: ${c.is_active ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'}; color: ${c.is_active ? '#10B981' : '#EF4444'}; border: 1px solid currentColor; cursor: pointer;" onclick="toggleAdminCoupon('${escapeHtml(c.id)}')">${c.is_active ? 'Activo' : 'Pausado'}</button></td>
          </tr>`; }).join('')}</tbody>
      </table></div>`;
  }

  window.toggleAdminCoupon = async function(id) {
    const res = await window.rapidinDB.toggleAdminCoupon(id);
    if (res.success) renderAdminCoupons();
    else window.rapidinAlert(res.message || 'No se pudo actualizar el cupón.');
  };

  document.getElementById('form-admin-coupon')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('coupon-form-msg');
    const type = document.getElementById('cpn-type').value;
    const raw = Number(document.getElementById('cpn-value').value) || 0;
    const exp = document.getElementById('cpn-expires').value;
    const res = await window.rapidinDB.createAdminCoupon({
      code: document.getElementById('cpn-code').value.trim(),
      title: document.getElementById('cpn-title').value.trim(),
      description: document.getElementById('cpn-desc').value.trim(),
      discountType: type,
      discountValue: type === 'percent' ? raw / 100 : (type === 'shipping' ? 0 : raw),
      minOrder: Number(document.getElementById('cpn-min').value) || 0,
      promoType: document.getElementById('cpn-promo-type').value,
      expiresAt: exp ? `${exp} 23:59:59` : null
    });
    if (res.success) {
      msg.style.color = '#10B981'; msg.textContent = '✅ Cupón creado.';
      e.target.reset();
      renderAdminCoupons();
    } else {
      msg.style.color = '#EF4444'; msg.textContent = res.message || 'No se pudo crear el cupón.';
    }
  });

  window.rapidinSync.subscribe('ORDER_CREATED', () => renderAdminOverview());
  window.rapidinSync.subscribe('ORDER_STATUS_CHANGED', () => renderAdminOverview());

  window.loadAdminApp = function() {
    renderAdminOverview();
  };
});
