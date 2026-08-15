/* ==========================================================================
   RAPIDIN - INTERNATIONAL PAYMENT ENGINE 💳💵📱
   ========================================================================== */

const RAPIDIN_PAYMENT_METHODS = [
  { id: 'card', name: 'Tarjeta de Crédito / Débito', icon: 'fa-credit-card', badge: 'PROCESO SEGURO', type: 'card' },
  { id: 'wallet', name: 'Rapidin Wallet (Saldo: $50.00)', icon: 'fa-wallet', badge: 'INSTANTÁNEO', type: 'wallet' },
  { id: 'yape_pix', name: 'Pago Móvil (Yape / Plin / Pix / MercadoPago)', icon: 'fa-qrcode', badge: 'SIN COMISIÓN', type: 'qr' },
  { id: 'cash', name: 'Efectivo al Repartidor', icon: 'fa-money-bill-wave', badge: 'PAGO CONTRAENTREGA', type: 'cash' }
];

class RapidinPaymentEngine {
  constructor() {
    this.selectedMethod = 'card';
  }

  getMethods() {
    return RAPIDIN_PAYMENT_METHODS;
  }

  setMethod(methodId) {
    this.selectedMethod = methodId;
  }

  processPayment(amount, details = {}) {
    // Simulación de pasarela de pago internacional (Stripe / MercadoPago / Local QR)
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          success: true,
          transactionId: 'TXN-' + Math.floor(100000 + Math.random() * 900000),
          method: this.selectedMethod,
          amount: amount,
          timestamp: new Date().toISOString()
        });
      }, 1000);
    });
  }
}

window.rapidinPayments = new RapidinPaymentEngine();
