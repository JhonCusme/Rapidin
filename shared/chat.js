/* ==========================================================================
   RAPIDIN - REALTIME COURIER & CUSTOMER CHAT SYSTEM 💬
   ========================================================================== */

class RapidinChatEngine {
  constructor() {
    this.storageKey = 'rapidin_chat_messages';
  }

  getMessages(orderId) {
    try {
      const data = localStorage.getItem(`${this.storageKey}_${orderId}`);
      return data ? JSON.parse(data) : this._getDefaultWelcomeMessages();
    } catch (e) {
      return this._getDefaultWelcomeMessages();
    }
  }

  sendMessage(orderId, senderRole, senderName, text) {
    const messages = this.getMessages(orderId);
    const msgObj = {
      id: 'msg-' + Date.now(),
      senderRole, // 'user' o 'driver'
      senderName,
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    messages.push(msgObj);
    localStorage.setItem(`${this.storageKey}_${orderId}`, JSON.stringify(messages));

    if (window.rapidinSync) {
      window.rapidinSync.emit('CHAT_MESSAGE_SENT', { orderId, message: msgObj });
    }

    return msgObj;
  }

  _getDefaultWelcomeMessages() {
    return [
      {
        id: 'msg-init-1',
        senderRole: 'driver',
        senderName: 'Carlos Ruiz (Repartidor)',
        text: '¡Hola! Ya recogí tu pedido en la tienda y voy camino a tu ubicación 🛵',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ];
  }
}

window.rapidinChat = new RapidinChatEngine();
