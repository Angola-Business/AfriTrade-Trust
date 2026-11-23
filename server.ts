import express from 'express';
import http from 'http';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = http.createServer(app);
app.use(express.json());

const geminiKey = process.env.GEMINI_API_KEY;
const openrouterKey = process.env.Openrouter_api || process.env.OPENROUTER_API_KEY;
const openAIKey = process.env.OpenAI_key || process.env.OPENAI_API_KEY;
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.Supabase_project_url || process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.Supabase_anon_key || process.env.Supabase_publishable_key || process.env.SUPABASE_ANON_KEY || '';
const mapsApiKey = process.env.VITE_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '';

const ai = geminiKey
  ? new GoogleGenAI({
      apiKey: geminiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    hasGeminiKey: Boolean(geminiKey),
    hasSupabase: Boolean(supabaseUrl && supabaseAnonKey),
    hasGoogleMaps: Boolean(mapsApiKey),
    hasOpenRouter: Boolean(openrouterKey),
    hasOpenAI: Boolean(openAIKey),
    supabaseUrl: supabaseUrl ? supabaseUrl.replace(/https:\/\/(.{4}).*(\..*)/, 'https://$1***$2') : null,
    timestamp: new Date().toISOString(),
    version: '2.2.0-realtime',
  });
});

// Cloud Real-time configuration endpoint for frontend client
app.get('/api/supabase/config', (_req, res) => {
  res.json({
    url: supabaseUrl,
    anonKey: supabaseAnonKey,
    configured: Boolean(supabaseUrl && supabaseAnonKey),
  });
});

// Google Maps configuration endpoint for runtime key hydration
app.get('/api/maps/config', (_req, res) => {
  res.json({
    apiKey: mapsApiKey,
    configured: Boolean(mapsApiKey),
  });
});

