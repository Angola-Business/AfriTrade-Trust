import React, { useEffect, useRef, useState } from 'react';
import { APIProvider, useMapsLibrary } from '@vis.gl/react-google-maps';
import { MapPin, CheckCircle2, Search } from 'lucide-react';
import { resolveGoogleMapsApiKey, triggerQuotaExceededEvent } from '../utils/africaCoordinates';

interface AddressResult {
  address: string;
  city?: string;
  lat: number;
  lng: number;
}

interface PlacesAddressPickerProps {
  value: string;
  countryCode: string;
  countryName: string;
  onChange: (value: string) => void;
  onSelectResolved: (result: AddressResult) => void;
}

const AutocompleteInputInner: React.FC<PlacesAddressPickerProps> = ({
  value,
  countryCode,
  countryName,
  onChange,
  onSelectResolved,
}) => {
  const placesLib = useMapsLibrary('places');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [openDropdown, setOpenDropdown] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [resolvedGps, setResolvedGps] = useState<{ lat: number; lng: number } | null>(null);
  const sessionTokenRef = useRef<any>(null);

  useEffect(() => {
    if (placesLib && (placesLib as any).AutocompleteSessionToken) {
      sessionTokenRef.current = new (placesLib as any).AutocompleteSessionToken();
    }
  }, [placesLib]);

  const handleInputChange = async (nextVal: string) => {
    onChange(nextVal);
    setResolvedGps(null);

    if (!nextVal || nextVal.trim().length < 3) {
      setSuggestions([]);
      setOpenDropdown(false);
      return;
    }

    if (placesLib && (placesLib as any).AutocompleteSuggestion?.fetchAutocompleteSuggestions) {
      setIsSearching(true);
      try {
        if (!sessionTokenRef.current && (placesLib as any).AutocompleteSessionToken) {
          sessionTokenRef.current = new (placesLib as any).AutocompleteSessionToken();
        }
        const request: any = {
          input: `${nextVal.trim()}, ${countryName}`,
          sessionToken: sessionTokenRef.current,
        };
        if (countryCode && countryCode.length === 2) {
          request.includedRegionCodes = [countryCode.toLowerCase()];
        }
        const { suggestions: fetched } = await (placesLib as any).AutocompleteSuggestion.fetchAutocompleteSuggestions(request);
        setSuggestions(fetched || []);
        setOpenDropdown((fetched || []).length > 0);
      } catch (err: any) {
        const msg = String(err?.message || err || '');
        if (msg.includes('OVER_QUERY_LIMIT') || msg.includes('RESOURCE_EXHAUSTED')) {
          triggerQuotaExceededEvent();
        }
        setSuggestions([]);
      } finally {
        setIsSearching(false);
      }
    }
  };

  const handlePickSuggestion = async (suggestion: any) => {
    try {
      const prediction = suggestion?.placePrediction;
      if (!prediction) return;
      const place = prediction.toPlace();
      await place.fetchFields({ fields: ['formattedAddress', 'location', 'displayName', 'addressComponents'] });

      const formatted = place.formattedAddress || prediction.text?.text || value;
      const loc = place.location;
      const lat = typeof loc?.lat === 'function' ? loc.lat() : loc?.lat;
      const lng = typeof loc?.lng === 'function' ? loc.lng() : loc?.lng;

      let cityName = '';
      if (Array.isArray(place.addressComponents)) {
        const locality = place.addressComponents.find(
          (c: any) => Array.isArray(c.types) && (c.types.includes('locality') || c.types.includes('administrative_area_level_1'))
        );
        if (locality?.longText) {
          cityName = locality.longText;
        }
      }

      onChange(formatted);
      setSuggestions([]);
      setOpenDropdown(false);

      if (placesLib && (placesLib as any).AutocompleteSessionToken) {
        sessionTokenRef.current = new (placesLib as any).AutocompleteSessionToken();
      }

      if (typeof lat === 'number' && typeof lng === 'number') {
        setResolvedGps({ lat, lng });
        onSelectResolved({
          address: formatted,
          city: cityName || undefined,
          lat,
          lng,
        });
      }
    } catch (err: any) {
      const msg = String(err?.message || err || '');
      if (msg.includes('OVER_QUERY_LIMIT') || msg.includes('RESOURCE_EXHAUSTED')) {
        triggerQuotaExceededEvent();
      }
    }
  };

  const handleGeocodeVerify = async () => {
    if (!value.trim()) return;
    setIsSearching(true);
    try {
      const res = await fetch('/api/maps/geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: `${value.trim()}, ${countryName}` }),
      });
      if (res.status === 429) {
        triggerQuotaExceededEvent();
        return;
      }
      if (res.ok) {
        const data = await res.json();
        if (typeof data.lat === 'number' && typeof data.lng === 'number') {
          setResolvedGps({ lat: data.lat, lng: data.lng });
          onSelectResolved({
            address: data.formattedAddress || value,
            lat: data.lat,
            lng: data.lng,
          });
        }
      }
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="relative space-y-1.5">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <MapPin className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-3 pointer-events-none" />
          <input
            type="text"
            value={value}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder={`Search street, industrial park, or port in ${countryName}...`}
            className="w-full bg-black text-white pl-9 pr-3.5 py-2.5 rounded-xl focus:outline-none focus:ring-1 focus:ring-white text-xs"
          />
        </div>
        <button
          type="button"
          onClick={handleGeocodeVerify}
          disabled={isSearching || !value.trim()}
          className="px-3 py-2.5 bg-neutral-900 hover:bg-neutral-800 disabled:opacity-40 text-white rounded-xl text-[11px] font-mono flex items-center gap-1.5 cursor-pointer shrink-0 transition-colors"
        >
          <Search className="w-3 h-3" />
          <span>{isSearching ? 'Locating...' : 'Pin Coordinates'}</span>
        </button>
      </div>

      {resolvedGps && (
        <div className="text-[11px] font-mono text-emerald-400 flex items-center gap-1.5 pl-1">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>
            Verified GPS coordinates: {resolvedGps.lat.toFixed(4)}, {resolvedGps.lng.toFixed(4)}
          </span>
        </div>
      )}

      {openDropdown && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-11 z-40 bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl overflow-hidden max-h-52 overflow-y-auto">
          {suggestions.map((s, idx) => {
            const mainText = s?.placePrediction?.mainText?.text || s?.placePrediction?.text?.text || '';
            const secondaryText = s?.placePrediction?.secondaryText?.text || '';
            return (
              <button
                key={idx}
                type="button"
                onClick={() => handlePickSuggestion(s)}
                className="w-full text-left px-3.5 py-2.5 hover:bg-neutral-800 text-xs transition-colors border-b border-neutral-800/60 last:border-b-0 cursor-pointer flex items-start gap-2"
              >
                <MapPin className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <div className="text-white font-semibold truncate">{mainText}</div>
                  {secondaryText && (
                    <div className="text-[11px] text-neutral-400 truncate">{secondaryText}</div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export const PlacesAddressPicker: React.FC<PlacesAddressPickerProps> = (props) => {
  const [apiKey, setApiKey] = useState<string>('');
  const [loaded, setLoaded] = useState<boolean>(false);

  useEffect(() => {
    let mounted = true;
    resolveGoogleMapsApiKey().then((k) => {
      if (mounted) {
        setApiKey(k);
        setLoaded(true);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  if (!loaded || !apiKey) {
    return (
      <input
        type="text"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={`Street address / Industrial zone in ${props.countryName}`}
        className="w-full bg-black text-white px-3.5 py-2.5 rounded-xl focus:outline-none focus:ring-1 focus:ring-white text-xs"
      />
    );
  }

  return (
    <APIProvider apiKey={apiKey} libraries={['places']}>
      <AutocompleteInputInner {...props} />
    </APIProvider>
  );
};
