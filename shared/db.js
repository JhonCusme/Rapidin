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
  
  async getStores(lat = null, lng = null) {
    try {
      let url = `${window.RAPIDIN_API_BASE}/api/stores`;
      if (lat !== null && lng !== null) {
        url += `?lat=${lat}&lng=${lng}`;
      }
      const response = await fetch(url);
      const data = await response.json();
      return data.success ? data.stores : [];
    } catch (e) {
      console.error('Error fetching stores:', e);
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
