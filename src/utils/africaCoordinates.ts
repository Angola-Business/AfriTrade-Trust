export interface CountryCenter {
  lat: number;
  lng: number;
  hubCity: string;
}

/**
 * Default geographic map camera centers for all 54 sovereign African nations.
 */
export const AFRICA_COUNTRY_CENTERS: Record<string, CountryCenter> = {
  DZ: { lat: 36.7538, lng: 3.0588, hubCity: 'Algiers' },
  AO: { lat: -8.8383, lng: 13.2344, hubCity: 'Luanda' },
  BJ: { lat: 6.3703, lng: 2.3912, hubCity: 'Cotonou' },
  BW: { lat: -24.6282, lng: 25.9231, hubCity: 'Gaborone' },
  BF: { lat: 12.3714, lng: -1.5197, hubCity: 'Ouagadougou' },
  BI: { lat: -3.3822, lng: 29.3644, hubCity: 'Bujumbura' },
  CV: { lat: 14.9331, lng: -23.5133, hubCity: 'Praia' },
  CM: { lat: 4.0511, lng: 9.7679, hubCity: 'Douala' },
  CF: { lat: 4.3947, lng: 18.5582, hubCity: 'Bangui' },
  TD: { lat: 12.1348, lng: 15.0557, hubCity: 'N’Djamena' },
  KM: { lat: -11.7172, lng: 43.2473, hubCity: 'Moroni' },
  CD: { lat: -4.4419, lng: 15.2663, hubCity: 'Kinshasa' },
  CG: { lat: -4.2634, lng: 15.2429, hubCity: 'Brazzaville' },
  CI: { lat: 5.3600, lng: -4.0083, hubCity: 'Abidjan' },
  DJ: { lat: 11.5721, lng: 43.1456, hubCity: 'Djibouti City' },
  EG: { lat: 30.0444, lng: 31.2357, hubCity: 'Cairo' },
  GQ: { lat: 3.7504, lng: 8.7371, hubCity: 'Malabo' },
  ER: { lat: 15.3229, lng: 38.9251, hubCity: 'Asmara' },
  SZ: { lat: -26.3054, lng: 31.1367, hubCity: 'Mbabane' },
  ET: { lat: 9.0320, lng: 38.7469, hubCity: 'Addis Ababa' },
  GA: { lat: 0.4162, lng: 9.4673, hubCity: 'Libreville' },
  GM: { lat: 13.4549, lng: -16.5790, hubCity: 'Banjul' },
  GH: { lat: 5.6037, lng: -0.1870, hubCity: 'Accra' },
  GN: { lat: 9.6412, lng: -13.5784, hubCity: 'Conakry' },
  GW: { lat: 11.8636, lng: -15.5977, hubCity: 'Bissau' },
  KE: { lat: -1.2921, lng: 36.8219, hubCity: 'Nairobi' },
  LS: { lat: -29.3167, lng: 27.4833, hubCity: 'Maseru' },
  LR: { lat: 6.3156, lng: -10.8074, hubCity: 'Monrovia' },
  LY: { lat: 32.8872, lng: 13.1913, hubCity: 'Tripoli' },
  MG: { lat: -18.8792, lng: 47.5079, hubCity: 'Antananarivo' },
  MW: { lat: -13.9626, lng: 33.7741, hubCity: 'Lilongwe' },
  ML: { lat: 12.6392, lng: -8.0029, hubCity: 'Bamako' },
  MR: { lat: 18.0735, lng: -15.9582, hubCity: 'Nouakchott' },
  MU: { lat: -20.1609, lng: 57.5012, hubCity: 'Port Louis' },
  MA: { lat: 33.5731, lng: -7.5898, hubCity: 'Casablanca' },
  MZ: { lat: -25.9692, lng: 32.5732, hubCity: 'Maputo' },
  NA: { lat: -22.5609, lng: 17.0658, hubCity: 'Windhoek' },
  NE: { lat: 13.5116, lng: 2.1254, hubCity: 'Niamey' },
  NG: { lat: 6.5244, lng: 3.3792, hubCity: 'Lagos' },
  RW: { lat: -1.9441, lng: 30.0619, hubCity: 'Kigali' },
  ST: { lat: 0.3365, lng: 6.7273, hubCity: 'São Tomé' },
  SN: { lat: 14.7167, lng: -17.4677, hubCity: 'Dakar' },
  SC: { lat: -4.6191, lng: 55.4513, hubCity: 'Victoria' },
  SL: { lat: 8.4657, lng: -13.2317, hubCity: 'Freetown' },
  SO: { lat: 2.0469, lng: 45.3182, hubCity: 'Mogadishu' },
  ZA: { lat: -26.2041, lng: 28.0473, hubCity: 'Johannesburg' },
  SS: { lat: 4.8594, lng: 31.5713, hubCity: 'Juba' },
  SD: { lat: 15.5007, lng: 32.5599, hubCity: 'Khartoum' },
  TZ: { lat: -6.7924, lng: 39.2083, hubCity: 'Dar es Salaam' },
  TG: { lat: 6.1375, lng: 1.2123, hubCity: 'Lomé' },
  TN: { lat: 36.8065, lng: 10.1815, hubCity: 'Tunis' },
  UG: { lat: 0.3476, lng: 32.5825, hubCity: 'Kampala' },
  ZM: { lat: -15.3875, lng: 28.3228, hubCity: 'Lusaka' },
  ZW: { lat: -17.8252, lng: 31.0335, hubCity: 'Harare' },
};

export const AFRICA_CONTINENT_CENTER = { lat: 2.5, lng: 18.5 };

export function getCountryCenter(countryCode?: string): CountryCenter {
  const code = (countryCode || '').toUpperCase().trim();
  return AFRICA_COUNTRY_CENTERS[code] || { lat: -8.8383, lng: 13.2344, hubCity: 'Commercial Hub' };
}

let cachedMapsApiKey: string | null = null;
let mapsKeyPromise: Promise<string> | null = null;

export async function resolveGoogleMapsApiKey(): Promise<string> {
  const buildTimeKey = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY;
  if (buildTimeKey && typeof buildTimeKey === 'string' && buildTimeKey.trim().length > 0) {
    cachedMapsApiKey = buildTimeKey.trim();
    return cachedMapsApiKey;
  }

  if (cachedMapsApiKey !== null) {
    return cachedMapsApiKey;
  }

  if (!mapsKeyPromise) {
    mapsKeyPromise = fetch('/api/maps/config')
      .then((res) => (res.ok ? res.json() : { apiKey: '' }))
      .then((data) => {
        cachedMapsApiKey = data?.apiKey || '';
        return cachedMapsApiKey || '';
      })
      .catch(() => {
        cachedMapsApiKey = '';
        return '';
      });
  }

  return mapsKeyPromise;
}

export function triggerQuotaExceededEvent() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
  }
}
