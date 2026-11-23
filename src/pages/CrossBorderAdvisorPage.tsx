import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  ShieldCheck,
  FileCheck2,
  RefreshCw,
  Globe,
  Navigation,
  ExternalLink,
  MapPin,
} from 'lucide-react';
import { LanguageCode } from '../types';
import { TRANSLATIONS } from '../i18n/translations';
import { ALL_AFRICAN_COUNTRIES, getAfricanCountryByName } from '../utils/africanCountries';
import { getCountryCenter, triggerQuotaExceededEvent } from '../utils/africaCoordinates';
import { AfricanTradeMap } from '../components/AfricanTradeMap';

interface CrossBorderAdvisorPageProps {
  currentLang: LanguageCode;
  onBack: () => void;
}

export const CrossBorderAdvisorPage: React.FC<CrossBorderAdvisorPageProps> = ({
  currentLang,
  onBack,
}) => {
  const t = TRANSLATIONS[currentLang] || TRANSLATIONS.en;
  const [supplierCountry, setSupplierCountry] = useState('Angola');
  const [buyerCountry, setBuyerCountry] = useState('Namibia');
  const [productCategory, setProductCategory] = useState('Packaging & Containers');
  const [loading, setLoading] = useState(false);
  const [adviceData, setAdviceData] = useState<any>(null);
  const [mapsLoading, setMapsLoading] = useState(false);
  const [corridorHubs, setCorridorHubs] = useState<{
    text: string;
    mapsSources: Array<{ title: string; uri: string }>;
  } | null>(null);

  const originCountryObj = getAfricanCountryByName(supplierCountry);
  const destCountryObj = getAfricanCountryByName(buyerCountry);
  const originCenter = getCountryCenter(originCountryObj.code);
  const destCenter = getCountryCenter(destCountryObj.code);

  const handleConsultAdvisor = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setMapsLoading(true);
    setCorridorHubs(null);

    try {
      const [advisorRes, mapsRes] = await Promise.allSettled([
        fetch('/api/ai/trade-advisor', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            supplierCountry,
            buyerCountry,
            productCategory,
          }),
        }),
        fetch('/api/ai/maps-grounding', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: `Key commercial seaports, dry ports, and border customs stations connecting ${supplierCountry} and ${buyerCountry} for freight shipments`,
            lat: (originCenter.lat + destCenter.lat) / 2,
            lng: (originCenter.lng + destCenter.lng) / 2,
          }),
        }),
      ]);

      if (advisorRes.status === 'fulfilled' && advisorRes.value.ok) {
        const raw = await advisorRes.value.json();
        setAdviceData({
          applicableAgreement: raw.applicableAgreement || raw.tradeAgreement || `${supplierCountry} - ${buyerCountry} AfCFTA Trade Protocol`,
          tariffAdvantage: raw.tariffAdvantage || raw.tariffStatus || 'Eligible for preferential AfCFTA tariff treatment.',
          requiredDocuments: Array.isArray(raw.requiredDocuments)
            ? raw.requiredDocuments
            : Array.isArray(raw.requiredDocs)
            ? raw.requiredDocs
            : [],
          paymentSafetyAdvice: raw.paymentSafetyAdvice || raw.paymentRecommendation || 'Use PAPSS or Trade Escrow.',
          logisticsNote: raw.logisticsNote || '',
          groundingSources: Array.isArray(raw.groundingSources) ? raw.groundingSources : [],
        });
      } else {
        fallbackAdvice();
      }

      if (mapsRes.status === 'fulfilled') {
        if (mapsRes.value.status === 429) {
          triggerQuotaExceededEvent();
        } else if (mapsRes.value.ok) {
          const mapsData = await mapsRes.value.json();
          setCorridorHubs({
            text: mapsData.text || '',
            mapsSources: Array.isArray(mapsData.mapsSources) ? mapsData.mapsSources : [],
          });
        }
      }
    } catch {
      fallbackAdvice();
    } finally {
      setLoading(false);
      setMapsLoading(false);
    }
  };

  const fallbackAdvice = () => {
    setAdviceData({
      applicableAgreement: `${supplierCountry} - ${buyerCountry} Bilateral & AfCFTA Trade Protocol`,
      tariffAdvantage: '0% Preferential Import Duty under AfCFTA Rules of Origin (Criterion: Wholly Produced or Substantially Transformed).',
      requiredDocuments: [
        'AfCFTA Certificate of Origin (Form B)',
        'Commercial Invoice with 6-digit HS Code classification',
        'Consignment Note / Bill of Lading (CMR or Ocean BL)',
        'Phytosanitary / Quality Conformity Inspection Certificate',
      ],
      paymentSafetyAdvice: 'Utilize Pan-African Payment and Settlement System (PAPSS) in local currency or verified Letter of Credit with milestone release upon port clearance.',
      logisticsNote: `Cross-border commercial freight operating between ${originCenter.hubCity} and ${destCenter.hubCity}.`,
      groundingSources: [],
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="max-w-3xl mx-auto space-y-6 pt-2"
    >
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-xs font-semibold text-neutral-400 hover:text-white transition-colors cursor-pointer group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        <span>{t.backToDirectory}</span>
      </button>

      {/* Hero Header */}
      <div className="bg-neutral-950 rounded-2xl p-6 sm:p-8 space-y-3">
        <div className="w-10 h-10 rounded-xl bg-white text-black flex items-center justify-center">
          <Globe className="w-5 h-5" />
        </div>
        <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
          {t.advisorDesc}
        </p>
      </div>

      {/* Corridor Query Form */}
      <form onSubmit={handleConsultAdvisor} className="bg-neutral-950 rounded-2xl p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-mono uppercase text-neutral-400">{t.originCountry}</label>
            <select
              value={supplierCountry}
              onChange={(e) => setSupplierCountry(e.target.value)}
              className="w-full bg-neutral-900 text-white text-xs px-3 py-2.5 rounded-xl cursor-pointer"
            >
              {ALL_AFRICAN_COUNTRIES.map((c) => (
                <option key={c.code} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-mono uppercase text-neutral-400">{t.destCountry}</label>
            <select
              value={buyerCountry}
              onChange={(e) => setBuyerCountry(e.target.value)}
              className="w-full bg-neutral-900 text-white text-xs px-3 py-2.5 rounded-xl cursor-pointer"
            >
              {ALL_AFRICAN_COUNTRIES.map((c) => (
                <option key={c.code} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-mono uppercase text-neutral-400">{t.hsCodeCategory}</label>
          <input
            type="text"
            value={productCategory}
            onChange={(e) => setProductCategory(e.target.value)}
            className="w-full bg-neutral-900 text-white text-xs px-3.5 py-2.5 rounded-xl placeholder-neutral-500"
            placeholder="e.g. Food-grade packaging, Solar inverters, Shea butter..."
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-white text-black hover:bg-neutral-200 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg"
        >
          {loading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Analyzing AfCFTA Trade Corridors...</span>
            </>
          ) : (
            <>
              <Navigation className="w-4 h-4" />
              <span>{t.calculateFeasibility}</span>
            </>
          )}
        </button>
      </form>

      {/* Interactive Corridor Route Map */}
      <div className="bg-neutral-950 rounded-2xl p-5 sm:p-6 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-mono uppercase text-neutral-400">
            <MapPin className="w-4 h-4 text-white" />
            <span>Live Corridor Route Visualization</span>
          </div>
          <span className="text-[11px] font-mono text-neutral-400">
            {originCenter.hubCity} → {destCenter.hubCity}
          </span>
        </div>
        <AfricanTradeMap
          heightClassName="h-[320px]"
          corridor={{
            originLat: originCenter.lat,
            originLng: originCenter.lng,
            originLabel: `${originCenter.hubCity}, ${supplierCountry}`,
            destLat: destCenter.lat,
            destLng: destCenter.lng,
            destLabel: `${destCenter.hubCity}, ${buyerCountry}`,
          }}
        />
      </div>

      {/* Results Dossier */}
      {adviceData && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="bg-neutral-950 rounded-2xl p-6 sm:p-8 space-y-6"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-white" />
              <h2 className="text-base font-bold text-white tracking-tight">AfCFTA Corridor Assessment</h2>
            </div>
            <span className="text-[11px] font-mono text-neutral-400 uppercase">
              {supplierCountry} → {buyerCountry}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-neutral-900/70 p-4 rounded-xl space-y-2">
              <span className="text-[10px] font-mono uppercase text-neutral-400">Trade Regime</span>
              <p className="text-xs font-semibold text-white">{adviceData.applicableAgreement}</p>
            </div>

            <div className="bg-neutral-900/70 p-4 rounded-xl space-y-2">
              <span className="text-[10px] font-mono uppercase text-neutral-400">{t.tariffAssessment}</span>
              <p className="text-xs text-neutral-300">{adviceData.tariffAdvantage}</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-mono uppercase text-neutral-400">
              <FileCheck2 className="w-4 h-4 text-white" />
              <span>{t.customsDocs}</span>
            </div>
            <div className="space-y-2">
              {(adviceData.requiredDocuments || []).map((doc: string, idx: number) => (
                <div key={idx} className="bg-neutral-900/60 p-3 rounded-xl flex items-center gap-3">
                  <span className="w-5 h-5 rounded-full bg-white text-black text-[10px] font-bold flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <span className="text-xs text-neutral-200">{doc}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-neutral-900/70 p-4 rounded-xl space-y-1.5">
            <span className="text-[10px] font-mono uppercase text-neutral-400">{t.paymentSecurity}</span>
            <p className="text-xs text-neutral-300 leading-relaxed">{adviceData.paymentSafetyAdvice}</p>
          </div>

          {adviceData.logisticsNote && (
            <div className="bg-neutral-900/70 p-4 rounded-xl space-y-1.5">
              <span className="text-[10px] font-mono uppercase text-neutral-400">Corridor Brief</span>
              <p className="text-xs text-neutral-300 leading-relaxed">{adviceData.logisticsNote}</p>
            </div>
          )}

          {/* Search Grounding Sources */}
          {Array.isArray(adviceData.groundingSources) && adviceData.groundingSources.length > 0 && (
            <div className="bg-black/60 border border-neutral-800 p-4 rounded-xl space-y-2">
              <span className="text-[10px] font-mono uppercase text-neutral-400 block">
                Verified Trade References (Google Search Grounding)
              </span>
              <div className="flex flex-wrap gap-2">
                {adviceData.groundingSources.slice(0, 6).map((src: any, i: number) => (
                  <a
                    key={i}
                    href={src.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-[11px] text-emerald-300 hover:underline transition-colors"
                  >
                    <ExternalLink className="w-3 h-3 shrink-0" />
                    <span className="truncate max-w-[240px]">{src.title}</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Maps Grounding Hubs */}
          {(mapsLoading || corridorHubs) && (
            <div className="bg-black/60 border border-neutral-800 p-4 rounded-xl space-y-2.5">
              <span className="text-[10px] font-mono uppercase text-neutral-400 block">
                Ports, Dry Ports & Border Hubs (Google Maps)
              </span>
              {mapsLoading ? (
                <p className="text-xs text-neutral-400 font-mono">Loading corridor infrastructure hubs...</p>
              ) : (
                <>
                  {corridorHubs?.text && (
                    <p className="text-xs text-neutral-300 leading-relaxed whitespace-pre-line">
                      {corridorHubs.text}
                    </p>
                  )}
                  {corridorHubs?.mapsSources && corridorHubs.mapsSources.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {corridorHubs.mapsSources.map((src, i) => (
                        <a
                          key={i}
                          href={src.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-[11px] text-white hover:underline transition-colors"
                        >
                          <MapPin className="w-3 h-3 text-emerald-400 shrink-0" />
                          <span>{src.title}</span>
                          <ExternalLink className="w-2.5 h-2.5 text-neutral-400" />
                        </a>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </motion.div>
      )}
    </motion.div>
  );
};
