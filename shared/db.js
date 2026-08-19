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

  // Login/registro por teléfono (flujo de verificación SMS). El código SMS ya fue
  // verificado en el cliente; el backend crea la cuenta si el teléfono es nuevo,
  // o inicia sesión si ya existe.
  async phoneLogin({ phone, name, email }) {
    try {
      const response = await fetch(`${API_URL}/auth/phone-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, name, email })
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

  async getStoreReviews(storeId) {
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

  async getActiveCoupons() {
    try {
      const response = await fetch(`${API_URL}/coupons/active`, {
        headers: this.getAuthHeaders('user')
      });
      const data = await response.json();
      return data.success ? data.coupons : [];
    } catch (e) {
      console.error('Error fetching active coupons:', e);
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
