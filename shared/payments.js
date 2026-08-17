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
    return new Promise((resolve, reject) => {
      if (this.selectedMethod === 'card') {
        const token = localStorage.getItem('RAPIDIN_PAYPHONE_TOKEN');
        const appId = localStorage.getItem('RAPIDIN_PAYPHONE_APPID');
        if (!token || !appId) {
          window.rapidinAlert('Payphone no está configurado completamente. Falta Token o App ID en el Admin.');
          return reject('Payphone no configurado');
        }

        console.log('Iniciando Payphone Checkout Real...');
        
        // Creamos un modal para hospedar el botón real de Payphone
        const popup = document.createElement('div');
        popup.style.position = 'fixed';
        popup.style.top = '0'; popup.style.left = '0'; popup.style.width = '100%'; popup.style.height = '100%';
        popup.style.backgroundColor = 'rgba(0,0,0,0.8)';
        popup.style.zIndex = '99999';
        popup.style.display = 'flex'; popup.style.alignItems = 'center'; popup.style.justifyContent = 'center';
        
        popup.innerHTML = `
          <div style="background: #fff; color: #333; padding: 2rem; border-radius: 12px; text-align: center; width: 340px; font-family: sans-serif; box-shadow: 0 4px 20px rgba(0,0,0,0.2);">
            <img src="https://www.payphone.app/wp-content/uploads/2020/09/Recurso-7.png" style="width: 150px; margin-bottom: 1rem;">
            <h3 style="margin-bottom: 0.5rem; color: #f36c21;">Completar Pago Seguro</h3>
            <p style="margin-bottom: 1.5rem; font-size: 0.9rem;">Monto a pagar: <strong>$${amount.toFixed(2)}</strong></p>
            <div id="pp-button-container" style="margin-bottom: 1rem; min-height: 50px;">Cargando Payphone...</div>
            <button id="btn-cancel-pp" style="background: #ccc; color: #333; border: none; padding: 10px 20px; border-radius: 6px; width: 100%; cursor: pointer;">Cancelar Orden</button>
          <div style="background: white; width: 100%; max-width: 400px; border-radius: 12px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);">
            <div style="background: #FF6B00; padding: 20px; text-align: center; color: white;">
              <h2 style="margin: 0; font-size: 1.5rem;">Payphone</h2>
              <p style="margin: 5px 0 0; opacity: 0.9;">Entorno de Simulación</p>
            </div>
            <div style="padding: 30px 20px; text-align: center;">
              <div style="font-size: 2.5rem; font-weight: 700; color: #333; margin-bottom: 20px;">
                $${amount.toFixed(2)}
              </div>
              <p style="color: #666; margin-bottom: 25px;">Estás a punto de simular un pago exitoso en la plataforma.</p>
              
              <button id="btn-mock-pay" style="width: 100%; padding: 15px; background: #FF6B00; color: white; border: none; border-radius: 8px; font-size: 1.1rem; font-weight: 600; cursor: pointer; transition: background 0.2s;">
                Simular Pago Exitoso
              </button>
              <button id="btn-mock-cancel" style="width: 100%; padding: 15px; background: transparent; color: #666; border: none; font-size: 1rem; margin-top: 10px; cursor: pointer;">
                Cancelar
              </button>
            </div>
          </div>
        `;

        document.getElementById('btn-mock-pay').addEventListener('click', () => {
          document.getElementById('btn-mock-pay').innerHTML = 'Procesando...';
          document.getElementById('btn-mock-pay').style.opacity = '0.7';
          
          setTimeout(() => {
            document.body.removeChild(popup);
            resolve({
              success: true,
              transactionId: 'PP-MOCK-' + Math.floor(1000 + Math.random() * 9000),
              method: 'card',
              amount: amount,
              timestamp: new Date().toISOString()
            });
          }, 1500);
        });

        document.getElementById('btn-mock-cancel').addEventListener('click', () => {
          document.body.removeChild(popup);
          reject('Pago cancelado por el usuario (Simulación)');
        });
      };

      // Mostramos el mock directamente
      renderMockPayphoneBox();

      } else {
        // Otros métodos de pago (efectivo, yape, etc)
        setTimeout(() => {
          resolve({
            success: true,
            transactionId: 'TXN-' + Math.floor(100000 + Math.random() * 900000),
            method: this.selectedMethod,
            amount: amount,
            timestamp: new Date().toISOString()
          });
        }, 1000);
      }
    });
  }
}

window.rapidinPayments = new RapidinPaymentEngine();
