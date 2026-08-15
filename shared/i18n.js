/* ==========================================================================
   RAPIDIN - MULTI-COUNTRY, MULTI-CURRENCY & AUTO-DETECTION ENGINE 🌎
   ========================================================================== */

const RAPIDIN_COUNTRIES = {
  PE: { code: 'PE', name: 'Perú 🇵🇪', currency: 'PEN', symbol: 'S/', rateToUSD: 3.75, phonePrefix: '+51', taxRate: 0.18, defaultCity: 'Lima' },
  MX: { code: 'MX', name: 'México 🇲🇽', currency: 'MXN', symbol: '$', rateToUSD: 17.20, phonePrefix: '+52', taxRate: 0.16, defaultCity: 'CDMX' },
  CO: { code: 'CO', name: 'Colombia 🇨🇴', currency: 'COP', symbol: '$', rateToUSD: 3900.0, phonePrefix: '+57', taxRate: 0.19, defaultCity: 'Bogotá' },
  AR: { code: 'AR', name: 'Argentina 🇦🇷', currency: 'ARS', symbol: '$', rateToUSD: 950.0, phonePrefix: '+54', taxRate: 0.21, defaultCity: 'Buenos Aires' },
  CL: { code: 'CL', name: 'Chile 🇨🇱', currency: 'CLP', symbol: '$', rateToUSD: 920.0, phonePrefix: '+56', taxRate: 0.19, defaultCity: 'Santiago' },
  EC: { code: 'EC', name: 'Ecuador 🇪🇨', currency: 'USD', symbol: '$', rateToUSD: 1.0, phonePrefix: '+593', taxRate: 0.12, defaultCity: 'Guayaquil' },
  VE: { code: 'VE', name: 'Venezuela 🇻🇪', currency: 'VES', symbol: 'Bs', rateToUSD: 36.0, phonePrefix: '+58', taxRate: 0.16, defaultCity: 'Caracas' },
  BO: { code: 'BO', name: 'Bolivia 🇧🇴', currency: 'BOB', symbol: 'Bs', rateToUSD: 6.9, phonePrefix: '+591', taxRate: 0.13, defaultCity: 'La Paz' },
  PY: { code: 'PY', name: 'Paraguay 🇵🇾', currency: 'PYG', symbol: '₲', rateToUSD: 7300.0, phonePrefix: '+595', taxRate: 0.10, defaultCity: 'Asunción' },
  UY: { code: 'UY', name: 'Uruguay 🇺🇾', currency: 'UYU', symbol: '$U', rateToUSD: 38.0, phonePrefix: '+598', taxRate: 0.22, defaultCity: 'Montevideo' },
  BR: { code: 'BR', name: 'Brasil 🇧🇷', currency: 'BRL', symbol: 'R$', rateToUSD: 5.10, phonePrefix: '+55', taxRate: 0.17, defaultCity: 'São Paulo' },
  PA: { code: 'PA', name: 'Panamá 🇵🇦', currency: 'USD', symbol: '$', rateToUSD: 1.0, phonePrefix: '+507', taxRate: 0.07, defaultCity: 'Ciudad de Panamá' },
  CR: { code: 'CR', name: 'Costa Rica 🇨🇷', currency: 'CRC', symbol: '₡', rateToUSD: 510.0, phonePrefix: '+506', taxRate: 0.13, defaultCity: 'San José' },
  GT: { code: 'GT', name: 'Guatemala 🇬🇹', currency: 'GTQ', symbol: 'Q', rateToUSD: 7.8, phonePrefix: '+502', taxRate: 0.12, defaultCity: 'Ciudad de Guatemala' },
  HN: { code: 'HN', name: 'Honduras 🇭🇳', currency: 'HNL', symbol: 'L', rateToUSD: 24.5, phonePrefix: '+504', taxRate: 0.15, defaultCity: 'Tegucigalpa' },
  SV: { code: 'SV', name: 'El Salvador 🇸🇻', currency: 'USD', symbol: '$', rateToUSD: 1.0, phonePrefix: '+503', taxRate: 0.13, defaultCity: 'San Salvador' },
  NI: { code: 'NI', name: 'Nicaragua 🇳🇮', currency: 'NIO', symbol: 'C$', rateToUSD: 36.5, phonePrefix: '+505', taxRate: 0.15, defaultCity: 'Managua' },
  CU: { code: 'CU', name: 'Cuba 🇨🇺', currency: 'CUP', symbol: '$', rateToUSD: 24.0, phonePrefix: '+53', taxRate: 0.0, defaultCity: 'La Habana' },
  DO: { code: 'DO', name: 'R. Dominicana 🇩🇴', currency: 'DOP', symbol: 'RD$', rateToUSD: 58.0, phonePrefix: '+1', taxRate: 0.18, defaultCity: 'Santo Domingo' },
  PR: { code: 'PR', name: 'Puerto Rico 🇵🇷', currency: 'USD', symbol: '$', rateToUSD: 1.0, phonePrefix: '+1', taxRate: 0.115, defaultCity: 'San Juan' },
  US: { code: 'US', name: 'Estados Unidos 🇺🇸', currency: 'USD', symbol: '$', rateToUSD: 1.0, phonePrefix: '+1', taxRate: 0.08, defaultCity: 'Miami' },
  ES: { code: 'ES', name: 'España 🇪🇸', currency: 'EUR', symbol: '€', rateToUSD: 0.92, phonePrefix: '+34', taxRate: 0.21, defaultCity: 'Madrid' }
};

