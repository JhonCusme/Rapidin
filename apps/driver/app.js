/* ==========================================================================
   RAPIDIN - PANEL DE REPARTIDORES (Acceso, Dashboard, Entregas, GPS real)
   ========================================================================== */

function fmtMoneyDriver(n) { return '$' + Number(n || 0).toFixed(2); }

let driverMap = null;
let driverMarker = null;
let geoWatchId = null;
let currentActiveDelivery = null;
let currentPendingJobs = [];

// ==========================================
// AUTH GATE
// ==========================================
function checkAuthGate() {
  const driver = window.rapidinDB.getCurrentUser('driver');
  if (driver) {
    document.getElementById('auth-gate-screen').style.display = 'none';
    document.getElementById('main-app-content').style.display = 'block';
    loadDashboard();
    loadActiveDelivery();
    loadActiveShipment();
    loadPendingJobs();
    loadPendingShipments();
    initDriverMap();
    startLocationSharing();
  } else {
    document.getElementById('auth-gate-screen').style.display = 'flex';
    document.getElementById('main-app-content').style.display = 'none';
    stopLocationSharing();
  }
}

document.getElementById('gate-driver-form-login')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('gate-driver-login-email').value;
  const pass = document.getElementById('gate-driver-login-password').value;
  const errorEl = document.getElementById('gate-login-error');
  errorEl.style.display = 'none';

  const res = await window.rapidinDB.login(email, pass, 'driver');
  if (res.success) {
    checkAuthGate();
  } else {
    errorEl.textContent = res.message || 'No se pudo iniciar sesión.';
    errorEl.style.display = 'block';
  }
});

document.getElementById('form-driver-register')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const driverData = {
    role: 'driver',
    name: document.getElementById('reg-driver-name').value,
    vehicle_type: document.getElementById('reg-driver-vehicle-type').value,
    vehicle_plate: document.getElementById('reg-driver-plate').value,
    email: document.getElementById('reg-driver-email').value,
    password: document.getElementById('reg-driver-password').value
  };

  const errorEl = document.getElementById('register-error');
  errorEl.style.display = 'none';

  const res = await window.rapidinDB.registerUser(driverData);
  if (res.success) {
    document.getElementById('modal-driver-register').classList.remove('active');
    window.rapidinAlert(`🛵 ¡Repartidor "${driverData.name}" registrado correctamente!`);
    checkAuthGate();
  } else {
    errorEl.textContent = res.message || 'No se pudo completar el registro.';
    errorEl.style.display = 'block';
  }
});

document.getElementById('btn-close-driver-reg')?.addEventListener('click', () => {
  document.getElementById('modal-driver-register').classList.remove('active');
});

document.getElementById('btn-driver-logout')?.addEventListener('click', () => {
  if (!confirm('¿Deseas cerrar sesión?')) return;
  window.rapidinDB.logout('driver');
  window.location.reload();
});

// ==========================================
// DASHBOARD
// ==========================================
async function loadDashboard() {
  const data = await window.rapidinDB.getDriverDashboard();
  if (!data) return;

  document.getElementById('driver-name-label').textContent = data.name;
  document.getElementById('driver-meta-label').textContent = `${data.vehicleInfo} • ★ ${data.rating}`;
  document.getElementById('driver-earnings-today').textContent = fmtMoneyDriver(data.earningsToday);
  document.getElementById('driver-trips-today').textContent = data.tripsToday;
  document.getElementById('driver-earnings-total').textContent = fmtMoneyDriver(data.earningsTotal);

  renderDriverStatusButton(data.isOnline);
}

function renderDriverStatusButton(isOnline) {
  const btn = document.getElementById('btn-toggle-driver-status');
  const text = document.getElementById('driver-status-text');
  btn.classList.toggle('offline', !isOnline);
  text.textContent = isOnline ? 'CONECTADO' : 'DESCONECTADO';
}

