// src/pages/api/travel-extras.ts
// GET /api/travel-extras?city=&country=&from=&to=&originIATA=&pax=
// CAMBIOS:
//  - Transport: el LLM SOLO puede sugerir apps de una lista canónica (Uber, Bolt, Cabify, Didi, Indrive,
//    Lyft, Free Now, Grab, Ola, Kakao T, Gett, 99, Yandex Go, Careem). bookUrl SIEMPRE se setea desde
//    el backend con la URL oficial → ya no aparecen aerocity / taxidemadrid hardcodeadas.
//  - Cars: bookUrl ahora apunta a Booking.com Cars (más confiable que rentalcars search-results).
//  - Vuelos LLM: bookUrlAlt sólo cuando hay IATAs; si no, Skyscanner /flights/search (no 404).

import type { NextApiRequest, NextApiResponse } from "next";

const enc = encodeURIComponent;

async function groqJSON<T>(system: string, user: string, schemaHint: string): Promise<T | null> {
  const key = process.env.GROQ_API_KEY;
  if (!key) return null;
  try {
    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        temperature: 0.4,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: `${system}\nResponde SIEMPRE JSON válido con la forma: ${schemaHint}` },
          { role: "user", content: user },
        ],
      }),
    });
    if (!r.ok) return null;
    const j = await r.json();
    const txt = j.choices?.[0]?.message?.content ?? "{}";
    return JSON.parse(txt) as T;
  } catch { return null; }
}

function daysBetween(from: string, to: string) {
  const a = new Date(from).getTime();
  const b = new Date(to).getTime();
  return Math.max(1, Math.round((b - a) / 86400000));
}

function fallbackFlights(originCity: string, originIATA: string | undefined, destCity: string, destIATA: string | undefined) {
  return [{
    source: "metasearch-fallback",
    airline: "Comparar aerolíneas",
    airlineCode: undefined,
    stops: 0,
    estDurationHrs: undefined,
    price: { amount: undefined, currency: "USD", estimated: true },
    notes: `Abre Google Flights o Skyscanner para comparar ${originIATA || originCity || "tu ciudad"} → ${destIATA || destCity}.`,
  }];
}

function fallbackCars(city: string, country: string, from: string, to: string) {
  const days = daysBetween(from, to);
  return [
    { company: "Booking.com Cars", category: "Comparador", exampleModel: "Económico / SUV / Premium", estPricePerDayUSD: 35, pickupHint: `${city}, ${country}` },
    { company: "Kayak Cars", category: "Comparador", exampleModel: "Todas las agencias disponibles", estPricePerDayUSD: 38, pickupHint: `Aeropuerto o centro de ${city}` },
    { company: "Sixt / Hertz / Avis", category: "Agencias internacionales", exampleModel: "Según disponibilidad local", estPricePerDayUSD: 45, pickupHint: `Oficinas principales en ${city}` },
  ].map((c) => ({
    source: "fallback",
    company: c.company,
    category: c.category,
    exampleModel: c.exampleModel,
    pickupHint: c.pickupHint,
    price: { perDay: c.estPricePerDayUSD, total: c.estPricePerDayUSD * days, currency: "USD", estimated: true },
  }));
}

