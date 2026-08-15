/* ==========================================================================
   RAPIDIN - VIP PRIME MEMBERSHIP ENGINE 👑
   ========================================================================== */

class RapidinVipEngine {
  constructor() {
    this.storageKey = 'rapidin_vip_status';
  }

  isVip() {
    return localStorage.getItem(this.storageKey) === 'true';
  }

  subscribeVip() {
    localStorage.setItem(this.storageKey, 'true');
    if (window.rapidinSync) {
      window.rapidinSync.emit('VIP_SUBSCRIBED', { isVip: true });
    }
    return true;
  }

  cancelVip() {
    localStorage.setItem(this.storageKey, 'false');
    return false;
  }
}

window.rapidinVip = new RapidinVipEngine();
