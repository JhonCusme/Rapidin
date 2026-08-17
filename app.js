/* ==========================================================================
   RAPIDIN - CORE APPLICATION LOGIC (Uber Eats + Rappi + PedidosYa)
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  const state = {
    activeCategory: 'all',
    deliveryMode: 'delivery',
    searchQuery: '',
    cart: [],
    selectedStore: null,
    modalProduct: null,
    modalQty: 1,
    modalOptionsState: {},
    selectedTip: 1.50,
    appliedCoupon: null,
    activeOrder: null,
    categories: [],
    flashDeals: [],
    map: null,
    courierMarker: null,
    routePolyline: null,
    courierAnimationInterval: null,
    deferredPwaPrompt: null
  };

  function formatMoney(amount) {
    if (window.rapidinI18n) return window.rapidinI18n.formatPrice(amount);
    return `$${amount.toFixed(2)}`;
  }

  let CURRENT_STORES = [];

  async function init() {
    registerServiceWorker();
    setupPwaPrompt();
    setupEventListeners();
    
    // Fetch global config from DB API
    const config = await window.rapidinDB.getConfig();
    if (config) {
      state.categories = config.categories || [];
      state.flashDeals = config.flashDeals || [];
    }
    
    // Recuperar orden activa previa si existe
    const savedOrderId = localStorage.getItem('rapidin_active_order_id');
    if (savedOrderId) {
      state.activeOrder = await window.rapidinDB.getOrder(savedOrderId);
      if (state.activeOrder && state.activeOrder.status_step >= 3) {
        state.activeOrder = null; // ya completada
        localStorage.removeItem('rapidin_active_order_id');
      }
    }

    renderFlashDeals();
    renderCategories();
    
    // Esperar a detectar ubicación antes de pedir restaurantes
    const loc = await autoDetectLocation();
    
    // Fetch dynamic stores with location filter
    if (loc) {
      CURRENT_STORES = await window.rapidinDB.getStores(loc.lat, loc.lon);
    } else {
      CURRENT_STORES = await window.rapidinDB.getStores(); // Fallback si no hay GPS
    }
    
    renderStores();
    updateCartBadge();
    startFlashDealsTimer();
  }

  function autoDetectLocation() {
    return new Promise((resolve) => {
      const addressDisplay = document.getElementById('user-address-display');
      if (!addressDisplay) return resolve(null);

      if ('geolocation' in navigator) {
        addressDisplay.textContent = '📍 Localizando...';
        navigator.geolocation.getCurrentPosition(async (position) => {
          try {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`);
            const data = await response.json();
            
            if (data && data.address) {
              const street = data.address.road || data.address.pedestrian || '';
              const suburb = data.address.suburb || data.address.neighbourhood || data.address.city || '';
              const num = data.address.house_number || '';
              
              let readableAddress = '';
              if (street) readableAddress += street + (num ? ` ${num}` : '');
              if (suburb) readableAddress += (readableAddress ? ', ' : '') + suburb;
              
              addressDisplay.textContent = readableAddress || 'Ubicación Desconocida';
            } else {
              addressDisplay.textContent = 'Ubicación actual';
            }
            resolve({ lat, lon });
          } catch (e) {
            console.error('Error reverse geocoding:', e);
            addressDisplay.textContent = 'Ubicación detectada (Sin red)';
            resolve({ lat: position.coords.latitude, lon: position.coords.longitude });
          }
        }, (error) => {
          console.warn('Geolocation denied or failed:', error.message);
          addressDisplay.textContent = 'Lima, Perú (Por defecto)';
          // Fallback a una ubicación céntrica de prueba si deniega el GPS
          resolve({ lat: -12.0464, lon: -77.0428 });
        }, { timeout: 8000 });
      } else {
        addressDisplay.textContent = 'Lima, Perú (Por defecto)';
        resolve({ lat: -12.0464, lon: -77.0428 });
      }
    });
  }

  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch((err) => console.log('[PWA] SW error:', err));
      });
    }
  }

  function setupPwaPrompt() {
    const installBtnHeader = document.getElementById('btn-install-app');
    const pwaBanner = document.getElementById('pwa-install-banner');
    const pwaBannerBtn = document.getElementById('btn-pwa-banner-install');

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      state.deferredPwaPrompt = e;
      if (installBtnHeader) installBtnHeader.style.display = 'flex';
      if (pwaBanner) pwaBanner.style.display = 'flex';
    });

    const handleInstall = () => {
      if (state.deferredPwaPrompt) {
        state.deferredPwaPrompt.prompt();
        state.deferredPwaPrompt = null;
      }
    };

    if (installBtnHeader) installBtnHeader.addEventListener('click', handleInstall);
    if (pwaBannerBtn) pwaBannerBtn.addEventListener('click', handleInstall);
  }

  function renderFlashDeals() {
    const container = document.getElementById('deals-carousel-container');
    if (!container) return;

    container.innerHTML = state.flashDeals.map(deal => `
      <div class="deal-card" style="background: ${deal.gradient};">
        <div>
          <span class="deal-tag">${deal.tag}</span>
          <h3 class="deal-title">${deal.title}</h3>
          <p class="deal-subtitle">${deal.subtitle}</p>
        </div>
        <div class="deal-footer">
          <div class="deal-timer" data-timer-id="${deal.id}">
            <i class="fa-solid fa-clock"></i>
            <span class="timer-countdown" id="timer-${deal.id}">00:59:59</span>
          </div>
          <button class="btn-claim-deal" onclick="applyFlashCoupon('${deal.code}')">
            Usar Código <strong>${deal.code}</strong>
          </button>
        </div>
      </div>
    `).join('');
  }

  function startFlashDealsTimer() {
    setInterval(() => {
      state.flashDeals.forEach(deal => {
        if (deal.endsInSeconds > 0) {
          deal.endsInSeconds--;
          const hours = Math.floor(deal.endsInSeconds / 3600);
          const minutes = Math.floor((deal.endsInSeconds % 3600) / 60);
          const seconds = deal.endsInSeconds % 60;
          const el = document.getElementById(`timer-${deal.id}`);
          if (el) {
            el.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
          }
        }
      });
    }, 1000);
  }

  window.applyFlashCoupon = function(code) {
    const couponInput = document.getElementById('coupon-code-input');
    if (couponInput) {
      couponInput.value = code;
      openCartDrawer();
      document.getElementById('btn-apply-coupon')?.click();
    }
  };

  function renderCategories() {
    const container = document.getElementById('categories-container');
    if (!container) return;

    container.innerHTML = state.categories.map(cat => `
      <button class="category-chip ${state.activeCategory === cat.id ? 'active' : ''}" data-cat-id="${cat.id}">
        <i class="fa-solid ${cat.icon}"></i>
        <span>${cat.name}</span>
        ${cat.badge ? `<span class="badge ${cat.id === 'turbo' ? 'badge-turbo' : 'badge-primary'}">${cat.badge}</span>` : ''}
      </button>
    `).join('');

    container.querySelectorAll('.category-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        const catId = btn.getAttribute('data-cat-id');
        if (catId === 'express') {
          switchView('view-express');
        } else {
          state.activeCategory = catId;
          renderCategories();
          renderStores();
          switchView('view-home');
        }
      });
    });
  }

  function renderStores() {
    const container = document.getElementById('stores-container');
    const titleEl = document.getElementById('stores-title');
    const badgeCountEl = document.getElementById('stores-count-badge');
    if (!container) return;

    let filteredStores = CURRENT_STORES;

    if (state.activeCategory !== 'all') {
      filteredStores = filteredStores.filter(s => s.category === state.activeCategory || (state.activeCategory === 'turbo' && s.isTurbo));
    }

    if (state.searchQuery.trim() !== '') {
      const q = state.searchQuery.toLowerCase();
      filteredStores = filteredStores.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.tags.some(t => t.toLowerCase().includes(q))
      );
    }

    if (titleEl) {
      const catObj = state.categories.find(c => c.id === state.activeCategory);
      titleEl.textContent = catObj ? (catObj.id === 'all' ? 'Tiendas y Restaurantes Destacados' : catObj.name) : 'Tiendas';
    }

    if (badgeCountEl) {
      badgeCountEl.textContent = `${filteredStores.length} disponibles`;
    }

    container.innerHTML = filteredStores.map(store => `
      <div class="store-card" onclick="openStoreDetail('${store.id}')">
        <div class="store-cover-wrap">
          <img src="${store.image}" alt="${store.name}" class="store-cover-img" loading="lazy">
          <div class="store-badge-overlay">
            <span class="badge ${store.isTurbo ? 'badge-turbo' : 'badge-primary'}">${store.badge}</span>
          </div>
          <img src="${store.logo}" alt="${store.name} Logo" class="store-logo-img">
        </div>
        <div class="store-info">
          <h3 class="store-title">${store.name}</h3>
          <div class="store-meta">
            <div class="meta-item meta-rating"><i class="fa-solid fa-star"></i> <span>${store.rating} (${store.reviewsCount})</span></div>
            <div class="meta-item"><i class="fa-solid fa-clock"></i> <span>${store.deliveryTime}</span></div>
            <div class="meta-item"><i class="fa-solid fa-motorcycle"></i> <span>${state.deliveryMode === 'pickup' ? 'Retiro Gratis' : formatMoney(store.deliveryFee)}</span></div>
          </div>
          <div class="store-tags">
            ${store.tags.map(tag => `<span class="store-tag">${tag}</span>`).join('')}
          </div>
        </div>
      </div>
    `).join('');
  }

  window.openStoreDetail = async function(storeId) {
    const store = CURRENT_STORES.find(s => s.id === storeId);
    if (!store) return;
    
    // Fetch dynamic products for this store
    store.products = await window.rapidinDB.getProducts(storeId);
    
    state.selectedStore = store;

    const detailView = document.getElementById('view-store-detail');
    if (!detailView) return;

    detailView.innerHTML = `
      <div class="store-detail-header">
        <div class="store-banner">
          <img src="${store.image}" alt="${store.name}" class="store-banner-img">
          <button class="btn-back-nav" onclick="switchView('view-home')">
            <i class="fa-solid fa-arrow-left"></i> Volver
          </button>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem;">
          <div>
            <h1 style="font-size: 1.8rem; margin-bottom: 0.4rem;">${store.name}</h1>
            <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 0.75rem;">
              <i class="fa-solid fa-location-dot" style="color: var(--brand-primary);"></i> ${store.address}
            </p>
            <div class="store-meta">
              <span class="meta-item meta-rating"><i class="fa-solid fa-star"></i> ${store.rating} (${store.reviewsCount} opiniones)</span>
              <span class="meta-item"><i class="fa-solid fa-clock"></i> ${store.deliveryTime}</span>
              <span class="meta-item"><i class="fa-solid fa-bag-shopping"></i> Mínimo ${formatMoney(store.minOrder)}</span>
            </div>
          </div>
          <span class="badge ${store.isTurbo ? 'badge-turbo' : 'badge-gold'}" style="font-size: 0.85rem; padding: 0.5rem 1rem;">${store.badge}</span>
        </div>
      </div>

      <div class="section-header">
        <h2 class="section-title"><i class="fa-solid fa-utensils" style="color: var(--brand-primary);"></i> Menú y Productos</h2>
      </div>

      <div class="products-grid">
        ${store.products.map(p => `
          <div class="product-card" onclick="openProductCustomizer('${store.id}', '${p.id}')">
            <div class="product-details">
              <div>
                <h4 class="product-name">${p.name}</h4>
                <p class="product-desc">${p.description}</p>
              </div>
              <div style="display: flex; align-items: center; gap: 0.75rem;">
                <span class="product-price">${formatMoney(p.price)}</span>
                ${p.calories ? `<span style="font-size: 0.75rem; color: var(--text-muted);">${p.calories}</span>` : ''}
              </div>
            </div>
            <div class="product-img-wrap">
              <img src="${p.image}" alt="${p.name}">
              <button class="btn-add-product"><i class="fa-solid fa-plus"></i></button>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    switchView('view-store-detail');
  };

  window.openProductCustomizer = function(storeId, productId) {
    const store = CURRENT_STORES.find(s => s.id === storeId);
    if (!store) return;
    const product = store.products.find(p => p.id === productId);
    if (!product) return;

    state.selectedStore = store;
    state.modalProduct = product;
    state.modalQty = 1;
    state.modalOptionsState = {};

    if (product.options) {
      product.options.forEach((opt, groupIdx) => {
        if (opt.type === 'radio' && opt.choices.length > 0) {
          state.modalOptionsState[groupIdx] = [opt.choices[0]];
        } else {
          state.modalOptionsState[groupIdx] = [];
        }
      });
    }

    const modal = document.getElementById('modal-customizer');
    const imgWrap = document.getElementById('modal-product-img-wrap');
    const nameEl = document.getElementById('modal-product-name');
    const descEl = document.getElementById('modal-product-desc');
    const optionsContainer = document.getElementById('modal-options-container');

    if (imgWrap) {
      imgWrap.style.backgroundImage = `url(${product.image})`;
      imgWrap.style.backgroundSize = 'cover';
    }
    if (nameEl) nameEl.textContent = product.name;
    if (descEl) descEl.textContent = product.description;

    if (optionsContainer) {
      if (product.options && product.options.length > 0) {
        optionsContainer.innerHTML = product.options.map((optGroup, groupIdx) => `
          <div class="option-group">
            <div class="option-title">
              <span>${optGroup.title}</span>
              <span style="font-size: 0.75rem; color: ${optGroup.required ? 'var(--brand-primary)' : 'var(--text-muted)'}; font-weight: 700;">
                ${optGroup.required ? 'REQUERIDO' : 'OPCIONAL'}
              </span>
            </div>
            ${optGroup.choices.map((choice, choiceIdx) => `
              <div class="option-choice" onclick="toggleOptionChoice(${groupIdx}, ${choiceIdx}, '${optGroup.type}')">
                <label>
                  <input type="${optGroup.type}" name="opt-group-${groupIdx}" id="opt-choice-${groupIdx}-${choiceIdx}" ${isChoiceSelected(groupIdx, choice) ? 'checked' : ''}>
                  <span>${choice.name}</span>
                </label>
                <span style="color: var(--text-muted); font-size: 0.8rem;">
                  ${choice.extra > 0 ? `+${formatMoney(choice.extra)}` : 'Sin costo'}
                </span>
              </div>
            `).join('')}
          </div>
        `).join('');
      } else {
        optionsContainer.innerHTML = '<p style="color: var(--text-muted); font-size: 0.85rem; padding: 1rem 0;">No requiere opciones adicionales.</p>';
      }
    }

    updateModalSubtotal();
    if (modal) modal.classList.add('active');
  };

  function isChoiceSelected(groupIdx, choice) {
    const list = state.modalOptionsState[groupIdx] || [];
    return list.some(c => c.name === choice.name);
  }

  window.toggleOptionChoice = function(groupIdx, choiceIdx, type) {
    const optGroup = state.modalProduct.options[groupIdx];
    const choice = optGroup.choices[choiceIdx];

    if (type === 'radio') {
      state.modalOptionsState[groupIdx] = [choice];
    } else {
      if (!state.modalOptionsState[groupIdx]) state.modalOptionsState[groupIdx] = [];
      const idx = state.modalOptionsState[groupIdx].findIndex(c => c.name === choice.name);
      if (idx >= 0) state.modalOptionsState[groupIdx].splice(idx, 1);
      else state.modalOptionsState[groupIdx].push(choice);
    }

    optGroup.choices.forEach((c, i) => {
      const input = document.getElementById(`opt-choice-${groupIdx}-${i}`);
      if (input) input.checked = isChoiceSelected(groupIdx, c);
    });

    updateModalSubtotal();
  };

  function updateModalSubtotal() {
    let basePrice = state.modalProduct.price;
    let extrasTotal = 0;

    Object.values(state.modalOptionsState).forEach(choiceList => {
      choiceList.forEach(c => { extrasTotal += (c.extra || 0); });
    });

    const total = (basePrice + extrasTotal) * state.modalQty;
    const priceEl = document.getElementById('modal-total-price');
    const qtyEl = document.getElementById('modal-qty-count');

    if (priceEl) priceEl.textContent = formatMoney(total);
    if (qtyEl) qtyEl.textContent = state.modalQty;
  }

  function addToCart() {
    if (!state.modalProduct) return;

    let extrasTotal = 0;
    const formattedOptions = [];

    Object.values(state.modalOptionsState).forEach(choiceList => {
      choiceList.forEach(c => {
        extrasTotal += (c.extra || 0);
        formattedOptions.push(c.name);
      });
    });

    const itemPrice = state.modalProduct.price + extrasTotal;

    const cartItem = {
      cartItemId: 'item-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      storeId: state.selectedStore.id,
      storeName: state.selectedStore.name,
      productId: state.modalProduct.id,
      name: state.modalProduct.name,
      image: state.modalProduct.image,
      unitPrice: itemPrice,
      quantity: state.modalQty,
      optionsText: formattedOptions.join(', ')
    };

    state.cart.push(cartItem);
    closeProductModal();
    updateCartBadge();
    renderCartItems();
    openCartDrawer();
  }

  function updateCartBadge() {
    const badge = document.getElementById('cart-badge-count');
    const totalCount = state.cart.reduce((acc, item) => acc + item.quantity, 0);
    if (badge) badge.textContent = totalCount;
  }

  function renderCartItems() {
    const container = document.getElementById('cart-items-container');
    if (!container) return;

    if (state.cart.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 2.5rem 1rem;">
          <i class="fa-solid fa-basket-shopping" style="font-size: 2.5rem; color: var(--text-muted); margin-bottom: 0.75rem;"></i>
          <h4 style="font-weight: 700;">Tu carrito está vacío</h4>
          <p style="color: var(--text-secondary); font-size: 0.8rem;">Agrega deliciosos platillos para comenzar.</p>
        </div>
      `;
    } else {
      container.innerHTML = state.cart.map(item => `
        <div class="cart-item">
          <img src="${item.image}" alt="${item.name}" style="width: 54px; height: 54px; border-radius: 10px; object-fit: cover;">
          <div class="cart-item-info">
            <div class="cart-item-title">${item.name}</div>
            ${item.optionsText ? `<div class="cart-item-options">${item.optionsText}</div>` : ''}
            <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 0.4rem;">
              <span style="font-weight: 800; color: var(--brand-primary); font-size: 0.9rem;">${formatMoney(item.unitPrice * item.quantity)}</span>
              <div class="quantity-picker" style="padding: 0.15rem 0.5rem;">
                <button class="qty-btn" style="width: 22px; height: 22px;" onclick="changeCartItemQty('${item.cartItemId}', -1)">-</button>
                <span style="font-size: 0.8rem; font-weight: 800;">${item.quantity}</span>
                <button class="qty-btn" style="width: 22px; height: 22px;" onclick="changeCartItemQty('${item.cartItemId}', 1)">+</button>
              </div>
            </div>
          </div>
        </div>
      `).join('');
    }

    calculateCartTotals();
  }

  window.changeCartItemQty = function(cartItemId, delta) {
    const item = state.cart.find(i => i.cartItemId === cartItemId);
    if (!item) return;

    item.quantity += delta;
    if (item.quantity <= 0) {
      state.cart = state.cart.filter(i => i.cartItemId !== cartItemId);
    }
    updateCartBadge();
    renderCartItems();
  };

  function calculateCartTotals() {
    const subtotal = state.cart.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
    let shipping = state.deliveryMode === 'pickup' ? 0 : 1.99;
    let tip = state.selectedTip;
    let discount = 0;

    if (state.appliedCoupon) {
      if (state.appliedCoupon.type === 'fixed') discount = state.appliedCoupon.discount;
      else if (state.appliedCoupon.type === 'percent') discount = subtotal * state.appliedCoupon.discount;
      else if (state.appliedCoupon.type === 'shipping') { shipping = 0; discount = 1.99; }
    }

    const total = Math.max(0, subtotal + shipping + tip - discount);

    document.getElementById('summary-subtotal').textContent = formatMoney(subtotal);
    document.getElementById('summary-shipping').textContent = shipping === 0 ? 'GRATIS' : formatMoney(shipping);
    document.getElementById('summary-tip').textContent = formatMoney(tip);
    document.getElementById('summary-total').textContent = formatMoney(total);
  }

  function initLiveTrackingMap() {
    const order = state.activeOrder;
    const mapContainer = document.getElementById('map-container');
    if (!mapContainer) return;

    if (!state.map) {
      state.map = L.map('map-container', { zoomControl: false }).setView([order.courier.lat, order.courier.lng], 14);

      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; CARTO',
        maxZoom: 19
      }).addTo(state.map);

      const storeIcon = L.divIcon({
        className: 'custom-map-pin',
        html: `<div style="background: #FF3366; color: #fff; padding: 6px 10px; border-radius: 20px; font-weight: 800; font-size: 0.8rem;"><i class="fa-solid fa-store"></i> Tienda</div>`,
        iconSize: [80, 30]
      });

      const userIcon = L.divIcon({
        className: 'custom-map-pin',
        html: `<div style="background: #00DFD8; color: #000; padding: 6px 10px; border-radius: 20px; font-weight: 800; font-size: 0.8rem;"><i class="fa-solid fa-house"></i> Tu Casa</div>`,
        iconSize: [80, 30]
      });

      const courierIcon = L.divIcon({
        className: 'custom-courier-pin',
        html: `<div style="background: #FF6600; color: #fff; width: 42px; height: 42px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; border: 3px solid #fff;"><i class="fa-solid fa-motorcycle"></i></div>`,
        iconSize: [42, 42]
      });

      L.marker([order.storeLocation.lat, order.storeLocation.lng], { icon: storeIcon }).addTo(state.map);
      L.marker([order.userLocation.lat, order.userLocation.lng], { icon: userIcon }).addTo(state.map);
      state.courierMarker = L.marker([order.courier.lat, order.courier.lng], { icon: courierIcon }).addTo(state.map);
    }

    renderTrackingTimeline();
    renderCourierCard();
  }

  function renderTrackingTimeline() {
    const timelineContainer = document.getElementById('tracking-timeline-container');
    if (!timelineContainer) return;

    timelineContainer.innerHTML = state.activeOrder.timeline.map(step => `
      <div class="timeline-item ${step.completed ? 'completed' : ''} ${step.active ? 'active' : ''}">
        <div class="timeline-node"></div>
        <div style="font-weight: 700; font-size: 0.875rem;">${step.title}</div>
        <div style="font-size: 0.75rem; color: var(--text-muted);">${step.time}</div>
      </div>
    `).join('');
  }

  function renderCourierCard() {
    const card = document.getElementById('courier-info-card');
    const courier = state.activeOrder.courier;
    if (!card) return;

    card.innerHTML = `
      <img src="${courier.avatar}" alt="${courier.name}" class="courier-avatar">
      <div class="courier-info">
        <div class="courier-name">${courier.name}</div>
        <div class="courier-vehicle">${courier.vehicle} • ★ ${courier.rating}</div>
      </div>
    `;
  }

  window.switchView = function(viewId) {
    ['view-home', 'view-store-detail', 'view-tracking', 'view-express'].forEach(v => {
      const el = document.getElementById(v);
      if (el) el.style.display = (v === viewId) ? 'block' : 'none';
    });

    if (viewId === 'view-tracking') initLiveTrackingMap();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  function openCartDrawer() {
    const drawer = document.getElementById('cart-drawer');
    if (drawer) drawer.classList.add('active');
  }

  function closeCartDrawer() {
    const drawer = document.getElementById('cart-drawer');
    if (drawer) drawer.classList.remove('active');
  }

  function closeProductModal() {
    const modal = document.getElementById('modal-customizer');
    if (modal) modal.classList.remove('active');
  }

  function setupEventListeners() {
    document.getElementById('btn-go-home')?.addEventListener('click', () => switchView('view-home'));
    document.getElementById('global-search')?.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      renderStores();
    });

    document.getElementById('btn-close-product-modal')?.addEventListener('click', closeProductModal);
    document.getElementById('modal-qty-minus')?.addEventListener('click', () => {
      if (state.modalQty > 1) { state.modalQty--; updateModalSubtotal(); }
    });
    document.getElementById('modal-qty-plus')?.addEventListener('click', () => {
      state.modalQty++;
      updateModalSubtotal();
    });
    document.getElementById('btn-confirm-add-cart')?.addEventListener('click', addToCart);

    document.getElementById('btn-open-cart')?.addEventListener('click', openCartDrawer);
    document.getElementById('btn-close-cart')?.addEventListener('click', closeCartDrawer);

    document.querySelectorAll('.tip-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('.tip-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        state.selectedTip = parseFloat(pill.getAttribute('data-tip'));
        calculateCartTotals();
      });
    });

    document.getElementById('btn-process-checkout')?.addEventListener('click', async () => {
      if (state.cart.length === 0) {
        window.rapidinAlert('Tu carrito está vacío. Agrega productos para realizar un pedido.');
        return;
      }

      const btn = document.getElementById('btn-process-checkout');
      const originalText = btn?.textContent || 'Confirmar Pedido';
      if (btn) {
        btn.textContent = '⏳ Procesando...';
        btn.disabled = true;
      }

      try {
        const subtotal = state.cart.reduce((s, i) => s + (i.unitPrice * i.quantity), 0);
        const orderTotal = subtotal + 1.99 + state.selectedTip;

        // PAGO: Interceptamos con el motor de pagos (Payphone / Tarjeta)
        if (window.rapidinPayments) {
          try {
            await window.rapidinPayments.processPayment(orderTotal);
          } catch (payError) {
            console.warn('Pago no completado:', payError);
            return; // Detenemos el flujo si el pago falla o se cancela
          }
        }

        const orderId = 'RPD-' + Math.floor(10000 + Math.random() * 90000);
        const orderData = {
          id: orderId,
          statusStep: 0,
          statusText: 'Pedido confirmado y enviado al comercio 🚀',
          storeId: state.selectedStore ? state.selectedStore.id : 'store-1',
          storeName: state.selectedStore ? state.selectedStore.name : 'Burger Prime',
          customerName: window.rapidinDB.getCurrentUser('user')?.name || 'Cliente Rapidin',
          customerAddress: document.getElementById('user-address-display')?.textContent || 'Ubicación Desconocida',
          total: orderTotal,
          subtotal: subtotal,
          shippingFee: 1.99,
          driverTip: state.selectedTip,
          createdAt: new Date().toLocaleTimeString(),
          items: state.cart.map(i => ({ name: i.name, quantity: i.quantity, price: i.unitPrice }))
        };

        // Intentar guardar en backend, pero si falla no bloqueamos el flujo
        let savedToServer = false;
        try {
          const response = await Promise.race([
            fetch('http://localhost:3000/api/orders', {
              method: 'POST',
              headers: window.rapidinDB.getAuthHeaders('user'),
              body: JSON.stringify(orderData)
            }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
          ]);
          const data = await response.json();
          savedToServer = data.success;
        } catch (fetchErr) {
          console.warn('No se pudo guardar pedido en backend:', fetchErr.message);
        }

        window.rapidinAlert('🚀 ¡Pedido confirmado por Rapidin! ' + (savedToServer ? 'Notificación enviada al restaurante.' : 'Pedido guardado localmente.'));
        state.activeOrder = orderData;
        localStorage.setItem('rapidin_active_order_id', orderId);
        
        state.cart = [];
        updateCartBadge();
        renderCartItems();
        closeCartDrawer();
        switchView('view-tracking');

      } catch (err) {
        console.error('Error en checkout:', err);
        window.rapidinAlert('❌ Error al procesar pedido: ' + err.message);
      } finally {
        if (btn) {
          btn.textContent = originalText;
          btn.disabled = false;
        }
      }
    });

    document.getElementById('btn-view-tracking')?.addEventListener('click', () => switchView('view-tracking'));
    document.getElementById('btn-back-from-tracking')?.addEventListener('click', () => switchView('view-home'));
  }

  init();
});