function fallbackTransport(city: string, country: string) {
  return [
    { type: "Mapa / rutas", name: "Google Maps Transit", estPriceUSD: "variable", coverage: "Rutas de transporte público, caminata y taxi", safetyTip: "Confirma horarios el mismo día.", bookUrl: `https://www.google.com/maps/dir/?api=1&travelmode=transit&destination=${enc(`${city}, ${country}`)}` },
    { type: "Ride-hailing", name: "Uber", estPriceUSD: "variable", coverage: "Según disponibilidad local", safetyTip: "Verifica placa y conductor en la app.", bookUrl: "https://m.uber.com/" },
    { type: "Taxi", name: "Taxi oficial", estPriceUSD: "variable", coverage: `Zonas principales de ${city}`, safetyTip: "Usa paradas oficiales o reserva desde hotel/app confiable.", bookUrl: `https://www.google.com/maps/search/${enc(`Taxi oficial ${city} ${country}`)}` },
    { type: "Traslado aeropuerto", name: "Traslado aeropuerto oficial", estPriceUSD: "variable", coverage: `Aeropuerto ↔ ${city}`, safetyTip: "Evita conductores no autorizados dentro del aeropuerto.", bookUrl: `https://www.google.com/search?q=${enc(`traslado aeropuerto oficial ${city} ${country}`)}` },
    { type: "Planificador", name: "Rome2Rio", estPriceUSD: "variable", coverage: "Rutas entre aeropuertos, estaciones y barrios", safetyTip: "Compara duración antes de reservar.", bookUrl: `https://www.rome2rio.com/map/${enc(city)}` },
  ].map((o) => ({ source: "fallback", ...o, rome2rio: `https://www.rome2rio.com/map/${enc(city)}` }));
}

function sanitizeTransportOption(o: any, city: string, country: string) {
  const rawName = String(o.name || "").trim();
  const rawType = String(o.type || "").trim();
  const badName = /aerocity|taxidemadrid|taxi\s*de\s*madrid|taxi.?madrid/i.test(rawName);
  const isAirport = /aerop|airport|express|shuttle|traslado/i.test(`${rawType} ${rawName}`);
  const matched = Object.entries(RIDE_APPS).find(([k]) => k.toLowerCase() === rawName.toLowerCase());
  const name = badName ? (isAirport ? "Traslado aeropuerto oficial" : "Taxi oficial") : rawName;
  const type = rawType || (isAirport ? "Traslado aeropuerto" : "Transporte");
  let bookUrl: string | undefined;

  if (matched && !badName) bookUrl = matched[1].url;
  else if (/metro|bus|tranv|bici|bike|bike-sharing|tren|transporte público|transporte publico/i.test(`${name} ${type}`)) {
    bookUrl = `https://www.google.com/maps/dir/?api=1&travelmode=transit&destination=${enc(`${city}, ${country}`)}`;
  } else if (isAirport) {
    bookUrl = `https://www.google.com/search?q=${enc(`traslado aeropuerto oficial ${city} ${country}`)}`;
  } else if (/taxi/i.test(`${name} ${type}`)) {
    bookUrl = `https://www.google.com/maps/search/${enc(`Taxi oficial ${city} ${country}`)}`;
  } else {
    bookUrl = `https://www.google.com/maps/search/${enc(`${name} ${city} ${country}`)}`;
  }

  return {
    source: "llm-curated",
    type,
    name,
    estPriceUSD: o.estPriceUSD,
    coverage: o.coverage,
    safetyTip: o.safetyTip,
    bookUrl,
    rome2rio: `https://www.rome2rio.com/map/${enc(city)}`,
  };
}

/* --------------------------------- VUELOS --------------------------------- */
async function getAmadeusToken(): Promise<string | null> {
  const id = process.env.AMADEUS_CLIENT_ID;
  const secret = process.env.AMADEUS_CLIENT_SECRET;
  if (!id || !secret) return null;
  try {
    const r = await fetch("https://test.api.amadeus.com/v1/security/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=client_credentials&client_id=${enc(id)}&client_secret=${enc(secret)}`,
    });
    if (!r.ok) return null;
    const j = await r.json();
    return j.access_token ?? null;
  } catch { return null; }
}

