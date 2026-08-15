/* ==========================================================================
   RAPIDIN - PERSISTENT DATABASE & AUTHENTICATION SERVICE 🗄️🔐 (REAL API JWT)
   ========================================================================== */

const RAPIDIN_KEY_AUTH_USER = 'rapidin_auth_user';
const RAPIDIN_KEY_AUTH_STORE = 'rapidin_auth_store';
const RAPIDIN_KEY_AUTH_DRIVER = 'rapidin_auth_driver';
const RAPIDIN_KEY_AUTH_ADMIN = 'rapidin_auth_admin';
const API_URL = 'http://localhost:3000/api';

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
      } else {
        // En caso de que no exista en DB (ej. modo Demo), forzamos registro automático
        // solo para que el modo "Demo 1 clic" funcione fácil mientras desarrollas.
        return await this.registerUser({
          email, password, role, name: email.split('@')[0]
        });
      }
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

  logout(role = 'user') {
    const sessionKey = this._getSessionKeyByRole(role);
    localStorage.removeItem(sessionKey);
  }

  // ==========================================
  // CATÁLOGO DINÁMICO (SQLite via API)
  // ==========================================
  
  async getStores(lat = null, lng = null) {
    try {
      let url = 'http://localhost:3000/api/stores';
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
      const response = await fetch(`http://localhost:3000/api/products/${storeId}`);
      const data = await response.json();
      return data.success ? data.products : [];
    } catch (e) {
      console.error('Error fetching products:', e);
      return [];
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
