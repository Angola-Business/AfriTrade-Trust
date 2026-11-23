import React, { useEffect, useState, useRef } from 'react';
import {
  APIProvider,
  Map,
  AdvancedMarker,
  Pin,
  InfoWindow,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import { MapPin, Navigation, Building2, ShieldCheck, ExternalLink, Clock, Route as RouteIcon } from 'lucide-react';
import { BusinessListing } from '../types';
import {
  AFRICA_CONTINENT_CENTER,
  getCountryCenter,
  resolveGoogleMapsApiKey,
  triggerQuotaExceededEvent,
} from '../utils/africaCoordinates';
import { calculateRealtimeTrustScore } from '../utils/trustScore';

interface CorridorEndpoints {
  originLat: number;
  originLng: number;
  originLabel: string;
  destLat: number;
  destLng: number;
  destLabel: string;
}

interface AfricanTradeMapProps {
  businesses?: BusinessListing[];
  focusedBusiness?: BusinessListing;
  corridor?: CorridorEndpoints;
  onSelectBusiness?: (business: BusinessListing) => void;
  heightClassName?: string;
}

const CorridorRouteOverlay: React.FC<{
  corridor: CorridorEndpoints;
  onRouteSummary?: (summary: { distanceKm: string; durationText: string; mode: 'roads' | 'corridor' } | null) => void;
}> = ({ corridor, onRouteSummary }) => {
  const map = useMap();
  const routesLib = useMapsLibrary('routes');
  const mapsLib = useMapsLibrary('maps');
  const polyRef = useRef<any>(null);

  useEffect(() => {
    const g = (window as any).google;
    if (!map || !mapsLib || !g?.maps) return;

    let cancelled = false;

    const cleanupPolyline = () => {
      if (polyRef.current) {
        polyRef.current.setMap(null);
        polyRef.current = null;
      }
    };

    const bounds = new g.maps.LatLngBounds();
    bounds.extend({ lat: corridor.originLat, lng: corridor.originLng });
    bounds.extend({ lat: corridor.destLat, lng: corridor.destLng });
    map.fitBounds(bounds, { top: 60, right: 60, bottom: 60, left: 60 });

    async function computeCorridor() {
      cleanupPolyline();

      try {
        if (routesLib && (routesLib as any).Route?.computeRoutes) {
          const { routes } = await (routesLib as any).Route.computeRoutes({
            origin: { lat: corridor.originLat, lng: corridor.originLng },
            destination: { lat: corridor.destLat, lng: corridor.destLng },
            travelMode: 'DRIVING',
            fields: ['path', 'distanceMeters', 'durationMillis'],
          });

          if (cancelled) return;

          if (routes && routes.length > 0 && routes[0].path) {
            const route = routes[0];
            polyRef.current = new g.maps.Polyline({
              path: route.path,
              geodesic: true,
              strokeColor: '#10b981',
              strokeOpacity: 0.95,
              strokeWeight: 4,
              map,
            });
            const km = ((route.distanceMeters || 0) / 1000).toFixed(0);
            const hrs = Math.round((route.durationMillis || 0) / 3600000);
            onRouteSummary?.({
              distanceKm: `${Number(km).toLocaleString()} km`,
              durationText: hrs >= 24 ? `~${Math.round(hrs / 24)} days transit` : `~${Math.max(1, hrs)} hrs transit`,
              mode: 'roads',
            });
            return;
          }
        }
      } catch (err: any) {
        const msg = String(err?.message || err || '');
        if (msg.includes('OVER_QUERY_LIMIT') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('429')) {
          triggerQuotaExceededEvent();
        }
      }

      if (cancelled) return;

      // Cross-sea or long continental corridor fallback polyline (still accurate geodesic line between verified ports/hubs)
      polyRef.current = new g.maps.Polyline({
        path: [
          { lat: corridor.originLat, lng: corridor.originLng },
          { lat: corridor.destLat, lng: corridor.destLng },
        ],
        geodesic: true,
        strokeColor: '#ffffff',
        strokeOpacity: 0.85,
        strokeWeight: 3,
        map,
      });

      // Haversine great-circle corridor distance
      const R = 6371;
      const dLat = ((corridor.destLat - corridor.originLat) * Math.PI) / 180;
      const dLon = ((corridor.destLng - corridor.originLng) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((corridor.originLat * Math.PI) / 180) *
          Math.cos((corridor.destLat * Math.PI) / 180) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      const km = Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));

      onRouteSummary?.({
        distanceKm: `${km.toLocaleString()} km corridor`,
        durationText: 'Multimodal Air / Sea / Land corridor',
        mode: 'corridor',
      });
    }

    computeCorridor();

    return () => {
      cancelled = true;
      cleanupPolyline();
    };
  }, [
    map,
    routesLib,
    mapsLib,
    corridor.originLat,
    corridor.originLng,
    corridor.destLat,
    corridor.destLng,
  ]);

  return null;
};