document.getElementById('btn-toggle-driver-status')?.addEventListener('click', async () => {
  const btn = document.getElementById('btn-toggle-driver-status');
  const goingOnline = btn.classList.contains('offline');
  const res = await window.rapidinDB.updateDriverStatus(goingOnline);
  if (res.success) renderDriverStatusButton(res.isOnline);
  else window.rapidinAlert(res.message || 'No se pudo actualizar tu estado.');
});

// ==========================================
// GPS REAL
// ==========================================
function initDriverMap() {
  if (driverMap) return;
  const mapEl = document.getElementById('driver-map');
  if (!mapEl) return;

  driverMap = L.map('driver-map', { zoomControl: false }).setView([-12.0464, -77.0428], 13);
  L.tileLayer(window.RAPIDIN_TILE_URL, {
    attribution: window.RAPIDIN_TILE_ATTRIBUTION, maxZoom: 19
  }).addTo(driverMap);
}

function updateDriverMarker(lat, lng) {
  if (!driverMap) return;
  if (driverMarker) {
    driverMarker.setLatLng([lat, lng]);
  } else {
    const driverIcon = L.divIcon({
      className: 'custom-driver-gps-pin',
      html: `<div style="background: #FF6600; color: #fff; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; border: 3px solid #fff; box-shadow: 0 0 16px rgba(255,102,0,0.6);"><i class="fa-solid fa-motorcycle"></i></div>`,
      iconSize: [40, 40]
    });
    driverMarker = L.marker([lat, lng], { icon: driverIcon }).addTo(driverMap);
  }
  driverMap.setView([lat, lng], 15);
}

let locationUpdateThrottle = 0;
function startLocationSharing() {
  if (!navigator.geolocation) {
    document.getElementById('driver-location-status').textContent = 'Tu navegador no soporta geolocalización.';
    return;
  }
  geoWatchId = navigator.geolocation.watchPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;
      updateDriverMarker(latitude, longitude);
      document.getElementById('driver-location-status').textContent = 'Compartiendo tu ubicación en tiempo real.';

      const now = Date.now();
      if (now - locationUpdateThrottle > 15000) {
        locationUpdateThrottle = now;
        window.rapidinDB.updateDriverLocation(latitude, longitude);
      }
    },
    () => {
      document.getElementById('driver-location-status').textContent = 'No pudimos acceder a tu ubicación. Actívala para recibir pedidos cercanos.';
    },
    { enableHighAccuracy: true, maximumAge: 10000 }
  );
}

function stopLocationSharing() {
  if (geoWatchId !== null && navigator.geolocation) {
    navigator.geolocation.clearWatch(geoWatchId);
    geoWatchId = null;
  }
}

// ==========================================
// ENTREGA ACTIVA
// ==========================================
async function loadActiveDelivery() {
  currentActiveDelivery = await window.rapidinDB.getMyActiveDelivery();
  renderActiveDelivery();
}

function renderActiveDelivery() {
  const section = document.getElementById('active-delivery-section');
  const card = document.getElementById('active-delivery-card');
  if (!currentActiveDelivery) {
    section.style.display = 'none';
    return;
  }
  section.style.display = 'block';
  const order = currentActiveDelivery;
  const driverPay = (order.shipping_fee_usd || 0) + (order.driver_tip_usd || 0);
  card.innerHTML = `
    <div class="card-job active-delivery">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
        <div>
          <span class="badge" style="background: #10B981; color: #000; margin-bottom: 0.4rem;">EN CAMINO #${escapeHtml(order.id)}</span>
          <h3 style="font-size: 1.15rem;">${escapeHtml(order.customerName || 'Cliente')}</h3>
          <p style="color: var(--text-secondary); font-size: 0.85rem;"><i class="fa-solid fa-map-pin"></i> ${escapeHtml(order.customer_address || '')}</p>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 1.4rem; font-weight: 900; color: #10B981;">${fmtMoneyDriver(driverPay)}</div>
          <span style="font-size: 0.75rem; color: var(--text-muted);">Tu pago</span>
        </div>
      </div>
      <div style="background: var(--bg-main); padding: 1rem; border-radius: var(--radius-md); margin-bottom: 1rem; font-size: 0.85rem;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 0.3rem;">
          <span>Recogido en:</span><strong style="color: var(--brand-primary);">${escapeHtml(order.storeName || '')}</strong>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span>Teléfono del cliente:</span><strong>${escapeHtml(order.customerPhone || '—')}</strong>
        </div>
      </div>
      <button class="badge" style="background: #10B981; color: #000; padding: 0.75rem 1.5rem; font-size: 0.9rem; width: 100%; justify-content: center; display: flex;" onclick="completeDelivery('${order.id}')">
        <i class="fa-solid fa-check"></i> Marcar entregado al cliente
      </button>
    </div>
  `;
}