async function fetchFlightsAmadeus(originIATA: string, destIATA: string, date: string, pax: number) {
  const token = await getAmadeusToken();
  if (!token || !originIATA || !destIATA) return [];
  const url = `https://test.api.amadeus.com/v2/shopping/flight-offers?originLocationCode=${originIATA}&destinationLocationCode=${destIATA}&departureDate=${date}&adults=${pax}&currencyCode=USD&max=8`;
  try {
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) return [];
    const j = await r.json();
    return (j.data ?? []).map((o: any) => {
      const itin = o.itineraries?.[0];
      const seg = itin?.segments ?? [];
      return {
        source: "amadeus",
        airline: seg[0]?.carrierCode,
        stops: Math.max(0, seg.length - 1),
        depart: seg[0]?.departure?.at,
        arrive: seg[seg.length - 1]?.arrival?.at,
        duration: itin?.duration,
        price: { amount: Number(o.price?.total), currency: o.price?.currency ?? "USD" },
      };
    });
  } catch { return []; }
}

type FlightSuggestion = {
  airline: string; airlineCode?: string; stops: number;
  estDurationHrs: number; estPriceUSD: number; notes?: string;
};

async function fetchFlightsLLM(
  originCity: string, originIATA: string | undefined,
  destCity: string, destCountry: string, destIATA: string | undefined,
  date: string, pax: number,
) {
  const sys = "Eres un agente de viajes experto. Sugiere vuelos realistas (aerolíneas que efectivamente operen esa ruta) y estimaciones de precio actuales en USD para 2026. No inventes aerolíneas.";
  const u = `Vuelos desde ${originCity}${originIATA ? ` (${originIATA})` : ""} hacia ${destCity}, ${destCountry}${destIATA ? ` (${destIATA})` : ""} el ${date} para ${pax} pasajero(s). Devuelve 4-6 opciones realistas.`;
  const data = await groqJSON<{ flights: FlightSuggestion[] }>(
    sys, u,
    `{"flights":[{"airline":"Avianca","airlineCode":"AV","stops":0,"estDurationHrs":1.2,"estPriceUSD":120,"notes":"directo"}]}`,
  );
  const list = data?.flights ?? [];
  if (!list.length) return fallbackFlights(originCity, originIATA, destCity, destIATA);
  return list.map((f) => ({
    source: "llm-curated",
    airline: f.airline, airlineCode: f.airlineCode, stops: f.stops,
    estDurationHrs: f.estDurationHrs,
    price: { amount: f.estPriceUSD, currency: "USD", estimated: true },
    notes: f.notes,
  }));
}

/* ---------------------------------- AUTOS --------------------------------- */
async function fetchCars(city: string, country: string, from: string, to: string) {
  const sys = "Eres un agente de viajes. Recomienda compañías de alquiler de auto que SÍ operen en la ciudad indicada y rangos de precio diarios realistas en USD para 2026.";
  const u = `Alquiler de auto en ${city}, ${country} del ${from} al ${to}. 4-6 opciones de distintas categorías.`;
  const data = await groqJSON<{
    cars: Array<{ company: string; category: string; exampleModel: string; estPricePerDayUSD: number; pickupHint?: string }>;
  }>(
    sys, u,
    `{"cars":[{"company":"Localiza","category":"Económico","exampleModel":"Chevrolet Onix","estPricePerDayUSD":35,"pickupHint":"Aeropuerto"}]}`,
  );
  const list = data?.cars ?? [];
  if (!list.length) return fallbackCars(city, country, from, to);
  const days = daysBetween(from, to);
  return list.map((c) => ({
    source: "llm-curated",
    company: c.company, category: c.category, exampleModel: c.exampleModel, pickupHint: c.pickupHint,
    price: {
      perDay: c.estPricePerDayUSD,
      total: c.estPricePerDayUSD * days,
      currency: "USD", estimated: true,
    },
  }));
}

