/* ==========================================================================
   RAPIDIN - PERSISTENT DATABASE & AUTHENTICATION SERVICE 🗄️🔐 (REAL API JWT)
   ========================================================================== */

const RAPIDIN_KEY_AUTH_USER = 'rapidin_auth_user';
const RAPIDIN_KEY_AUTH_STORE = 'rapidin_auth_store';
const RAPIDIN_KEY_AUTH_DRIVER = 'rapidin_auth_driver';
const RAPIDIN_KEY_AUTH_ADMIN = 'rapidin_auth_admin';
const API_URL = `${window.RAPIDIN_API_BASE}/api`;

class RapidinDatabase {
  
  // === AUTENTICACIÓN & LOGIN (API REAL CON JWT) ===
  async login(email, password, role = 'user') {
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, role })
      });
      const data = await response.json();
      
      if (data.success) {
        const sessionKey = this._getSessionKeyByRole(role);
        // Guardamos el token y los datos de usuario devueltos
        localStorage.setItem(sessionKey, JSON.stringify({
          token: data.token,
          ...data.user
        }));
        return { success: true, user: data.user };
      }
      return { success: false, message: data.message || 'No se pudo iniciar sesión' };
    } catch (e) {
      console.error('API no disponible. Asegúrate de iniciar server.js');
      return { success: false, message: 'Servidor no disponible.' };
    }
  }

  async registerAdmin({ name, email, password, setupKey }) {
    try {
      const response = await fetch(`${API_URL}/auth/register-admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, setupKey })
      });
      const data = await response.json();
      if (data.success) {
        localStorage.setItem(this._getSessionKeyByRole('admin'), JSON.stringify({ token: data.token, ...data.user }));
        return { success: true, user: data.user };
      }
      return { success: false, message: data.message || 'No se pudo crear la cuenta de administrador.' };
    } catch (e) {
      return { success: false, message: 'Error de conexión con el servidor.' };
    }
  }

  // Envía un código de verificación real por SMS (Twilio Verify) al número indicado.
  async sendOtp(phone) {
    try {
      const response = await fetch(`${API_URL}/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone })
      });
      const data = await response.json();
      return data;
    } catch (e) {
      return { success: false, message: 'Error de conexión con el servidor.' };
    }
  }

  // Verifica el código SMS contra Twilio y devuelve un ticket de corta duración
  // que prueba la propiedad del número, usado luego en phoneLogin().
  async verifyOtp(phone, code) {
    try {
      const response = await fetch(`${API_URL}/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code })
      });
      const data = await response.json();
      return data;
    } catch (e) {
      return { success: false, message: 'Error de conexión con el servidor.' };
    }
  }

  // Login/registro por teléfono. Requiere un verificationTicket real emitido por
  // verifyOtp() tras confirmar el código SMS; el backend crea la cuenta si el
  // teléfono es nuevo, o inicia sesión si ya existe.
  async phoneLogin({ phone, name, email, referralCode, verificationTicket }) {
    try {
      const response = await fetch(`${API_URL}/auth/phone-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, name, email, referralCode, verificationTicket })
      });
      const data = await response.json();

      if (data.success) {
        localStorage.setItem(RAPIDIN_KEY_AUTH_USER, JSON.stringify({
          token: data.token,
          ...data.user
        }));
        return { success: true, user: data.user };
      }
      return { success: false, message: data.message || 'No se pudo verificar el número.' };
    } catch (e) {
      return { success: false, message: 'Error de conexión con el servidor.' };
    }
  }

  async registerUser(userData) {
    try {
      let endpoint = `${API_URL}/auth/register-user`;
      if (userData.role === 'store') endpoint = `${API_URL}/auth/register-store`;
      if (userData.role === 'driver') endpoint = `${API_URL}/auth/register-driver`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });
      const data = await response.json();
      
      if (data.success) {
        const sessionKey = this._getSessionKeyByRole(userData.role || 'user');
        localStorage.setItem(sessionKey, JSON.stringify({
          token: data.token,
          ...data.user
        }));
        return { success: true, user: data.user };
      } else {
        return { success: false, message: data.message };
      }
    } catch (e) {
      return { success: false, message: 'Error de conexión con el servidor.' };
    }
  }

  getCurrentUser(role = 'user') {
    const sessionKey = this._getSessionKeyByRole(role);
    const data = localStorage.getItem(sessionKey);
    return data ? JSON.parse(data) : null;
  }

  // ==========================================
  // PANEL DE COMERCIOS (Rapidín Comercios)
  // ==========================================

  async getStoreOrders(storeId) {
    try {
      const response = await fetch(`${API_URL}/orders/store/${storeId}`, { headers: this.getAuthHeaders('store') });
      const data = await response.json();
      return data.success ? data.orders : [];
    } catch (e) {
      console.error('Error obteniendo pedidos del comercio:', e);
      return [];
    }
  }

  async getStoreDashboard() {
    try {
      const response = await fetch(`${API_URL}/stores/me/dashboard`, { headers: this.getAuthHeaders('store') });
      const data = await response.json();
      return data.success ? data : null;
    } catch (e) {
      console.error('Error obteniendo el resumen del comercio:', e);
      return null;
    }
  }

  async updateOrderStatusAsStore(orderId, statusStep, statusText) {
    try {
      const response = await fetch(`${API_URL}/orders/${orderId}/status`, {
        method: 'PUT',
        headers: this.getAuthHeaders('store'),
        body: JSON.stringify({ statusStep, statusText })
      });
      const data = await response.json();
      return data;
    } catch (e) {
      console.error('Error actualizando el pedido:', e);
      return { success: false, message: 'Error de conexión con el servidor.' };
    }
  }

  // --- Panel del repartidor ---
  async getDriverDashboard() {
    try {
      const response = await fetch(`${API_URL}/drivers/me/dashboard`, { headers: this.getAuthHeaders('driver') });
      const data = await response.json();
      return data.success ? data : null;
    } catch (e) {
      console.error('Error obteniendo tu resumen:', e);
      return null;
    }
  }

  async updateDriverStatus(isOnline) {
    try {
      const response = await fetch(`${API_URL}/drivers/me/status`, {
        method: 'PUT', headers: this.getAuthHeaders('driver'), body: JSON.stringify({ isOnline })
      });
      return await response.json();
    } catch (e) {
      return { success: false, message: 'Error de conexión con el servidor.' };
    }
  }

  async updateDriverLocation(lat, lng) {
    try {
      const response = await fetch(`${API_URL}/drivers/me/location`, {
        method: 'PUT', headers: this.getAuthHeaders('driver'), body: JSON.stringify({ lat, lng })
      });
      return await response.json();
    } catch (e) {
      return { success: false, message: 'Error de conexión con el servidor.' };
    }
  }

  async getPendingDeliveries() {
    try {
      const response = await fetch(`${API_URL}/orders/pending`, { headers: this.getAuthHeaders('driver') });
      const data = await response.json();
      return data.success ? data.orders : [];
    } catch (e) {
      console.error('Error obteniendo pedidos pendientes:', e);
      return [];
    }
  }

  async getMyActiveDelivery() {
    try {
      const response = await fetch(`${API_URL}/orders/driver/active`, { headers: this.getAuthHeaders('driver') });
      const data = await response.json();
      return data.success ? data.order : null;
    } catch (e) {
      console.error('Error obteniendo tu entrega activa:', e);
      return null;
    }
  }

  async updateOrderStatusAsDriver(orderId, statusStep, statusText) {
    try {
      const response = await fetch(`${API_URL}/orders/${orderId}/status`, {
        method: 'PUT', headers: this.getAuthHeaders('driver'), body: JSON.stringify({ statusStep, statusText })
      });
      return await response.json();
    } catch (e) {
      return { success: false, message: 'Error de conexión con el servidor.' };
    }
  }

  // --- Personal y permisos del comercio ---
  async getStoreAccess() {
    try {
      const response = await fetch(`${API_URL}/store/me/access`, { headers: this.getAuthHeaders('store') });
      const data = await response.json();
      return data.success ? data : { isOwner: false, permissions: {} };
    } catch (e) {
      console.error('Error obteniendo tus permisos:', e);
      return { isOwner: false, permissions: {} };
    }
  }

  async getStoreStaff() {
    try {
      const response = await fetch(`${API_URL}/store/staff`, { headers: this.getAuthHeaders('store') });
      const data = await response.json();
      return data.success ? data.staff : [];
    } catch (e) {
      console.error('Error obteniendo tu equipo:', e);
      return [];
    }
  }

  async createStoreStaff(payload) {
    try {
      const response = await fetch(`${API_URL}/store/staff`, {
        method: 'POST', headers: this.getAuthHeaders('store'), body: JSON.stringify(payload)
      });
      return await response.json();
    } catch (e) {
      return { success: false, message: 'Error de conexión con el servidor.' };
    }
  }

  async updateStaffPermissions(id, permissions) {
    try {
      const response = await fetch(`${API_URL}/store/staff/${id}/permissions`, {
        method: 'PUT', headers: this.getAuthHeaders('store'), body: JSON.stringify({ permissions })
      });
      return await response.json();
    } catch (e) {
      return { success: false, message: 'Error de conexión con el servidor.' };
    }
  }

  async removeStoreStaff(id) {
    try {
      const response = await fetch(`${API_URL}/store/staff/${id}`, {
        method: 'DELETE', headers: this.getAuthHeaders('store')
      });
      return await response.json();
    } catch (e) {
      return { success: false, message: 'Error de conexión con el servidor.' };
    }
  }

  // --- Configuración del negocio ---
  async getStoreProfile() {
    try {
      const response = await fetch(`${API_URL}/store/profile`, { headers: this.getAuthHeaders('store') });
      const data = await response.json();
      return data.success ? data.store : null;
    } catch (e) {
      console.error('Error obteniendo tu perfil de negocio:', e);
      return null;
    }
  }

  async updateStoreProfile(payload) {
    try {
      const response = await fetch(`${API_URL}/store/profile`, {
        method: 'PUT', headers: this.getAuthHeaders('store'), body: JSON.stringify(payload)
      });
      return await response.json();
    } catch (e) {
      return { success: false, message: 'Error de conexión con el servidor.' };
    }
  }

  async updateStoreHours(hours) {
    try {
      const response = await fetch(`${API_URL}/store/hours`, {
        method: 'PUT', headers: this.getAuthHeaders('store'), body: JSON.stringify({ hours })
      });
      return await response.json();
    } catch (e) {
      return { success: false, message: 'Error de conexión con el servidor.' };
    }
  }

  async updateStoreSpecialDays(specialDays) {
    try {
      const response = await fetch(`${API_URL}/store/special-days`, {
        method: 'PUT', headers: this.getAuthHeaders('store'), body: JSON.stringify({ specialDays })
      });
      return await response.json();
    } catch (e) {
      return { success: false, message: 'Error de conexión con el servidor.' };
    }
  }

  async updateStoreOrderSettings(payload) {
    try {
      const response = await fetch(`${API_URL}/store/order-settings`, {
        method: 'PUT', headers: this.getAuthHeaders('store'), body: JSON.stringify(payload)
      });
      return await response.json();
    } catch (e) {
      return { success: false, message: 'Error de conexión con el servidor.' };
    }
  }

  // --- Finanzas y liquidaciones del comercio ---
  async getStoreFinanceSummary() {
    try {
      const response = await fetch(`${API_URL}/store/finance/summary`, { headers: this.getAuthHeaders('store') });
      const data = await response.json();
      return data.success ? data : null;
    } catch (e) {
      console.error('Error obteniendo tus finanzas:', e);
      return null;
    }
  }

  async getStoreSales() {
    try {
      const response = await fetch(`${API_URL}/store/finance/sales`, { headers: this.getAuthHeaders('store') });
      const data = await response.json();
      return data.success ? data.sales : [];
    } catch (e) {
      console.error('Error obteniendo el detalle de ventas:', e);
      return [];
    }
  }

  async getStoreSettlements() {
    try {
      const response = await fetch(`${API_URL}/store/finance/settlements`, { headers: this.getAuthHeaders('store') });
      const data = await response.json();
      return data.success ? data.settlements : [];
    } catch (e) {
      console.error('Error obteniendo tus liquidaciones:', e);
      return [];
    }
  }

  // --- Promociones propias del comercio ---
  async getStorePromotions() {
    try {
      const response = await fetch(`${API_URL}/store/promotions`, { headers: this.getAuthHeaders('store') });
      const data = await response.json();
      return data.success ? data.promotions : [];
    } catch (e) {
      console.error('Error obteniendo tus promociones:', e);
      return [];
    }
  }

  async createStorePromotion(payload) {
    try {
      const response = await fetch(`${API_URL}/store/promotions`, {
        method: 'POST', headers: this.getAuthHeaders('store'), body: JSON.stringify(payload)
      });
      return await response.json();
    } catch (e) {
      return { success: false, message: 'Error de conexión con el servidor.' };
    }
  }

  async updateStorePromotion(id, payload) {
    try {
      const response = await fetch(`${API_URL}/store/promotions/${id}`, {
        method: 'PUT', headers: this.getAuthHeaders('store'), body: JSON.stringify(payload)
      });
      return await response.json();
    } catch (e) {
      return { success: false, message: 'Error de conexión con el servidor.' };
    }
  }

  async toggleStorePromotion(id, isActive) {
    try {
      const response = await fetch(`${API_URL}/store/promotions/${id}/toggle`, {
        method: 'PUT', headers: this.getAuthHeaders('store'), body: JSON.stringify({ isActive })
      });
      return await response.json();
    } catch (e) {
      return { success: false, message: 'Error de conexión con el servidor.' };
    }
  }

  async deleteStorePromotion(id) {
    try {
      const response = await fetch(`${API_URL}/store/promotions/${id}`, {
        method: 'DELETE', headers: this.getAuthHeaders('store')
      });
      return await response.json();
    } catch (e) {
      return { success: false, message: 'Error de conexión con el servidor.' };
    }
  }

  // --- Reputación del comercio ---
  async getStoreReviews() {
    try {
      const response = await fetch(`${API_URL}/store/reviews`, { headers: this.getAuthHeaders('store') });
      const data = await response.json();
      return data.success ? data : { reviews: [], averageRating: null, totalReviews: 0 };
    } catch (e) {
      console.error('Error obteniendo tus reseñas:', e);
      return { reviews: [], averageRating: null, totalReviews: 0 };
    }
  }

  async replyToReview(orderId, text) {
    try {
      const response = await fetch(`${API_URL}/store/reviews/${orderId}/reply`, {
        method: 'PUT', headers: this.getAuthHeaders('store'), body: JSON.stringify({ text })
      });
      return await response.json();
    } catch (e) {
      return { success: false, message: 'Error de conexión con el servidor.' };
    }
  }

  // --- Catálogo del comercio ---
  async getStoreCategories() {
    try {
      const response = await fetch(`${API_URL}/store/categories`, { headers: this.getAuthHeaders('store') });
      const data = await response.json();
      return data.success ? data.categories : [];
    } catch (e) {
      console.error('Error obteniendo categorías:', e);
      return [];
    }
  }

  async createStoreCategory(name) {
    try {
      const response = await fetch(`${API_URL}/store/categories`, {
        method: 'POST', headers: this.getAuthHeaders('store'), body: JSON.stringify({ name })
      });
      return await response.json();
    } catch (e) {
      return { success: false, message: 'Error de conexión con el servidor.' };
    }
  }

  async updateStoreCategory(id, name) {
    try {
      const response = await fetch(`${API_URL}/store/categories/${id}`, {
        method: 'PUT', headers: this.getAuthHeaders('store'), body: JSON.stringify({ name })
      });
      return await response.json();
    } catch (e) {
      return { success: false, message: 'Error de conexión con el servidor.' };
    }
  }

  async deleteStoreCategory(id) {
    try {
      const response = await fetch(`${API_URL}/store/categories/${id}`, {
        method: 'DELETE', headers: this.getAuthHeaders('store')
      });
      return await response.json();
    } catch (e) {
      return { success: false, message: 'Error de conexión con el servidor.' };
    }
  }

  async getStoreProducts() {
    try {
      const response = await fetch(`${API_URL}/store/products`, { headers: this.getAuthHeaders('store') });
      const data = await response.json();
      return data.success ? data.products : [];
    } catch (e) {
      console.error('Error obteniendo el catálogo:', e);
      return [];
    }
  }

  async createStoreProduct(payload) {
    try {
      const response = await fetch(`${API_URL}/store/products`, {
        method: 'POST', headers: this.getAuthHeaders('store'), body: JSON.stringify(payload)
      });
      return await response.json();
    } catch (e) {
      return { success: false, message: 'Error de conexión con el servidor.' };
    }
  }

  async updateStoreProduct(id, payload) {
    try {
      const response = await fetch(`${API_URL}/store/products/${id}`, {
        method: 'PUT', headers: this.getAuthHeaders('store'), body: JSON.stringify(payload)
      });
      return await response.json();
    } catch (e) {
      return { success: false, message: 'Error de conexión con el servidor.' };
    }
  }

  async deleteStoreProduct(id) {
    try {
      const response = await fetch(`${API_URL}/store/products/${id}`, {
        method: 'DELETE', headers: this.getAuthHeaders('store')
      });
      return await response.json();
    } catch (e) {
      return { success: false, message: 'Error de conexión con el servidor.' };
    }
  }

  async setProductAvailability(id, status) {
    try {
      const response = await fetch(`${API_URL}/store/products/${id}/availability`, {
        method: 'PUT', headers: this.getAuthHeaders('store'), body: JSON.stringify({ status })
      });
      return await response.json();
    } catch (e) {
      return { success: false, message: 'Error de conexión con el servidor.' };
    }
  }

  async rejectOrder(orderId, reason) {
    try {
      const response = await fetch(`${API_URL}/orders/${orderId}/reject`, {
        method: 'PUT',
        headers: this.getAuthHeaders('store'),
        body: JSON.stringify({ reason })
      });
      const data = await response.json();
      return data;
    } catch (e) {
      console.error('Error rechazando el pedido:', e);
      return { success: false, message: 'Error de conexión con el servidor.' };
    }
  }

  async updateStoreStatus(payload) {
    try {
      const response = await fetch(`${API_URL}/stores/me/status`, {
        method: 'PUT',
        headers: this.getAuthHeaders('store'),
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      return data;
    } catch (e) {
      console.error('Error actualizando el estado del comercio:', e);
      return { success: false, message: 'Error de conexión con el servidor.' };
    }
  }

  getAuthHeaders(role = 'user') {
    const headers = { 'Content-Type': 'application/json' };
    const user = this.getCurrentUser(role);
    if (user && user.token) {
      headers['Authorization'] = `Bearer ${user.token}`;
    }
    return headers;
  }

  logout(role = 'user') {
    const sessionKey = this._getSessionKeyByRole(role);
    localStorage.removeItem(sessionKey);
  }

  // ==========================================
  // CATÁLOGO DINÁMICO (SQLite via API)
  // ==========================================
  
  async getStores(lat = null, lng = null, { category = null, sortBy = null } = {}) {
    try {
      let url = `${window.RAPIDIN_API_BASE}/api/stores`;
      const params = new URLSearchParams();
      if (lat !== null && lng !== null) {
        params.set('lat', lat);
        params.set('lng', lng);
      }
      if (category) params.set('category', category);
      if (sortBy) params.set('sortBy', sortBy);
      const qs = params.toString();
      if (qs) url += `?${qs}`;
      const response = await fetch(url);
      const data = await response.json();
      return data.success ? data.stores : [];
    } catch (e) {
      console.error('Error fetching stores:', e);
      return [];
    }
  }

  async getPublicStoreReviews(storeId) {
    try {
      const response = await fetch(`${API_URL}/stores/${storeId}/reviews`, {
        headers: this.getAuthHeaders('user')
      });
      const data = await response.json();
      return data.success ? data.reviews : [];
    } catch (e) {
      console.error('Error fetching store reviews:', e);
      return [];
    }
  }

  async search(query) {
    try {
      const response = await fetch(`${API_URL}/search?q=${encodeURIComponent(query)}`);
      const data = await response.json();
      return data.success ? { stores: data.stores, products: data.products } : { stores: [], products: [] };
    } catch (e) {
      console.error('Error en búsqueda:', e);
      return { stores: [], products: [] };
    }
  }

  async getShipmentQuote({ originLat, originLng, destLat, destLng, packageSize }) {
    try {
      const response = await fetch(`${API_URL}/shipments/quote`, {
        method: 'POST',
        headers: this.getAuthHeaders('user'),
        body: JSON.stringify({ originLat, originLng, destLat, destLng, packageSize })
      });
      const data = await response.json();
      return data.success ? data : null;
    } catch (e) {
      console.error('Error obteniendo cotización de envío:', e);
      return null;
    }
  }

  async createShipment(payload) {
    try {
      const response = await fetch(`${API_URL}/shipments`, {
        method: 'POST',
        headers: this.getAuthHeaders('user'),
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      return data.success ? { success: true, shipment: data.shipment } : { success: false, message: data.message };
    } catch (e) {
      console.error('Error creando envío:', e);
      return { success: false, message: 'Error de conexión con el servidor.' };
    }
  }

  async getMyShipments() {
    try {
      const response = await fetch(`${API_URL}/shipments/mine`, { headers: this.getAuthHeaders('user') });
      const data = await response.json();
      return data.success ? data.shipments : [];
    } catch (e) {
      console.error('Error obteniendo tus envíos:', e);
      return [];
    }
  }

  async getShipment(id) {
    try {
      const response = await fetch(`${API_URL}/shipments/${id}`, { headers: this.getAuthHeaders('user') });
      const data = await response.json();
      return data.success ? data.shipment : null;
    } catch (e) {
      console.error('Error obteniendo el envío:', e);
      return null;
    }
  }

  async cancelShipment(id) {
    try {
      const response = await fetch(`${API_URL}/shipments/${id}/cancel`, {
        method: 'PUT',
        headers: this.getAuthHeaders('user')
      });
      const data = await response.json();
      return data;
    } catch (e) {
      console.error('Error cancelando el envío:', e);
      return { success: false, message: 'Error de conexión con el servidor.' };
    }
  }

  async getLoyaltySummary() {
    try {
      const response = await fetch(`${API_URL}/loyalty/summary`, { headers: this.getAuthHeaders('user') });
      const data = await response.json();
      return data.success ? data : null;
    } catch (e) {
      console.error('Error fetching loyalty summary:', e);
      return null;
    }
  }

  async getLoyaltyHistory() {
    try {
      const response = await fetch(`${API_URL}/loyalty/history`, { headers: this.getAuthHeaders('user') });
      const data = await response.json();
      return data.success ? data.history : [];
    } catch (e) {
      console.error('Error fetching loyalty history:', e);
      return [];
    }
  }

  async getRedemptionOptions() {
    try {
      const response = await fetch(`${API_URL}/loyalty/redemption-options`, { headers: this.getAuthHeaders('user') });
      const data = await response.json();
      return data.success ? data.options : [];
    } catch (e) {
      console.error('Error fetching redemption options:', e);
      return [];
    }
  }

  async redeemPoints(optionId) {
    try {
      const response = await fetch(`${API_URL}/loyalty/redeem`, {
        method: 'POST',
        headers: this.getAuthHeaders('user'),
        body: JSON.stringify({ optionId })
      });
      const data = await response.json();
      return data;
    } catch (e) {
      console.error('Error redeeming points:', e);
      return { success: false, message: 'Error de conexión con el servidor.' };
    }
  }

  async getReferrals() {
    try {
      const response = await fetch(`${API_URL}/loyalty/referrals`, { headers: this.getAuthHeaders('user') });
      const data = await response.json();
      return data.success ? data : { referralCode: null, referrals: [] };
    } catch (e) {
      console.error('Error fetching referrals:', e);
      return { referralCode: null, referrals: [] };
    }
  }

  async getActiveCoupons(type = null, storeId = null) {
    try {
      const params = new URLSearchParams();
      if (type) params.set('type', type);
      if (storeId) params.set('storeId', storeId);
      const qs = params.toString();
      const url = `${API_URL}/coupons/active${qs ? '?' + qs : ''}`;
      const response = await fetch(url, { headers: this.getAuthHeaders('user') });
      const data = await response.json();
      return data.success ? data.coupons : [];
    } catch (e) {
      console.error('Error fetching active coupons:', e);
      return [];
    }
  }

  async getStoresWithPromos(lat = null, lng = null) {
    try {
      let url = `${API_URL}/stores/with-promos`;
      if (lat !== null && lng !== null) url += `?lat=${lat}&lng=${lng}`;
      const response = await fetch(url, { headers: this.getAuthHeaders('user') });
      const data = await response.json();
      return data.success ? data.stores : [];
    } catch (e) {
      console.error('Error fetching nearby promos:', e);
      return [];
    }
  }

  async getProducts(storeId) {
    try {
      const response = await fetch(`${API_URL}/products/${storeId}`, {
        headers: this.getAuthHeaders('user') // Cambiar dinámicamente si es store, pero el token no estorba
      });
      const data = await response.json();
      return data.success ? data.products : [];
    } catch (e) {
      console.error('Error fetching products:', e);
      return [];
    }
  }

  async getConfig() {
    try {
      const response = await fetch(`${API_URL}/config`);
      const data = await response.json();
      return data.success ? data : null;
    } catch (e) {
      console.error('Error fetching config:', e);
      return null;
    }
  }

  async getOrder(id) {
    try {
      const response = await fetch(`${API_URL}/orders/${id}`, {
        headers: this.getAuthHeaders('user')
      });
      const data = await response.json();
      return data.success ? data.order : null;
    } catch (e) {
      console.error('Error fetching order:', e);
      return null;
    }
  }

  async createOrder(orderData) {
    try {
      const response = await fetch(`${API_URL}/orders`, {
        method: 'POST',
        headers: this.getAuthHeaders('user'),
        body: JSON.stringify(orderData)
      });
      const data = await response.json();
      if (data.success) return { success: true, order: data.order };
      return { success: false, code: data.code || null, message: data.message || 'No se pudo confirmar el pedido.', unavailableItems: data.unavailableItems || [] };
    } catch (e) {
      console.error('Error creando pedido:', e);
      return { success: false, code: 'NETWORK_ERROR', message: 'Error de conexión con el servidor.' };
    }
  }

  async preparePayphonePayment(amount, reference, responseUrl, cancellationUrl) {
    try {
      const response = await fetch(`${API_URL}/payments/payphone/prepare`, {
        method: 'POST',
        headers: this.getAuthHeaders('user'),
        body: JSON.stringify({ amount, reference, responseUrl, cancellationUrl })
      });
      const data = await response.json();
      return data;
    } catch (e) {
      console.error('Error preparando pago Payphone:', e);
      return { success: false, message: 'Error de conexión con el servidor.' };
    }
  }

  async savePayphoneCredentials(token, storeId) {
    try {
      const res = await fetch(`${API_URL}/admin/payphone-credentials`, {
        method: 'PUT',
        headers: this.getAuthHeaders('admin'),
        body: JSON.stringify({ token, storeId })
      });
      return await res.json();
    } catch (e) {
      return { success: false, message: 'Error de conexión con el servidor.' };
    }
  }

  async deletePayphoneCredentials() {
    try {
      const res = await fetch(`${API_URL}/admin/payphone-credentials`, {
        method: 'DELETE',
        headers: this.getAuthHeaders('admin')
      });
      return await res.json();
    } catch (e) {
      return { success: false, message: 'Error de conexión con el servidor.' };
    }
  }

  async getMyOrders() {
    try {
      const response = await fetch(`${API_URL}/orders/mine`, {
        headers: this.getAuthHeaders('user')
      });
      const data = await response.json();
      return data.success ? data.orders : [];
    } catch (e) {
      console.error('Error obteniendo mis pedidos:', e);
      return [];
    }
  }

  // ==========================================
  // CUENTA: PERFIL, DIRECCIONES, PAGOS, CUPONES, NOTIFICACIONES
  // ==========================================

  async updateProfile(profileData) {
    try {
      const res = await fetch(`${API_URL}/auth/profile`, {
        method: 'PUT',
        headers: this.getAuthHeaders('user'),
        body: JSON.stringify(profileData)
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem(RAPIDIN_KEY_AUTH_USER, JSON.stringify({ token: data.token, ...data.user }));
      }
      return data;
    } catch (e) {
      return { success: false, message: 'Error de conexión con el servidor.' };
    }
  }

  async changePhone(phone) {
    try {
      const res = await fetch(`${API_URL}/auth/change-phone`, {
        method: 'PUT',
        headers: this.getAuthHeaders('user'),
        body: JSON.stringify({ phone })
      });
      const data = await res.json();
      if (data.success) {
        const user = this.getCurrentUser('user');
        if (user) { user.phone = phone; localStorage.setItem(RAPIDIN_KEY_AUTH_USER, JSON.stringify(user)); }
      }
      return data;
    } catch (e) {
      return { success: false, message: 'Error de conexión con el servidor.' };
    }
  }

  async deleteAccount() {
    try {
      const res = await fetch(`${API_URL}/auth/account`, { method: 'DELETE', headers: this.getAuthHeaders('user') });
      const data = await res.json();
      if (data.success) this.logout('user');
      return data;
    } catch (e) {
      return { success: false, message: 'Error de conexión con el servidor.' };
    }
  }

  async getAddresses() {
    try {
      const res = await fetch(`${API_URL}/addresses`, { headers: this.getAuthHeaders('user') });
      const data = await res.json();
      return data.success ? data.addresses : [];
    } catch (e) { return []; }
  }

  async createAddress(addressData) {
    try {
      const res = await fetch(`${API_URL}/addresses`, { method: 'POST', headers: this.getAuthHeaders('user'), body: JSON.stringify(addressData) });
      return await res.json();
    } catch (e) { return { success: false, message: 'Error de conexión con el servidor.' }; }
  }

  async updateAddress(id, addressData) {
    try {
      const res = await fetch(`${API_URL}/addresses/${id}`, { method: 'PUT', headers: this.getAuthHeaders('user'), body: JSON.stringify(addressData) });
      return await res.json();
    } catch (e) { return { success: false, message: 'Error de conexión con el servidor.' }; }
  }

  async deleteAddress(id) {
    try {
      const res = await fetch(`${API_URL}/addresses/${id}`, { method: 'DELETE', headers: this.getAuthHeaders('user') });
      return await res.json();
    } catch (e) { return { success: false, message: 'Error de conexión con el servidor.' }; }
  }

  async setDefaultAddress(id) {
    try {
      const res = await fetch(`${API_URL}/addresses/${id}/default`, { method: 'PUT', headers: this.getAuthHeaders('user') });
      return await res.json();
    } catch (e) { return { success: false, message: 'Error de conexión con el servidor.' }; }
  }

  async getPaymentMethods() {
    try {
      const res = await fetch(`${API_URL}/payment-methods`, { headers: this.getAuthHeaders('user') });
      const data = await res.json();
      return data.success ? data.paymentMethods : [];
    } catch (e) { return []; }
  }

  async createPaymentMethodSetupIntent() {
    try {
      const res = await fetch(`${API_URL}/payment-methods/setup-intent`, { method: 'POST', headers: this.getAuthHeaders('user') });
      return await res.json();
    } catch (e) { return { success: false, message: 'Error de conexión con el servidor.' }; }
  }

  async savePaymentMethod(stripePaymentMethodId, isDefault) {
    try {
      const res = await fetch(`${API_URL}/payment-methods`, { method: 'POST', headers: this.getAuthHeaders('user'), body: JSON.stringify({ stripePaymentMethodId, isDefault }) });
      return await res.json();
    } catch (e) { return { success: false, message: 'Error de conexión con el servidor.' }; }
  }

  async deletePaymentMethod(id) {
    try {
      const res = await fetch(`${API_URL}/payment-methods/${id}`, { method: 'DELETE', headers: this.getAuthHeaders('user') });
      return await res.json();
    } catch (e) { return { success: false, message: 'Error de conexión con el servidor.' }; }
  }

  async setDefaultPaymentMethod(id) {
    try {
      const res = await fetch(`${API_URL}/payment-methods/${id}/default`, { method: 'PUT', headers: this.getAuthHeaders('user') });
      return await res.json();
    } catch (e) { return { success: false, message: 'Error de conexión con el servidor.' }; }
  }

  async getCoupons() {
    try {
      const res = await fetch(`${API_URL}/coupons`, { headers: this.getAuthHeaders('user') });
      const data = await res.json();
      return data.success ? data : { available: [], used: [] };
    } catch (e) { return { available: [], used: [] }; }
  }

  async redeemCoupon(code) {
    try {
      const res = await fetch(`${API_URL}/coupons/redeem`, { method: 'POST', headers: this.getAuthHeaders('user'), body: JSON.stringify({ code }) });
      return await res.json();
    } catch (e) { return { success: false, message: 'Error de conexión con el servidor.' }; }
  }

  async getNotificationPreferences() {
    try {
      const res = await fetch(`${API_URL}/notifications/preferences`, { headers: this.getAuthHeaders('user') });
      const data = await res.json();
      return data.success ? data.preferences : null;
    } catch (e) { return null; }
  }

  async updateNotificationPreferences(prefs) {
    try {
      const res = await fetch(`${API_URL}/notifications/preferences`, { method: 'PUT', headers: this.getAuthHeaders('user'), body: JSON.stringify(prefs) });
      return await res.json();
    } catch (e) { return { success: false, message: 'Error de conexión con el servidor.' }; }
  }

  // ==========================================
  // DELIVERY EN VIVO (chat, cancelar, instrucciones, calificar, propina)
  // ==========================================

  async getOrderMessages(orderId) {
    try {
      const res = await fetch(`${API_URL}/orders/${orderId}/messages`, { headers: this.getAuthHeaders('user') });
      const data = await res.json();
      return data.success ? data.messages : [];
    } catch (e) { return []; }
  }

  async sendOrderMessage(orderId, text, imageUrl) {
    try {
      const res = await fetch(`${API_URL}/orders/${orderId}/messages`, { method: 'POST', headers: this.getAuthHeaders('user'), body: JSON.stringify({ text, imageUrl }) });
      return await res.json();
    } catch (e) { return { success: false, message: 'Error de conexión con el servidor.' }; }
  }

  async cancelOrder(orderId, reason) {
    try {
      const res = await fetch(`${API_URL}/orders/${orderId}/cancel`, { method: 'PUT', headers: this.getAuthHeaders('user'), body: JSON.stringify({ reason }) });
      return await res.json();
    } catch (e) { return { success: false, message: 'Error de conexión con el servidor.' }; }
  }

  async saveOrderInstructions(orderId, instructions, lat, lng) {
    try {
      const res = await fetch(`${API_URL}/orders/${orderId}/instructions`, { method: 'PUT', headers: this.getAuthHeaders('user'), body: JSON.stringify({ instructions, lat, lng }) });
      return await res.json();
    } catch (e) { return { success: false, message: 'Error de conexión con el servidor.' }; }
  }

  async rateOrder(orderId, ratingData) {
    try {
      const res = await fetch(`${API_URL}/orders/${orderId}/rate`, { method: 'PUT', headers: this.getAuthHeaders('user'), body: JSON.stringify(ratingData) });
      return await res.json();
    } catch (e) { return { success: false, message: 'Error de conexión con el servidor.' }; }
  }

  async setOrderTip(orderId, tip) {
    try {
      const res = await fetch(`${API_URL}/orders/${orderId}/tip`, { method: 'PUT', headers: this.getAuthHeaders('user'), body: JSON.stringify({ tip }) });
      return await res.json();
    } catch (e) { return { success: false, message: 'Error de conexión con el servidor.' }; }
  }

  // ==========================================
  // AYUDA Y SOPORTE
  // ==========================================

  async getFaqs() {
    try {
      const res = await fetch(`${API_URL}/help/faqs`);
      const data = await res.json();
      return data.success ? data.faqs : [];
    } catch (e) { return []; }
  }

  async createSupportTicket(ticketData) {
    try {
      const res = await fetch(`${API_URL}/support/tickets`, { method: 'POST', headers: this.getAuthHeaders('user'), body: JSON.stringify(ticketData) });
      return await res.json();
    } catch (e) { return { success: false, message: 'Error de conexión con el servidor.' }; }
  }

  async getSupportTickets() {
    try {
      const res = await fetch(`${API_URL}/support/tickets`, { headers: this.getAuthHeaders('user') });
      const data = await res.json();
      return data.success ? data.tickets : [];
    } catch (e) { return []; }
  }

  async getSupportMessages(ticketId) {
    try {
      const res = await fetch(`${API_URL}/support/tickets/${ticketId}/messages`, { headers: this.getAuthHeaders('user') });
      return await res.json();
    } catch (e) { return { success: false, ticket: null, messages: [] }; }
  }

  async sendSupportMessage(ticketId, text, imageUrl) {
    try {
      const res = await fetch(`${API_URL}/support/tickets/${ticketId}/messages`, { method: 'POST', headers: this.getAuthHeaders('user'), body: JSON.stringify({ text, imageUrl }) });
      return await res.json();
    } catch (e) { return { success: false, message: 'Error de conexión con el servidor.' }; }
  }

  async closeSupportTicket(ticketId) {
    try {
      const res = await fetch(`${API_URL}/support/tickets/${ticketId}/close`, { method: 'PUT', headers: this.getAuthHeaders('user') });
      return await res.json();
    } catch (e) { return { success: false, message: 'Error de conexión con el servidor.' }; }
  }

  // ==========================================
  // ADMIN API (Fase 4)
  // ==========================================

  async getAdminSettings() {
    try {
      const res = await fetch(`${API_URL}/admin/settings`, { headers: this.getAuthHeaders('admin') });
      const data = await res.json();
      return data.success ? data : null;
    } catch (e) {
      return null;
    }
  }

  async updateAdminSettings(commissionRate) {
    try {
      const res = await fetch(`${API_URL}/admin/settings`, {
        method: 'PUT',
        headers: this.getAuthHeaders('admin'),
        body: JSON.stringify({ commissionRate })
      });
      return await res.json();
    } catch (e) {
      return { success: false, message: 'Error de conexión con el servidor.' };
    }
  }

  async updateActivePaymentProvider(activePaymentProvider) {
    try {
      const res = await fetch(`${API_URL}/admin/settings`, {
        method: 'PUT',
        headers: this.getAuthHeaders('admin'),
        body: JSON.stringify({ activePaymentProvider })
      });
      return await res.json();
    } catch (e) {
      return { success: false, message: 'Error de conexión con el servidor.' };
    }
  }

  async getAdminOverview() {
    try {
      const res = await fetch(`${API_URL}/admin/overview`, { headers: this.getAuthHeaders('admin') });
      const data = await res.json();
      return data.success ? data.payload : null;
    } catch (e) {
      return null;
    }
  }

  async getAdminOrders() {
    try {
      const res = await fetch(`${API_URL}/admin/orders`, { headers: this.getAuthHeaders('admin') });
      const data = await res.json();
      return data.success ? data.payload : [];
    } catch (e) {
      return [];
    }
  }

  async getAdminUsers(role) {
    try {
      const res = await fetch(`${API_URL}/admin/users/${role}`, { headers: this.getAuthHeaders('admin') });
      const data = await res.json();
      return data.success ? data.payload : [];
    } catch (e) {
      return [];
    }
  }

  async toggleUserStatus(userId) {
    try {
      const res = await fetch(`${API_URL}/admin/users/${userId}/toggle`, {
        method: 'PUT',
        headers: this.getAuthHeaders('admin')
      });
      const data = await res.json();
      return data.success ? data.active : null;
    } catch (e) {
      return null;
    }
  }

  _getSessionKeyByRole(role) {
    if (role === 'store') return RAPIDIN_KEY_AUTH_STORE;
    if (role === 'driver') return RAPIDIN_KEY_AUTH_DRIVER;
    if (role === 'admin') return RAPIDIN_KEY_AUTH_ADMIN;
    return RAPIDIN_KEY_AUTH_USER;
  }
}

window.rapidinDB = new RapidinDatabase();