window.completeDelivery = async function(orderId) {
  const res = await window.rapidinDB.updateOrderStatusAsDriver(orderId, 4, 'Pedido entregado con éxito 🎉');
  if (res.success) {
    window.rapidinAlert('🎉 ¡Entrega completada! Tu pago fue agregado a tus ganancias.');
    await loadActiveDelivery();
    await loadDashboard();
    await loadPendingJobs();
  } else {
    window.rapidinAlert(res.message || 'No se pudo marcar como entregado.');
  }
};

// ==========================================
// PEDIDOS DISPONIBLES
// ==========================================
async function loadPendingJobs() {
  currentPendingJobs = await window.rapidinDB.getPendingDeliveries();
  renderPendingJobs();
}

function renderPendingJobs() {
  const container = document.getElementById('driver-jobs-list');
  if (!container) return;

  if (currentActiveDelivery || currentActiveShipment) {
    container.innerHTML = `
      <div style="text-align: center; padding: 2rem; background: var(--bg-card); border-radius: var(--radius-lg); border: 1px solid var(--border-color);">
        <p style="color: var(--text-secondary);">Termina tu entrega actual antes de aceptar otro pedido.</p>
      </div>
    `;
    return;
  }

  if (!currentPendingJobs.length) {
    container.innerHTML = `
      <div style="text-align: center; padding: 3rem; background: var(--bg-card); border-radius: var(--radius-lg); border: 1px solid var(--border-color);">
        <i class="fa-solid fa-route" style="font-size: 3rem; color: var(--text-muted); margin-bottom: 1rem;"></i>
        <h3>No hay pedidos disponibles</h3>
        <p style="color: var(--text-secondary);">Te avisaremos cuando un comercio marque un pedido listo.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = currentPendingJobs.map(order => {
    const driverPay = (order.shipping_fee_usd || 0) + (order.driver_tip_usd || 0);
    const isReady = order.status_step === 2;
    return `
      <div class="card-job">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
          <div>
            <span class="badge" style="background: var(--brand-secondary); color: #fff; margin-bottom: 0.4rem;">PEDIDO #${escapeHtml(order.id)}</span>
            <h3 style="font-size: 1.1rem;">${escapeHtml(order.storeName || order.store_id)}</h3>
            <p style="color: var(--text-secondary); font-size: 0.85rem;"><i class="fa-solid fa-map-pin"></i> ${escapeHtml(order.customer_address || 'Ubicación desconocida')}</p>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 1.4rem; font-weight: 900; color: #10B981;">${fmtMoneyDriver(driverPay)}</div>
            <span style="font-size: 0.75rem; color: var(--text-muted);">Pago estimado</span>
          </div>
        </div>
        <div style="display: flex; justify-content: flex-end;">
          ${isReady ? `
            <button class="badge" style="background: var(--brand-secondary); color: #fff; padding: 0.75rem 1.5rem; font-size: 0.9rem;" onclick="acceptDelivery('${order.id}')">
              <i class="fa-solid fa-motorcycle"></i> Aceptar y recoger
            </button>
          ` : `
            <span class="badge" style="background: rgba(245,158,11,0.15); color: #F59E0B; padding: 0.6rem 1rem;">
              <i class="fa-solid fa-clock"></i> El comercio todavía lo está preparando
            </span>
          `}
        </div>
      </div>
    `;
  }).join('');
}

window.acceptDelivery = async function(orderId) {
  const res = await window.rapidinDB.updateOrderStatusAsDriver(orderId, 3, 'Repartidor en camino con tu pedido 🛵');
  if (res.success) {
    window.rapidinAlert('🛵 ¡Pedido aceptado! Dirígete al comercio a recogerlo.');
    await loadActiveDelivery();
    await loadPendingJobs();
  } else {
    window.rapidinAlert(res.message || 'No se pudo aceptar el pedido.');
  }
};

// ==========================================
// ENVÍOS "MÁNDAME ALGO"
// ==========================================
let currentPendingShipments = [];
let currentActiveShipment = null;
const SHIPMENT_SIZES = { small: 'Pequeño', medium: 'Mediano', large: 'Grande' };

async function loadPendingShipments() {
  currentPendingShipments = await window.rapidinDB.getPendingShipments();
  renderPendingShipments();
}

function renderPendingShipments() {
  const container = document.getElementById('driver-shipments-list');
  if (!container) return;

  if (currentActiveDelivery || currentActiveShipment) {
    container.innerHTML = `<div style="text-align: center; padding: 1.5rem; background: var(--bg-card); border-radius: var(--radius-lg); border: 1px solid var(--border-color);"><p style="color: var(--text-secondary);">Termina tu entrega actual para ver envíos disponibles.</p></div>`;
    return;
  }
  if (!currentPendingShipments.length) {
    container.innerHTML = `
      <div style="text-align: center; padding: 2rem; background: var(--bg-card); border-radius: var(--radius-lg); border: 1px solid var(--border-color);">
        <i class="fa-solid fa-box-open" style="font-size: 2.2rem; color: var(--text-muted); margin-bottom: 0.8rem;"></i>
        <h3>No hay envíos disponibles</h3>
        <p style="color: var(--text-secondary);">Cuando un cliente pida un envío, aparecerá aquí.</p>
      </div>`;
    return;
  }
  container.innerHTML = currentPendingShipments.map(s => `
    <div class="card-job">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem; gap: 1rem;">
        <div>
          <span class="badge" style="background: var(--brand-secondary); color: #fff; margin-bottom: 0.4rem;">ENVÍO #${escapeHtml(s.id)}</span>
          <p style="font-size: 0.85rem; margin-bottom: 0.3rem;"><i class="fa-solid fa-circle" style="color: #10B981; font-size: 0.6rem;"></i> <strong>Recoger:</strong> ${escapeHtml(s.origin_address)}</p>
          <p style="font-size: 0.85rem; color: var(--text-secondary);"><i class="fa-solid fa-circle" style="color: #EF4444; font-size: 0.6rem;"></i> <strong>Entregar:</strong> ${escapeHtml(s.destination_address)}</p>
          <p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.4rem;">${escapeHtml(SHIPMENT_SIZES[s.package_size] || s.package_size)}${s.package_description ? ' · ' + escapeHtml(s.package_description) : ''}${s.distance_km ? ' · ' + Number(s.distance_km).toFixed(1) + ' km' : ''}</p>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 1.4rem; font-weight: 900; color: #10B981;">${fmtMoneyDriver(s.driverPay)}</div>
          <span style="font-size: 0.75rem; color: var(--text-muted);">Pago estimado</span>
        </div>
      </div>
      <div style="display: flex; justify-content: flex-end;">
        <button class="badge" style="background: var(--brand-secondary); color: #fff; padding: 0.75rem 1.5rem; font-size: 0.9rem;" onclick="acceptShipment('${s.id}')">
          <i class="fa-solid fa-motorcycle"></i> Aceptar envío
        </button>
      </div>
    </div>`).join('');
}

async function loadActiveShipment() {
  currentActiveShipment = await window.rapidinDB.getMyActiveShipment();
  renderActiveShipment();
}

function renderActiveShipment() {
  const section = document.getElementById('active-shipment-section');
  const card = document.getElementById('active-shipment-card');
  if (!section || !card) return;
  if (!currentActiveShipment) { section.style.display = 'none'; return; }
  section.style.display = 'block';
  const s = currentActiveShipment;
  const toPickup = s.status_step === 1;
  card.innerHTML = `
    <div class="card-job active-delivery">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem; gap: 1rem;">
        <div>
          <span class="badge" style="background: #10B981; color: #000; margin-bottom: 0.4rem;">${toPickup ? 'IR A RECOGER' : 'EN CAMINO'} #${escapeHtml(s.id)}</span>
          <p style="font-size: 0.85rem; margin-bottom: 0.3rem;"><i class="fa-solid fa-circle" style="color: #10B981; font-size: 0.6rem;"></i> <strong>Recoger:</strong> ${escapeHtml(s.origin_address)}</p>
          <p style="font-size: 0.85rem; color: var(--text-secondary);"><i class="fa-solid fa-circle" style="color: #EF4444; font-size: 0.6rem;"></i> <strong>Entregar:</strong> ${escapeHtml(s.destination_address)}</p>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 1.4rem; font-weight: 900; color: #10B981;">${fmtMoneyDriver(s.driverPay)}</div>
          <span style="font-size: 0.75rem; color: var(--text-muted);">Tu pago</span>
        </div>
      </div>
      <div style="background: var(--bg-main); padding: 1rem; border-radius: var(--radius-md); margin-bottom: 1rem; font-size: 0.85rem;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 0.3rem;"><span>Quien lo envía:</span><strong>${escapeHtml(s.customerName || 'Cliente')} · ${escapeHtml(s.customerPhone || '—')}</strong></div>
        <div style="display: flex; justify-content: space-between;"><span>Quien lo recibe:</span><strong>${escapeHtml(s.recipient_name || '—')} · ${escapeHtml(s.recipient_phone || '—')}</strong></div>
      </div>
      <button class="badge" style="background: #10B981; color: #000; padding: 0.75rem 1.5rem; font-size: 0.9rem; width: 100%; justify-content: center; display: flex;" onclick="advanceShipment('${s.id}', ${s.status_step + 1})">
        <i class="fa-solid fa-check"></i> ${toPickup ? 'Ya recogí el paquete' : 'Marcar entregado'}
      </button>
    </div>`;
}

window.acceptShipment = async function(id) {
  const res = await window.rapidinDB.updateShipmentStatus(id, 1);
  if (res.success) {
    window.rapidinAlert('🛵 ¡Envío aceptado! Dirígete al punto de recogida.');
    await loadActiveShipment(); // primero el estado activo: así las listas ya salen bloqueadas
    await Promise.all([loadPendingShipments(), loadPendingJobs()]);
  } else {
    window.rapidinAlert(res.message || 'No se pudo aceptar el envío.');
    loadPendingShipments();
  }
};

window.advanceShipment = async function(id, nextStep) {
  const res = await window.rapidinDB.updateShipmentStatus(id, nextStep);
  if (res.success) {
    if (nextStep === 3) window.rapidinAlert('🎉 ¡Envío entregado! Tu pago fue agregado a tus ganancias.');
    await loadActiveShipment();
    await Promise.all([loadPendingShipments(), loadDashboard(), loadPendingJobs()]);
  } else {
    window.rapidinAlert(res.message || 'No se pudo actualizar el envío.');
  }
};

// ==========================================
// TIEMPO REAL
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  checkAuthGate();

  window.rapidinSync.subscribe('ORDER_STATUS_CHANGED', () => {
    loadPendingJobs();
    if (currentActiveDelivery) loadActiveDelivery();
  });

  window.rapidinSync.subscribe('SHIPMENT_CREATED', () => loadPendingShipments());
  window.rapidinSync.subscribe('SHIPMENT_STATUS_CHANGED', () => {
    loadPendingShipments();
    loadActiveShipment();
  });

  // Latido: refresca cada 30 s (también mantiene al repartidor como "en línea" para la plataforma)
  setInterval(() => {
    if (!window.rapidinDB.getCurrentUser('driver')) return;
    loadDashboard();
    loadPendingJobs();
    loadPendingShipments();
  }, 30000);

  window.rapidinSync.subscribe('ORDER_CREATED', () => {
    // Un pedido recién creado no está listo para recoger todavía, pero refrescamos
    // por si el comercio ya lo marca listo enseguida.
  });
});
