/* ==========================================================================
   RAPIDIN - DRIVER APP LOGIC WITH GPS MAP NAVEGATION
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  let earnings = 78.50;
  let completedTrips = 8;
  let driverMap = null;
  let driverMarker = null;

  function initDriverMap() {
    const mapEl = document.getElementById('driver-map');
    if (!mapEl || driverMap) return;

    const startLat = -12.0865;
    const startLng = -77.0335;

    driverMap = L.map('driver-map', { zoomControl: false }).setView([startLat, startLng], 15);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; CARTO',
      maxZoom: 19
    }).addTo(driverMap);

    const driverIcon = L.divIcon({
      className: 'custom-driver-gps-pin',
      html: `<div style="background: #FF6600; color: #fff; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; border: 3px solid #fff; box-shadow: 0 0 16px rgba(255,102,0,0.6);"><i class="fa-solid fa-motorcycle"></i></div>`,
      iconSize: [40, 40]
    });

    driverMarker = L.marker([startLat, startLng], { icon: driverIcon }).addTo(driverMap);
  }

  window.simulateDriverGPSMovement = function() {
    if (!driverMarker) return;
    let step = 0;
    const interval = setInterval(() => {
      step += 0.0005;
      const newLat = -12.0865 + step;
      const newLng = -77.0335 - step;
      driverMarker.setLatLng([newLat, newLng]);
      driverMap.panTo([newLat, newLng]);

      if (step > 0.005) {
        clearInterval(interval);
        window.rapidinAlert('📍 Simulación GPS: ¡Has llegado a la ubicación del cliente!');
      }
    }, 500);
  };

  async function renderDriverJobs() {
    const container = document.getElementById('driver-jobs-list');
    if (!container) return;

    try {
      const response = await fetch('http://localhost:3000/api/orders/pending');
      const data = await response.json();
      const orders = data.success ? data.orders : [];

      if (orders.length === 0) {
        container.innerHTML = `
          <div style="text-align: center; padding: 3rem; background: var(--bg-card); border-radius: var(--radius-lg); border: 1px solid var(--border-color);">
            <i class="fa-solid fa-route" style="font-size: 3rem; color: var(--text-muted); margin-bottom: 1rem;"></i>
            <h3>No hay ofertas de viaje en este momento</h3>
            <p style="color: var(--text-secondary);">Mantente conectado, te notificaremos cuando un restaurante marque un pedido listo.</p>
          </div>
        `;
        return;
      }

    container.innerHTML = orders.map(order => {
      // Usamos total_amount_usd si existe, o calculamos un pago estimado
      const driverTip = order.driver_tip_usd || order.driverTip || 0;
      const driverPay = 3.50 + driverTip;

      return `
        <div class="card-job">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
            <div>
              <span class="badge" style="background: var(--brand-secondary); color: #fff; margin-bottom: 0.4rem;">VIAJE DISPONIBLE #${order.id}</span>
              <h3 style="font-size: 1.2rem;">${order.storeName || order.store_id}</h3>
              <p style="color: var(--text-secondary); font-size: 0.85rem;"><i class="fa-solid fa-map-pin"></i> Destino: ${order.customer_address || order.customerAddress || 'Ubicación desconocida'}</p>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 1.6rem; font-weight: 900; color: #10B981; font-family: var(--font-heading);">$${driverPay.toFixed(2)}</div>
              <span style="font-size: 0.75rem; color: var(--text-muted);">Pago al Repartidor</span>
            </div>
          </div>

          <div style="background: var(--bg-main); padding: 1rem; border-radius: var(--radius-md); margin-bottom: 1rem; font-size: 0.85rem;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.3rem;">
              <span>Recojo en Tienda:</span>
              <strong style="color: var(--brand-primary);">${order.storeName || order.store_id}</strong>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span>Entrega a Cliente:</span>
              <strong>${order.customer_address || order.customerAddress || ''}</strong>
            </div>
          </div>

          <div style="display: flex; gap: 0.75rem; justify-content: flex-end;">
            ${(order.status_step || order.statusStep) < 2 ? `
              <button class="badge" style="background: var(--brand-secondary); color: #fff; padding: 0.75rem 1.5rem; font-size: 0.9rem;" onclick="acceptTrip('${order.id}')">
                <i class="fa-solid fa-motorcycle"></i> Aceptar Pedido y Salir en Ruta 🛵
              </button>
            ` : (order.status_step || order.statusStep) === 2 ? `
              <button class="badge" style="background: #10B981; color: #000; padding: 0.75rem 1.5rem; font-size: 0.9rem;" onclick="completeTrip('${order.id}', ${driverPay})">
                <i class="fa-solid fa-check"></i> Marcar Entregado al Cliente ✅
              </button>
            ` : `
              <span class="badge" style="background: rgba(255,255,255,0.1); color: #10B981; padding: 0.5rem 1rem;">
                ✔ ENTREGADO Y COBRADO
              </span>
            `}
          </div>
        </div>
      `;
    }).join('');
    } catch (e) {
      console.error('Error fetching driver jobs:', e);
    }
  }

  window.acceptTrip = async function(orderId) {
    await window.rapidinSync.updateOrderStatus(orderId, 2, { statusText: 'Repartidor en camino con tu paquete 🛵' });
    window.rapidinAlert('🛵 ¡Viaje Aceptado! La app de Cliente y Restaurante han sido actualizadas.');
    renderDriverJobs();
  };

  window.completeTrip = async function(orderId, driverPay) {
    await window.rapidinSync.updateOrderStatus(orderId, 3, { statusText: 'Pedido Entregado con éxito 🎉' });
    earnings += driverPay;
    completedTrips++;

    document.getElementById('driver-total-earnings').textContent = `$${earnings.toFixed(2)}`;
    document.getElementById('driver-trips-count').textContent = completedTrips;

    window.rapidinAlert(`🎉 ¡Entrega completada! $${driverPay.toFixed(2)} agregados a tu billetera.`);
    renderDriverJobs();
  };

  window.rapidinSync.subscribe('ORDER_CREATED', renderDriverJobs);
  window.rapidinSync.subscribe('ORDER_STATUS_CHANGED', renderDriverJobs);

  initDriverMap();
  renderDriverJobs();
});