const BoundsFitter: React.FC<{ points: Array<{ lat: number; lng: number }> }> = ({ points }) => {
  const map = useMap();

  useEffect(() => {
    const g = (window as any).google;
    if (!map || points.length === 0 || !g?.maps) return;

    if (points.length === 1) {
      map.panTo(points[0]);
      map.setZoom(11);
      return;
    }

    const bounds = new g.maps.LatLngBounds();
    points.forEach((p) => bounds.extend(p));
    map.fitBounds(bounds, { top: 55, right: 55, bottom: 55, left: 55 });
  }, [map, points]);

  return null;
};

export const AfricanTradeMap: React.FC<AfricanTradeMapProps> = ({
  businesses = [],
  focusedBusiness,
  corridor,
  onSelectBusiness,
  heightClassName = 'h-[380px] sm:h-[440px]',
}) => {
  const [apiKey, setApiKey] = useState<string>('');
  const [keyResolved, setKeyResolved] = useState<boolean>(false);
  const [selectedBizId, setSelectedBizId] = useState<string | null>(focusedBusiness?.id || null);
  const [routeSummary, setRouteSummary] = useState<{
    distanceKm: string;
    durationText: string;
    mode: 'roads' | 'corridor';
  } | null>(null);

  useEffect(() => {
    let mounted = true;
    resolveGoogleMapsApiKey().then((k) => {
      if (mounted) {
        setApiKey(k);
        setKeyResolved(true);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const markerEntries = React.useMemo(() => {
    const source = focusedBusiness ? [focusedBusiness] : businesses;
    return source.map((biz, idx) => {
      if (biz.gpsCoordinates?.lat && biz.gpsCoordinates?.lng) {
        return {
          business: biz,
          position: { lat: biz.gpsCoordinates.lat, lng: biz.gpsCoordinates.lng },
          exactGps: true,
        };
      }
      const center = getCountryCenter(biz.countryCode);
      // Small deterministic visual separation when multiple country-hub businesses lack street GPS
      const offset = source.length > 1 ? ((idx % 5) - 2) * 0.08 : 0;
      return {
        business: biz,
        position: { lat: center.lat + offset, lng: center.lng + offset },
        exactGps: false,
      };
    });
  }, [businesses, focusedBusiness]);

  const pointsForBounds = React.useMemo(() => {
    if (corridor) {
      return [
        { lat: corridor.originLat, lng: corridor.originLng },
        { lat: corridor.destLat, lng: corridor.destLng },
      ];
    }
    return markerEntries.map((m) => m.position);
  }, [corridor, markerEntries]);

  const initialCenter = focusedBusiness
    ? focusedBusiness.gpsCoordinates || getCountryCenter(focusedBusiness.countryCode)
    : corridor
    ? {
        lat: (corridor.originLat + corridor.destLat) / 2,
        lng: (corridor.originLng + corridor.destLng) / 2,
      }
    : AFRICA_CONTINENT_CENTER;

  const initialZoom = focusedBusiness ? 11 : 3;

  const activeEntry = markerEntries.find((m) => m.business.id === selectedBizId) || null;

  if (!keyResolved) {
    return (
      <div className={`${heightClassName} w-full rounded-2xl bg-neutral-900 animate-pulse flex items-center justify-center text-xs text-neutral-400 font-mono`}>
        Loading Pan-African Trade Map...
      </div>
    );
  }

  if (!apiKey) {
    return (
      <div className={`${heightClassName} w-full rounded-2xl bg-neutral-900/80 border border-neutral-800 flex flex-col items-center justify-center p-6 text-center space-y-2`}>
        <MapPin className="w-6 h-6 text-neutral-500" />
        <p className="text-xs font-semibold text-white">Interactive Google Map Connecting</p>
        <p className="text-[11px] text-neutral-400 max-w-md font-mono">
          Maps API key configuration pending runtime activation. Restart dev server if recently provisioned.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {corridor && routeSummary && (
        <div className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-white font-semibold">
            <RouteIcon className="w-4 h-4 text-emerald-400" />
            <span>
              {corridor.originLabel} → {corridor.destLabel}
            </span>
          </div>
          <div className="flex items-center gap-3 font-mono text-[11px] text-neutral-300">
            <span>{routeSummary.distanceKm}</span>
            <span className="flex items-center gap-1 text-emerald-400">
              <Clock className="w-3 h-3" />
              {routeSummary.durationText}
            </span>
          </div>
        </div>
      )}

      <div className={`${heightClassName} w-full rounded-2xl overflow-hidden border border-neutral-800 relative bg-neutral-950 shadow-xl`}>
        <APIProvider apiKey={apiKey} libraries={['marker', 'places', 'routes']}>
          <Map
            mapId="DEMO_MAP_ID"
            internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
            defaultCenter={initialCenter}
            defaultZoom={initialZoom}
            gestureHandling="greedy"
            colorScheme="DARK"
            style={{ width: '100%', height: '100%' }}
          >
            {!corridor && pointsForBounds.length > 0 && <BoundsFitter points={pointsForBounds} />}
            {corridor && (
              <>
                <CorridorRouteOverlay corridor={corridor} onRouteSummary={setRouteSummary} />
                <AdvancedMarker position={{ lat: corridor.originLat, lng: corridor.originLng }}>
                  <Pin background="#ffffff" borderColor="#000000" glyphColor="#000000" />
                </AdvancedMarker>
                <AdvancedMarker position={{ lat: corridor.destLat, lng: corridor.destLng }}>
                  <Pin background="#10b981" borderColor="#064e3b" glyphColor="#ffffff" />
                </AdvancedMarker>
              </>
            )}

            {markerEntries.map(({ business, position }) => {
              const isAudited = business.verification.tier === 'tier_3_audited';
              return (
                <AdvancedMarker
                  key={business.id}
                  position={position}
                  onClick={() => setSelectedBizId(business.id)}
                  title={business.name}
                >
                  <Pin
                    background={isAudited ? '#10b981' : '#ffffff'}
                    borderColor="#000000"
                    glyphColor={isAudited ? '#ffffff' : '#000000'}
                  />
                </AdvancedMarker>
              );
            })}

            {activeEntry && (
              <InfoWindow
                position={activeEntry.position}
                onCloseClick={() => setSelectedBizId(null)}
              >
                <div className="p-1.5 max-w-[230px] text-neutral-900 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-bold text-xs leading-snug text-black">
                      {activeEntry.business.name}
                    </span>
                  </div>
                  <div className="text-[11px] text-neutral-600 flex items-center gap-1">
                    <Building2 className="w-3 h-3 shrink-0" />
                    <span>
                      {activeEntry.business.city}, {activeEntry.business.country}
                    </span>
                  </div>
                  <div className="text-[10px] font-mono text-emerald-700 font-semibold flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 shrink-0" />
                    <span>
                      Trust {calculateRealtimeTrustScore(activeEntry.business).score}/100 · {activeEntry.business.industry}
                    </span>
                  </div>
                  {!activeEntry.exactGps && (
                    <div className="text-[10px] text-neutral-500">
                      Region hub marker ({activeEntry.business.countryCode})
                    </div>
                  )}
                  <div className="pt-1 flex items-center gap-2">
                    {onSelectBusiness && (
                      <button
                        type="button"
                        onClick={() => onSelectBusiness(activeEntry.business)}
                        className="px-2.5 py-1 bg-black text-white text-[11px] font-bold rounded-md hover:bg-neutral-800 cursor-pointer"
                      >
                        View Supplier
                      </button>
                    )}
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                        `${activeEntry.business.name} ${activeEntry.business.city} ${activeEntry.business.country}`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-blue-700 hover:underline inline-flex items-center gap-0.5 font-medium"
                    >
                      <Navigation className="w-3 h-3" />
                      <span>Maps</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                </div>
              </InfoWindow>
            )}
          </Map>
        </APIProvider>
      </div>
    </div>
  );
};