// Server-side Geocoding Proxy (avoids browser CORS issues & handles Tier 2 quota signals)
app.post('/api/maps/geocode', async (req, res) => {
  try {
    const { address } = req.body;
    if (!address || typeof address !== 'string') {
      return res.status(400).json({ error: 'Address is required' });
    }
    if (!mapsApiKey) {
      return res.status(503).json({ error: 'Google Maps API key not configured' });
    }

    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${encodeURIComponent(mapsApiKey)}`;
    const upstream = await fetch(url);
    const data = await upstream.json();

    if (upstream.status === 429 || data?.status === 'OVER_QUERY_LIMIT' || data?.error?.status === 'RESOURCE_EXHAUSTED') {
      return res.status(429).json({ error: 'quota_exceeded', code: 'RESOURCE_EXHAUSTED' });
    }

    if (data?.status === 'OK' && Array.isArray(data.results) && data.results.length > 0) {
      const top = data.results[0];
      return res.json({
        lat: top.geometry?.location?.lat,
        lng: top.geometry?.location?.lng,
        formattedAddress: top.formatted_address,
        placeId: top.place_id,
      });
    }

    return res.status(404).json({ error: data?.status || 'Address not found' });
  } catch (err: any) {
    console.error('Error in /api/maps/geocode:', err);
    return res.status(500).json({ error: 'Geocoding request failed' });
  }
});

// Server-side Routes API Proxy (computeRoutes v2)
app.post('/api/maps/route-distance', async (req, res) => {
  try {
    const { origin, destination } = req.body;
    if (!origin?.lat || !origin?.lng || !destination?.lat || !destination?.lng) {
      return res.status(400).json({ error: 'Origin and destination coordinates are required' });
    }
    if (!mapsApiKey) {
      return res.status(503).json({ error: 'Google Maps API key not configured' });
    }

    const upstream = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': mapsApiKey,
        'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline',
      },
      body: JSON.stringify({
        origin: {
          location: { latLng: { latitude: Number(origin.lat), longitude: Number(origin.lng) } },
        },
        destination: {
          location: { latLng: { latitude: Number(destination.lat), longitude: Number(destination.lng) } },
        },
        travelMode: 'DRIVE',
        routingPreference: 'TRAFFIC_AWARE',
      }),
    });

    const data = await upstream.json();
    if (upstream.status === 429 || data?.error?.status === 'RESOURCE_EXHAUSTED') {
      return res.status(429).json({ error: 'quota_exceeded', code: 'RESOURCE_EXHAUSTED' });
    }

    const route = data?.routes?.[0];
    if (!route) {
      return res.status(404).json({ error: 'No driving route found between selected hubs' });
    }

    return res.json({
      distanceMeters: route.distanceMeters,
      duration: route.duration,
      encodedPolyline: route.polyline?.encodedPolyline || null,
    });
  } catch (err: any) {
    console.error('Error in /api/maps/route-distance:', err);
    return res.status(500).json({ error: 'Route calculation failed' });
  }
});

// Smart Natural Language Business Search & Cross-Border Matcher
app.post('/api/ai/natural-search', async (req, res) => {
  try {
    const { query, language = 'en', businessSummaries = [] } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query string is required' });
    }

    if (!ai) {
      return res.json({
        fallback: true,
        parsedIntent: {
          keywords: query.toLowerCase().split(/\s+/),
          interpretation: `Searching African suppliers matching: "${query}"`,
        },
        afcftaAdvice: 'Tip: Check supplier AfCFTA certificate of origin to qualify for preferential zero-tariff trading across AU member states.',
      });
    }

    const prompt = `You are AfriTrade Smart Match, a Pan-African B2B Trade & Supplier Matchmaking Engine.
The user wants to find African suppliers/businesses using this natural language query: "${query}"
The user's preferred interface language is: "${language}".

Below is the catalogue of candidate African businesses:
${JSON.stringify(businessSummaries, null, 2)}

Your task:
1. Parse the user's intent: target product/industry, origin country or location, target export destination, verification requirements, and specific capabilities (e.g. food-grade, ISO certification, minimum order quantities).
2. Rank the candidate businesses by relevance (0 to 100). Only include businesses that reasonably match the user's intent.
3. For each matched business, write a 1-2 sentence concise explanation highlighting verified facts (e.g. "Registered with Angola Guichet Unique, ISO 22000 certified, exports to SADC countries including Namibia").
4. Provide a practical AfCFTA or regional trade tip (e.g. SADC, ECOWAS, EAC customs rules or documentation required).
5. Translate the user query into key trade search terms in English, French, and Portuguese if relevant.

Return STRICT JSON matching this schema:
{
  "parsedIntent": {
    "productCategory": string,
    "originCountry": string,
    "destinationCountry": string,
    "mustBeVerified": boolean,
    "keyRequirements": string[]
  },
  "matches": [
    {
      "id": string,
      "score": number,
      "reason": string
    }
  ],
  "afcftaAdvice": string,
  "searchKeywords": string[]
}
Do not invent unverified certifications or capabilities. Only cite what is present in the candidate business data.`;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });

      const text = response.text || '{}';
      const parsed = JSON.parse(text);
      return res.json(parsed);
    } catch (modelErr: any) {
      console.warn('Model call failed in /api/ai/natural-search, falling back to rule-based matcher:', modelErr?.message);
      const q = query.toLowerCase();
      const matchedBusinesses = (businessSummaries || []).filter((b: any) => {
        const text = `${b.name} ${b.country} ${b.industry} ${(b.products || []).join(' ')} ${(b.countriesServed || []).join(' ')}`.toLowerCase();
        return q.split(/\s+/).some((w: string) => w.length > 2 && text.includes(w));
      });

      return res.json({
        fallback: true,
        parsedIntent: {
          productCategory: q.includes('packag') || q.includes('embalagen') || q.includes('carton') ? 'Packaging & Containers' : 'Commercial Goods',
          originCountry: q.includes('angola') ? 'Angola' : q.includes('kenya') ? 'Kenya' : q.includes('nigeria') ? 'Nigeria' : 'Pan-African',
          destinationCountry: q.includes('namibia') ? 'Namibia' : 'Cross-Border',
          mustBeVerified: true,
          keyRequirements: ['Food-grade compliance', 'National registry verification'],
        },
        matches: matchedBusinesses.map((b: any) => ({
          id: b.id,
          score: 95,
          reason: `Verified in ${b.country} with ${b.verificationTier === 'tier_3_audited' ? 'Tier 3 audit' : 'legal registration'}. Capable of cross-border supply.`,
        })),
        afcftaAdvice: 'AfCFTA corridor alert: Zero-tariff qualification applies when accompanied by Form B Certificate of Origin.',
        searchKeywords: [query, 'cross-border trade', 'verified supplier'],
      });
    }
  } catch (err: any) {
    console.error('Error in /api/ai/natural-search:', err);
    return res.status(500).json({
      error: 'Search processing failed',
      details: err?.message || String(err),
    });
  }
});

// WhatsApp Commercial Inquiry & RFQ Generator
app.post('/api/ai/draft-whatsapp', async (req, res) => {
  try {
    const {
      businessName,
      businessCountry,
      buyerName = 'Commercial Buyer',
      buyerCountry = 'Pan-African Buyer',
      inquiryType = 'quote',
      targetProduct = '',
      quantity = 'Wholesale volume',
      targetDestination = '',
      specificRequirements = '',
      preferredLanguage = 'en',
    } = req.body;

    if (!businessName) {
      return res.status(400).json({ error: 'Business name is required' });
    }

    if (!ai) {
      const fallbackText = `Hello ${businessName},\n\nI discovered your verified profile on AfriTrade Trust. We are interested in sourcing ${targetProduct || 'your products'} for delivery to ${targetDestination || buyerCountry}.\n\nCould you please share your wholesale price quotation for ${quantity}, along with your Minimum Order Quantity (MOQ) and lead time?\n\nLooking forward to doing business,\n${buyerName}`;
      return res.json({ draftMessage: fallbackText, language: preferredLanguage });
    }

    const prompt = `You are an expert Pan-African trade facilitator assisting a commercial buyer in contacting an African supplier on WhatsApp.
WhatsApp inquiries in Africa must be respectful, professional, concise, and clear regarding trade specifications.

Context:
- Supplier: ${businessName} (Country: ${businessCountry})
- Buyer: ${buyerName} (From: ${buyerCountry})
- Inquiry Type: ${inquiryType}
- Target Product/Service: ${targetProduct}
- Order Quantity: ${quantity}
- Destination Port / City: ${targetDestination || buyerCountry}
- Special Requirements: ${specificRequirements || 'Standard wholesale terms'}
- Desired Message Language: ${preferredLanguage} (en=English, pt=Portuguese, fr=French, sw=Kiswahili, ar=Arabic)

Generate a ready-to-send WhatsApp commercial message under 140 words in JSON:
{
  "draftMessage": string,
  "greeting": string,
  "keyChecklist": string[]
}`;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });

      const text = response.text || '{}';
      const parsed = JSON.parse(text);
      return res.json(parsed);
    } catch (modelErr: any) {
      console.warn('draft-whatsapp fallback:', modelErr?.message);
      const greetingMap: Record<string, string> = {
        pt: `Olá equipa comercial da ${businessName},`,
        en: `Hello sales team at ${businessName},`,
        fr: `Bonjour l’équipe commerciale de ${businessName},`,
        sw: `Habari timu ya mauzo ya ${businessName},`,
        ar: `مرحباً بفريق المبيعات في ${businessName}،`,
      };
      const greeting = greetingMap[preferredLanguage] || greetingMap.en;
      const draft = `${greeting}\n\nI discovered your verified profile on AfriTrade Trust. We are commercial buyers from ${buyerCountry} looking to source:\n• Product: ${targetProduct || 'Wholesale goods'}\n• Order volume: ${quantity}\n• Delivery destination: ${targetDestination || buyerCountry}\n\nCould you kindly confirm your wholesale unit price, Minimum Order Quantity (MOQ), and shipping lead time under AfCFTA?\n\nBest regards,\n${buyerName}`;

      return res.json({
        draftMessage: draft,
        greeting,
        keyChecklist: ['Confirm MOQ', 'Request AfCFTA Certificate', 'Incoterm (CIF/FOB)'],
      });
    }
  } catch (err: any) {
    console.error('Error in /api/ai/draft-whatsapp:', err);
    return res.status(500).json({
      error: 'WhatsApp draft generation failed',
      details: err?.message || String(err),
    });
  }
});

// Cross-Border Trade & Compliance Evaluator (with Google Search Grounding sources)
app.post('/api/ai/trade-advisor', async (req, res) => {
  try {
    const { supplierCountry, buyerCountry, productCategory } = req.body;

    if (!supplierCountry || !buyerCountry || !productCategory) {
      return res.status(400).json({ error: 'Missing trade parameters' });
    }

    const buildFallback = () => ({
      applicableAgreement: `${supplierCountry} - ${buyerCountry} AfCFTA Preferential Trade Protocol`,
      tariffAdvantage: 'Eligible for preferential reduced or zero tariffs under AfCFTA Rules of Origin when certified.',
      requiredDocuments: [
        'AfCFTA Form B Certificate of Origin',
        'Commercial Invoice with 6-digit Harmonized System (HS) Code',
        'National Standards Quality Conformity Certificate',
        'Road Consignment Note (CMR) or Port Bill of Lading',
      ],
      paymentSafetyAdvice: 'Use Pan-African Payment and Settlement System (PAPSS), AfriTrade Trade Escrow, or a Confirmed Letter of Credit.',
      logisticsNote: `Transit between ${supplierCountry} and ${buyerCountry} governed by regional trade corridor customs rules.`,
      buyerSafetyTips: [
        'Verify company registration status with the national commercial registrar',
        'Use escrow or documentary letters of credit for cross-border deposits',
      ],
      groundingSources: [] as Array<{ title: string; uri: string }>,
    });

    if (!ai) {
      return res.json(buildFallback());
    }

    const structuredPrompt = `You are a Senior Pan-African Trade Specialist advising on cross-border commercial transactions between two African nations.
Trade Route:
- Origin/Supplier Country: ${supplierCountry}
- Destination/Buyer Country: ${buyerCountry}
- Product Category: ${productCategory}

Return STRICT JSON matching:
{
  "applicableAgreement": string,
  "tariffAdvantage": string,
  "requiredDocuments": string[],
  "paymentSafetyAdvice": string,
  "logisticsNote": string,
  "buyerSafetyTips": string[]
}`;

    try {
      const [structuredRes, searchGroundedRes] = await Promise.allSettled([
        ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: structuredPrompt,
          config: {
            responseMimeType: 'application/json',
          },
        }),
        ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: `Summarize official AfCFTA, SADC, ECOWAS, or EAC customs tariff and trade corridor updates between ${supplierCountry} and ${buyerCountry} for ${productCategory} exports in 2 sentences.`,
          config: {
            tools: [{ googleSearch: {} }],
          },
        }),
      ]);

      let parsed = buildFallback();
      if (structuredRes.status === 'fulfilled' && structuredRes.value.text) {
        const raw = JSON.parse(structuredRes.value.text);
        parsed = {
          applicableAgreement: raw.applicableAgreement || raw.tradeAgreement || parsed.applicableAgreement,
          tariffAdvantage: raw.tariffAdvantage || raw.tariffStatus || parsed.tariffAdvantage,
          requiredDocuments: Array.isArray(raw.requiredDocuments)
            ? raw.requiredDocuments
            : Array.isArray(raw.requiredDocs)
            ? raw.requiredDocs
            : parsed.requiredDocuments,
          paymentSafetyAdvice: raw.paymentSafetyAdvice || raw.paymentRecommendation || parsed.paymentSafetyAdvice,
          logisticsNote: raw.logisticsNote || parsed.logisticsNote,
          buyerSafetyTips: Array.isArray(raw.buyerSafetyTips) ? raw.buyerSafetyTips : parsed.buyerSafetyTips,
          groundingSources: [],
        };
      }

      if (searchGroundedRes.status === 'fulfilled') {
        const chunks = searchGroundedRes.value.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        const webSources = chunks
          .filter((c: any) => c.web?.uri)
          .map((c: any) => ({
            title: c.web.title || c.web.uri,
            uri: c.web.uri,
          }));
        parsed.groundingSources = webSources;
        if (searchGroundedRes.value.text && webSources.length > 0) {
          parsed.logisticsNote = `${parsed.logisticsNote} ${searchGroundedRes.value.text.trim()}`;
        }
      }

      return res.json(parsed);
    } catch (modelErr: any) {
      console.warn('trade-advisor fallback:', modelErr?.message);
      return res.json(buildFallback());
    }
  } catch (err: any) {
    console.error('Error in /api/ai/trade-advisor:', err);
    return res.status(500).json({
      error: 'Trade advisor failed',
      details: err?.message || String(err),
    });
  }
});

// Google Maps Grounding Endpoint (with Places API (New) fallback when Gemini quota is exhausted)
app.post('/api/ai/maps-grounding', async (req, res) => {
  const { query, lat, lng } = req.body;
  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'Query is required' });
  }

  // Try Gemini Grounding with Google Maps first if key is available
  if (ai) {
    try {
      const config: any = {
        tools: [{ googleMaps: {} }],
      };

      if (typeof lat === 'number' && typeof lng === 'number' && !Number.isNaN(lat) && !Number.isNaN(lng)) {
        config.toolConfig = {
          retrievalConfig: {
            latLng: { latitude: lat, longitude: lng },
          },
        };
      }

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: query,
        config,
      });

      const metadata = response.candidates?.[0]?.groundingMetadata;
      const chunks = metadata?.groundingChunks || [];
      const mapsSources = chunks
        .filter((c: any) => c.maps?.uri)
        .map((c: any) => ({
          title: c.maps.title || 'View on Google Maps',
          uri: c.maps.uri,
          placeId: c.maps.placeId || undefined,
          reviewSnippets: c.maps.placeAnswerSources?.reviewSnippets || [],
        }));

      return res.json({
        text: response.text || '',
        mapsSources,
        googleMapsWidgetContextToken: metadata?.googleMapsWidgetContextToken || null,
      });
    } catch (geminiErr: any) {
      console.warn('Gemini maps-grounding unavailable, trying Places API (New):', geminiErr?.message);
    }
  }

  // Fallback to Places API (New) server-side search for verified ports/hubs
  if (mapsApiKey) {
    try {
      const placesBody: any = {
        textQuery: query,
        maxResultCount: 5,
      };
      if (typeof lat === 'number' && typeof lng === 'number' && !Number.isNaN(lat) && !Number.isNaN(lng)) {
        placesBody.locationBias = {
          circle: {
            center: { latitude: lat, longitude: lng },
            radius: 50000.0,
          },
        };
      }

      const placesRes = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': mapsApiKey,
          'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.googleMapsUri,places.id',
        },
        body: JSON.stringify(placesBody),
      });

      const placesData = await placesRes.json();
      if (placesRes.status === 429 || placesData?.error?.status === 'RESOURCE_EXHAUSTED') {
        return res.status(429).json({ error: 'quota_exceeded', code: 'RESOURCE_EXHAUSTED' });
      }

      if (Array.isArray(placesData?.places) && placesData.places.length > 0) {
        const mapsSources = placesData.places
          .filter((p: any) => p.googleMapsUri)
          .map((p: any) => ({
            title: p.displayName?.text || p.formattedAddress || 'Commercial Hub',
            uri: p.googleMapsUri,
            placeId: p.id,
          }));
        return res.json({
          text: `Verified freight, port, and logistics infrastructure near the selected trade hub:`,
          mapsSources,
        });
      }
    } catch (placesErr: any) {
      console.warn('Places searchText fallback failed:', placesErr?.message);
    }
  }

  return res.json({
    text: 'Regional freight terminals, ports, and customs bonded warehouses support commercial B2B shipments along this trade corridor.',
    mapsSources: [],
  });
});

// Vite middleware or static serving
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.resolve(__dirname, 'dist')));
  app.get('*', (_req, res) => {
    res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
  });
} else {
  const { createServer } = await import('vite');
  const react = (await import('@vitejs/plugin-react')).default;
  const tailwindcss = (await import('@tailwindcss/vite')).default;

  const pwaVirtualPlugin = {
    name: 'virtual-pwa-register',
    resolveId(id: string) {
      if (id === 'virtual:pwa-register') {
        return '\0virtual:pwa-register';
      }
      if (id === 'virtual:pwa-register/react') {
        return '\0virtual:pwa-register/react';
      }
      return null;
    },
    load(id: string) {
      if (id === '\0virtual:pwa-register') {
        return `
          export function registerSW(options = {}) {
            if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
              window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js')
                  .then((reg) => {
                    if (options.onOfflineReady) options.onOfflineReady();
                  })
                  .catch(() => {});
              });
            }
            return () => {};
          }
        `;
      }
      if (id === '\0virtual:pwa-register/react') {
        return `
          import { useState } from 'react';
          export function useRegisterSW() {
            const [needRefresh, setNeedRefresh] = useState(false);
            const [offlineReady, setOfflineReady] = useState(false);
            return {
              needRefresh: [needRefresh, setNeedRefresh],
              offlineReady: [offlineReady, setOfflineReady],
              updateServiceWorker: () => Promise.resolve(),
            };
          }
        `;
      }
      return null;
    },
  };

  const vite = await createServer({
    root: path.resolve(__dirname),
    configFile: false,
    plugins: [react(), tailwindcss(), pwaVirtualPlugin],
    resolve: {
      alias: {
        '@': path.resolve(__dirname),
      },
    },
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(supabaseUrl),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(supabaseAnonKey),
      'import.meta.env.VITE_GOOGLE_MAPS_API_KEY': JSON.stringify(mapsApiKey),
    },
    server: {
      middlewareMode: true,
      hmr: false,
    },
    appType: 'spa',
  });
  app.use(vite.middlewares);
}

const PORT = 3000;
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`AfriTrade Trust Server running on http://0.0.0.0:${PORT}`);
});
