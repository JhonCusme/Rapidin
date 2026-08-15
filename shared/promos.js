/* ==========================================================================
   RAPIDIN - PROMO CODES & COUPON ENGINE 🎫
   ========================================================================== */

class RapidinPromoEngine {
  constructor() {
    this.storageKey = 'rapidin_custom_coupons';
  }

  getCoupons() {
    try {
      const data = localStorage.getItem(this.storageKey);
      return data ? JSON.parse(data) : this._getDefaultCoupons();
    } catch (e) {
      return this._getDefaultCoupons();
    }
  }

  createCoupon(code, discount, type, label) {
    const coupons = this.getCoupons();
    const newCoupon = { code: code.toUpperCase(), discount, type, label };
    coupons.unshift(newCoupon);
    localStorage.setItem(this.storageKey, JSON.stringify(coupons));
    return newCoupon;
  }

  _getDefaultCoupons() {
    return [
      { code: 'RAPIDINVIP', discount: 5.00, type: 'fixed', label: '$5.00 Descuento VIP' },
      { code: 'TURBO40', discount: 0.40, type: 'percent', label: '40% Descuento Turbo' },
      { code: 'ENVIOGRATIS', discount: 1.99, type: 'shipping', label: 'Envío Gratis' }
    ];
  }
}

window.rapidinPromos = new RapidinPromoEngine();