/* ------------------------------- TRANSPORTE ------------------------------- */
// URLs canónicas oficiales. El LLM solo elige NOMBRES; el bookUrl lo pone el backend.
const RIDE_APPS: Record<string, { url: string; regions: string[] }> = {
  "Uber":        { url: "https://m.uber.com/",            regions: ["global"] },
  "Bolt":        { url: "https://bolt.eu/",               regions: ["EU","Africa","LATAM"] },
  "Cabify":      { url: "https://cabify.com/",            regions: ["ES","PT","LATAM"] },
  "Didi":        { url: "https://web.didiglobal.com/",    regions: ["LATAM","Asia"] },
  "InDrive":     { url: "https://indrive.com/",           regions: ["global"] },
  "Lyft":        { url: "https://www.lyft.com/",          regions: ["US","CA"] },
  "Free Now":    { url: "https://free-now.com/",          regions: ["EU"] },
  "Grab":        { url: "https://www.grab.com/",          regions: ["SEA"] },
  "Ola":         { url: "https://www.olacabs.com/",       regions: ["IN","UK","AU"] },
  "Kakao T":     { url: "https://kakaot.kakao.com/",      regions: ["KR"] },
  "Gett":        { url: "https://gett.com/",              regions: ["UK","IL","RU"] },
  "99":          { url: "https://99app.com/",             regions: ["BR"] },
  "Yandex Go":   { url: "https://yandex.com/maps/",       regions: ["RU","CIS"] },
  "Careem":      { url: "https://www.careem.com/",        regions: ["MENA"] },
};
const ALLOWED_RIDE_NAMES = Object.keys(RIDE_APPS).join(", ");