class RapidinI18nEngine {
  constructor() {
    this.currentCountryCode = localStorage.getItem('rapidin_country_code') || this._autoDetectCountry();
  }

  // Detección automática del país según la zona horaria del dispositivo del usuario
  _autoDetectCountry() {
    try {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      if (timeZone.includes('Lima')) return 'PE';
      if (timeZone.includes('Mexico') || timeZone.includes('Monterrey') || timeZone.includes('Cancun') || timeZone.includes('Tijuana')) return 'MX';
      if (timeZone.includes('Bogota')) return 'CO';
      if (timeZone.includes('Buenos_Aires') || timeZone.includes('Cordoba') || timeZone.includes('Mendoza')) return 'AR';
      if (timeZone.includes('Santiago') || timeZone.includes('Punta_Arenas')) return 'CL';
      if (timeZone.includes('Guayaquil')) return 'EC';
      if (timeZone.includes('Caracas')) return 'VE';
      if (timeZone.includes('La_Paz')) return 'BO';
      if (timeZone.includes('Asuncion')) return 'PY';
      if (timeZone.includes('Montevideo')) return 'UY';
      if (timeZone.includes('Sao_Paulo') || timeZone.includes('Rio_Branco') || timeZone.includes('Fortaleza')) return 'BR';
      if (timeZone.includes('Panama')) return 'PA';
      if (timeZone.includes('Costa_Rica')) return 'CR';
      if (timeZone.includes('Guatemala')) return 'GT';
      if (timeZone.includes('Tegucigalpa')) return 'HN';
      if (timeZone.includes('El_Salvador')) return 'SV';
      if (timeZone.includes('Managua')) return 'NI';
      if (timeZone.includes('Havana')) return 'CU';
      if (timeZone.includes('Santo_Domingo')) return 'DO';
      if (timeZone.includes('Puerto_Rico')) return 'PR';
      if (timeZone.includes('Madrid') || timeZone.includes('Canary')) return 'ES';
      if (timeZone.includes('New_York') || timeZone.includes('Los_Angeles') || timeZone.includes('Chicago')) return 'US';
    } catch (e) {
      console.log('Error auto-detecting country timezone:', e);
    }
    return 'PE'; // Fallback por defecto
  }

  getCountry() {
    return RAPIDIN_COUNTRIES[this.currentCountryCode] || RAPIDIN_COUNTRIES['PE'];
  }

  setCountry(countryCode) {
    if (RAPIDIN_COUNTRIES[countryCode]) {
      this.currentCountryCode = countryCode;
      localStorage.setItem('rapidin_country_code', countryCode);
      window.location.reload();
    }
  }

  formatPrice(amountInUSD) {
    const country = this.getCountry();
    const localAmount = amountInUSD * country.rateToUSD;

    if (country.code === 'PE') {
      return `S/ ${localAmount.toFixed(2)}`;
    } else if (country.code === 'ES') {
      return `${localAmount.toFixed(2)} €`;
    } else if (country.code === 'CO' || country.code === 'CL' || country.code === 'AR') {
      return `${country.symbol} ${Math.round(localAmount).toLocaleString('es')}`;
    } else {
      return `${country.symbol}${localAmount.toFixed(2)} ${country.currency}`;
    }
  }

  getCountryList() {
    return Object.values(RAPIDIN_COUNTRIES);
  }
}

window.rapidinI18n = new RapidinI18nEngine();
