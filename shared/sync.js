/* ==========================================================================
   RAPIDIN - REALTIME CROSS-APP SYNC ENGINE + AUDIO NOTIFICATIONS (SOCKET.IO)
   ========================================================================== */

const RAPIDIN_STORAGE_KEY_ORDERS = 'rapidin_shared_orders';
const SYNC_API_URL = 'http://localhost:3000/api';

class RapidinSyncEngine {
  constructor() {
    this.listeners = [];
    this.audioCtx = null;
    this.socket = null;

    // Cargar cliente Socket.IO dinámicamente desde el backend
    const script = document.createElement('script');
    script.src = 'http://localhost:3000/socket.io/socket.io.js';
    script.onload = () => {
      if (window.io) {
        this.socket = window.io('http://localhost:3000');
        
        this.socket.on('ORDER_CREATED', (orderData) => {
          this.playAudioAlert('bell');
          this._notifyListeners({ eventType: 'ORDER_CREATED', payload: orderData });
        });

        this.socket.on('ORDER_STATUS_CHANGED', (data) => {
          if (data.statusStep === 3) this.playAudioAlert('cash');
          else this.playAudioAlert('bell');
          this._notifyListeners({ eventType: 'ORDER_STATUS_CHANGED', payload: data });
        });

        this.socket.on('CHAT_MESSAGE_SENT', (data) => {
          this.playAudioAlert('bell');
          this._notifyListeners({ eventType: 'CHAT_MESSAGE_SENT', payload: data });
        });

        console.log('⚡ Rapidin WebSockets (Socket.IO) Conectado');
      }
    };
    script.onerror = () => console.error('❌ Error al cargar Socket.IO. ¿El servidor está corriendo en el puerto 3000?');
    document.head.appendChild(script);
  }

  // Sintetizador de audio sin necesidad de archivos externos MP3
  playAudioAlert(type = 'bell') {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      if (!this.audioCtx) this.audioCtx = new AudioContext();
      if (this.audioCtx.state === 'suspended') this.audioCtx.resume();

      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      if (type === 'bell') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, this.audioCtx.currentTime); // A5
        osc.frequency.exponentialRampToValueAtTime(440, this.audioCtx.currentTime + 0.5);
        gain.gain.setValueAtTime(0.3, this.audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.5);
        osc.start();
        osc.stop(this.audioCtx.currentTime + 0.5);
      } else if (type === 'cash') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, this.audioCtx.currentTime); // C5
        osc.frequency.setValueAtTime(659.25, this.audioCtx.currentTime + 0.1); // E5
        osc.frequency.setValueAtTime(783.99, this.audioCtx.currentTime + 0.2); // G5
        gain.gain.setValueAtTime(0.25, this.audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.4);
        osc.start();
        osc.stop(this.audioCtx.currentTime + 0.4);
      }
    } catch (e) {
      console.log('Audio alert fallback:', e);
    }
  }

  subscribe(eventType, callback) {
    this.listeners.push({ eventType, callback });
  }

  emit(eventType, payload) {
    if (this.socket) {
      this.socket.emit(eventType, payload);
    }
  }

  _notifyListeners(eventData) {
    this.listeners.forEach(({ eventType, callback }) => {
      if (eventType === '*' || eventType === eventData.eventType) {
        callback(eventData.payload, eventData.eventType);
      }
    });
  }



  async createOrder(orderData) {
    try {
      const response = await fetch(`${SYNC_API_URL}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
      });
      const data = await response.json();
      
      if (data.success) {
        return data.order;
      }
      return null;
    } catch (e) {
      console.error('Error al crear pedido en backend:', e);
      return null;
    }
  }

  async updateOrderStatus(orderId, newStatus, extraData = {}) {
    try {
      const response = await fetch(`${SYNC_API_URL}/orders/${orderId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statusStep: newStatus, statusText: extraData.statusText || '', extraData })
      });
      const data = await response.json();
      
      if (data.success) {
        return data.payload;
      }
      return null;
    } catch (e) {
      console.error('Error al actualizar pedido:', e);
      return null;
    }
  }


}

window.rapidinSync = new RapidinSyncEngine();