async function fetchTransport(city: string, country: string) {
  const sys = `Eres un experto local. Lista las formas REALES de moverse dentro de la ciudad indicada.
Para "Ride-hailing" SOLO puedes elegir nombres EXACTOS de esta lista: ${ALLOWED_RIDE_NAMES}.
No inventes apps locales (NADA de aerocity, taxidemadrid, taxiparis, etc.).
Otras categorías permitidas: "Transporte público" (metro, BRT, bus, tranvía con su nombre real),
"Taxi" (taxi oficial de la ciudad), "Traslado aeropuerto" (servicio express oficial),
"Caminar/Bici" (sistemas de bike-sharing oficiales: Bicimad, Vélib, Citi Bike, Santander, etc.).`;
  const u = `Transporte local en ${city}, ${country}. Devuelve 5-7 opciones que SÍ operen ahí HOY.`;
  const data = await groqJSON<{
    options: Array<{
      type: string; name: string; estPriceUSD?: string; coverage?: string; safetyTip?: string;
    }>;
  }>(
    sys, u,
    `{"options":[{"type":"Ride-hailing","name":"Uber","estPriceUSD":"2-8","coverage":"Toda la ciudad","safetyTip":"Verifica placa"}]}`,
  );
  const options = (data?.options ?? []).map((o) => sanitizeTransportOption(o, city, country));
  const fallback = fallbackTransport(city, country);
  const seen = new Set<string>();
  return [...options, ...fallback].filter((o) => {
    const k = `${o.type}-${o.name}`.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).slice(0, 7);
}

/* ---------------------------------- TOURS --------------------------------- */
async function fetchGeoapifyPOIs(city: string, country: string) {
  const key = process.env.GEOAPIFY_API_KEY;
  if (!key) return [];
  try {
    const g = await fetch(`https://api.geoapify.com/v1/geocode/search?text=${enc(`${city}, ${country}`)}&limit=1&apiKey=${key}`);
    const gj = await g.json();
    const f = gj.features?.[0];
    if (!f) return [];
    const [lon, lat] = f.geometry.coordinates;
    const p = await fetch(`https://api.geoapify.com/v2/places?categories=tourism.sights,entertainment,leisure&filter=circle:${lon},${lat},15000&limit=20&apiKey=${key}`);
    const pj = await p.json();
    return (pj.features ?? []).map((x: any) => ({
      name: x.properties.name, category: x.properties.categories?.[0],
      address: x.properties.formatted, lat: x.properties.lat, lon: x.properties.lon,
    })).filter((x: any) => x.name);
  } catch { return []; }
}

async function fetchTours(city: string, country: string, from: string, to: string) {
  const pois = await fetchGeoapifyPOIs(city, country);
  const sys = "Eres un curador de experiencias locales. Recomienda tours TRADICIONALES e ICÓNICAS del destino. Usa los POIs reales si te los doy.";
  const u = `Tours y experiencias en ${city}, ${country} entre ${from} y ${to}. POIs reales: ${JSON.stringify(pois.slice(0, 12).map((p: any) => p.name))}. 6-8 experiencias variadas.`;
  const data = await groqJSON<{
    tours: Array<{ title: string; category: string; durationHrs: number; estPriceUSD: number; whyIconic: string; bestTimeOfDay?: string }>;
  }>(
    sys, u,
    `{"tours":[{"title":"Show Delirio","category":"Nocturno tradicional","durationHrs":4,"estPriceUSD":60,"whyIconic":"Ícono de la salsa caleña","bestTimeOfDay":"noche"}]}`,
  );
  const list = data?.tours ?? [];
  const fallback = [
    { title: `Tours icónicos en ${city}`, category: "Cultura", durationHrs: 3, estPriceUSD: 30, whyIconic: `Experiencias y visitas guiadas disponibles en ${city}.`, bestTimeOfDay: "mañana" },
    { title: `Free walking tour ${city}`, category: "Walking tour", durationHrs: 2, estPriceUSD: 0, whyIconic: "Buena primera orientación por los sectores principales.", bestTimeOfDay: "mañana" },
    { title: `Gastronomía local en ${city}`, category: "Gastronomía", durationHrs: 3, estPriceUSD: 45, whyIconic: "Permite probar platos representativos con guía local.", bestTimeOfDay: "tarde" },
  ];
  return (list.length ? list : fallback).map((t) => ({
    source: list.length ? "llm-curated" : "fallback", ...t,
    price: { amount: t.estPriceUSD, currency: "USD", estimated: true },
    bookUrl: `https://www.getyourguide.com/s/?q=${enc(`${t.title} ${city}`)}`,
    bookUrlAlt: `https://www.viator.com/searchResults/all?text=${enc(`${t.title} ${city}`)}`,
  }));
}

/* ---------------------------------- handler ------------------------------- */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const city = String(req.query.city ?? "").trim();
    const country = String(req.query.country ?? "").trim();
    const from = String(req.query.from ?? "").trim();
    const to = String(req.query.to ?? "").trim();
    const originCity = String(req.query.originCity ?? "").trim();
    const originIATA = String(req.query.originIATA ?? "").trim() || undefined;
    const destIATA = String(req.query.destIATA ?? "").trim() || undefined;
    const pax = Math.max(1, Number(req.query.pax ?? 1));

    if (!city || !country || !from || !to) {
      return res.status(400).json({ error: "city, country, from, to are required" });
    }

    const [amadeusFlights, llmFlights, cars, transport, tours] = await Promise.all([
      originIATA && destIATA ? fetchFlightsAmadeus(originIATA, destIATA, from, pax) : Promise.resolve([]),
      fetchFlightsLLM(originCity || "tu ciudad", originIATA, city, country, destIATA, from, pax),
      fetchCars(city, country, from, to),
      fetchTransport(city, country),
      fetchTours(city, country, from, to),
    ]);

    const seen = new Set<string>();
    const flights = [...amadeusFlights, ...llmFlights].filter((f: any) => {
      const k = `${f.airline}-${f.stops}`;
      if (seen.has(k)) return false;
      seen.add(k); return true;
    });

    res.setHeader("Cache-Control", "public, s-maxage=900, stale-while-revalidate=3600");
    return res.status(200).json({
      meta: {
        sources: {
          flights: amadeusFlights.length ? "amadeus+llm" : "llm",
          cars: "llm", transport: "llm-curated+canonical", tours: "geoapify+llm",
        },
        counts: { flights: flights.length, cars: cars.length, transport: transport.length, tours: tours.length },
      },
      flights, cars, transport, tours,
    });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message ?? "unknown error" });
  }
}
