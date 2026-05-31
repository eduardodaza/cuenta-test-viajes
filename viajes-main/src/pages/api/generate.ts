// src/pages/api/generate.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { buildItineraryPrompt } from "@/lib/prompt";
import type { TripFormData, ItineraryData, Hotel, Event } from "@/lib/types";

// ── Helpers ───────────────────────────────────────────────────
function extractJSON(text: string): string {
  let s = text.replace(/```json/g, "").replace(/```/g, "").trim();
  const a = s.indexOf("{"), b = s.lastIndexOf("}");
  if (a > -1 && b > a) s = s.substring(a, b + 1);
  return s;
}

function extractJSONArray(text: string): string {
  let s = text.replace(/```json/g, "").replace(/```/g, "").trim();
  const a = s.indexOf("["), b = s.lastIndexOf("]");
  if (a > -1 && b > a) s = s.substring(a, b + 1);
  return s;
}

// ── Hotel deep-links ──────────────────────────────────────────
function buildHotelLinks(form: TripFormData): Hotel[] {
  const cityCountry = `${form.city}, ${form.country}`;
  const q = encodeURIComponent(cityCountry);
  const cityEnc = encodeURIComponent(form.city);
  const cin = form.startDate, cout = form.endDate;
  const adults = Math.max(1, Number(form.travelers) || 1);
  const base = { stars: 0, reviewScore: 0, reviewCount: 0, pricePerNight: "Ver precios", currency: "", address: cityCountry };
  return [
    { ...base, name: `Hoteles en ${form.city} — Booking.com`, platform: "Booking.com",
      url: `https://www.booking.com/searchresults.html?ss=${q}&checkin=${cin}&checkout=${cout}&group_adults=${adults}&no_rooms=1&group_children=0&selected_currency=USD` },
    { ...base, name: `Hoteles en ${form.city} — Hotels.com`, platform: "Hotels.com",
      url: `https://www.hotels.com/Hotel-Search?destination=${q}&startDate=${cin}&endDate=${cout}&rooms=1&adults=${adults}` },
    { ...base, name: `Hoteles en ${form.city} — Expedia`, platform: "Expedia",
      url: `https://www.expedia.com/Hotel-Search?destination=${q}&startDate=${cin}&endDate=${cout}&rooms=1&adults=${adults}` },
    { ...base, name: `Hoteles en ${form.city} — Airbnb`, platform: "Airbnb",
      url: `https://www.airbnb.com/s/${cityEnc}/homes?checkin=${cin}&checkout=${cout}&adults=${adults}` },
    { ...base, name: `Hoteles en ${form.city} — Trivago`, platform: "Trivago",
      url: `https://www.trivago.com/en-US/srl?search=200-${cityEnc}&aDateRange%5Barr%5D=${cin}&aDateRange%5Bdep%5D=${cout}&aRooms%5B0%5D%5Badults%5D=${adults}` },
    { ...base, name: `Hoteles en ${form.city} — Kayak`, platform: "Kayak",
      url: `https://www.kayak.com/hotels/${cityEnc}/${cin}/${cout}/${adults}adults` },
  ];
}

// ── Groq ──────────────────────────────────────────────────────
async function callGroq(prompt: string, maxTokens: number, temperature = 0.7): Promise<string> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.GROQ_API_KEY}` },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      max_tokens: maxTokens, temperature,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Groq error ${res.status}: ${JSON.stringify(err)}`);
  }
  const data = await res.json();
  const text: string = data?.choices?.[0]?.message?.content ?? "";
  if (!text) throw new Error("Empty Groq response");
  return text;
}

// ── Groq: traditional / recurring / cultural events ───────────
// Uses LLM knowledge to surface festivals, fairs, carnivals AND iconic
// recurring shows / nightlife / cultural traditions for the trip window.
// This is what fixes Cali (Feria de Cali, Delirio, El Mulato) and
// Medellín (Feria de las Flores, Comuna 13 tour, etc.) when APIs return nothing.
async function fetchTraditionalEvents(form: TripFormData): Promise<Event[]> {
  const sd = new Date(form.startDate + "T12:00:00");
  const ed = new Date(form.endDate + "T12:00:00");
  const startMonth = sd.toLocaleString("en", { month: "long" });
  const prompt = `You are a local cultural expert for ${form.city}, ${form.country}.
List the TOP local events, festivals, fairs, carnivals, sports finals AND
iconic recurring shows / nightlife / cultural traditions that a tourist
visiting ${form.city} between ${form.startDate} and ${form.endDate} (${startMonth})
should not miss.

INCLUDE:
- Annual traditional festivals that historically happen in this window
  (e.g. Feria de Cali Dec 25–30; Feria de las Flores early Aug in Medellín;
   Carnaval de Barranquilla Feb/Mar; Oktoberfest Munich Sep/Oct;
   Songkran Thailand Apr; Diwali India Oct/Nov; etc.).
- Iconic recurring shows / nightlife / cultural experiences that run
  year-round and are CAN'T-MISS for any visitor to ${form.city}
  (e.g. Delirio show in Cali on selected Fridays; El Mulato Cabaret;
   Tin Tin Deo salsa; Zaperoco; Comuna 13 graffiti tour in Medellín;
   tango shows in Buenos Aires; sumo in Tokyo, etc.).
- Major sport events (football derbies, classics) if any in the dates.
- Local markets, religious processions, popular fairs in those dates.

Return ONLY a JSON array (no markdown, no commentary). Each element:
{
  "name": "real event/show/festival name",
  "type": "festival" | "concert" | "permanent" | "sport" | "market",
  "when": "YYYY-MM-DD inside ${form.startDate}..${form.endDate} OR a recurrence like 'every Friday' / 'Dec 25-30 every year'",
  "description": "1-2 sentence why-it-matters + what to expect",
  "price": "Free / $ / $$ / $$$ or 'See website'",
  "venue": "real venue or neighborhood in ${form.city}",
  "source": "local tradition / official festival"
}

Aim for 5 to 10 entries. If a destination genuinely has no special tradition in this window, still return the best ICONIC recurring shows/nightlife (do not return an empty array unless ${form.city} has truly nothing).`;

  try {
    const raw = await callGroq(prompt, 2500, 0.5);
    const arr = JSON.parse(extractJSONArray(raw));
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((e: unknown) => e && typeof e === "object" && (e as { name?: string }).name)
      .map((e: Record<string, unknown>) => ({
        name: String(e.name),
        type: (["festival", "concert", "permanent", "sport", "market", "cinema"].includes(String(e.type))
          ? String(e.type) : "festival") as Event["type"],
        when: String(e.when ?? form.startDate),
        description: String(e.description ?? ""),
        price: String(e.price ?? "See website"),
        venue: String(e.venue ?? ""),
        source: String(e.source ?? "Local tradition"),
      }))
      .slice(0, 12);
  } catch (err) {
    console.error("[traditional events] error:", err);
    return [];
  }
}

// ── Wikidata ──────────────────────────────────────────────────
async function fetchWikidataAttractions(city: string): Promise<{ name: string; description: string }[]> {
  try {
    const sparql = `SELECT DISTINCT ?placeLabel ?desc WHERE {
      { ?place wdt:P131 ?loc . ?loc rdfs:label "${city}"@en . }
      UNION { ?place wdt:P131 ?loc . ?loc rdfs:label "${city}"@es . }
      ?place wdt:P31 ?type .
      VALUES ?type { wd:Q570116 wd:Q33506 wd:Q4989906 wd:Q23413 wd:Q839954 }
      OPTIONAL { ?place schema:description ?desc . FILTER(LANG(?desc)="en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en,es" }
    } LIMIT 8`;
    const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(sparql)}&format=json`;
    const res = await fetch(url, { headers: { "Accept": "application/json", "User-Agent": "TripCraftAI/1.0" } });
    if (!res.ok) return [];
    const data = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data?.results?.bindings ?? []).map((b: any) => ({
      name: b.placeLabel?.value ?? "", description: b.desc?.value ?? "",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    })).filter((p: any) => p.name && !p.name.startsWith("Q"));
  } catch { return []; }
}

// ── OpenWeather ───────────────────────────────────────────────
async function fetchWeather(city: string, country: string) {
  const key = process.env.OPENWEATHER_API_KEY;
  if (!key) return null;
  try {
    const geoRes = await fetch(`https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(city + "," + country)}&limit=1&appid=${key}`);
    const geo = await geoRes.json();
    if (!geo?.[0]) return null;
    const { lat, lon } = geo[0];
    const wxRes = await fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${key}&units=metric&cnt=7`);
    const wx = await wxRes.json();
    const item = wx?.list?.[0];
    if (!item) return null;
    return { maxTemp: Math.round(item.main.temp_max), minTemp: Math.round(item.main.temp_min), description: item.weather?.[0]?.description ?? "" };
  } catch { return null; }
}

// ── Ticketmaster ──────────────────────────────────────────────
async function fetchTicketmaster(city: string, startDate: string, endDate: string): Promise<Event[]> {
  const key = process.env.TICKETMASTER_API_KEY;
  if (!key) return [];
  try {
    const res = await fetch(`https://app.ticketmaster.com/discovery/v2/events.json?city=${encodeURIComponent(city)}&startDateTime=${startDate}T00:00:00Z&endDateTime=${endDate}T23:59:59Z&size=20&sort=date,asc&apikey=${key}`);
    if (!res.ok) return [];
    const data = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data?._embedded?.events ?? []).map((ev: any) => {
      const segment = ev.classifications?.[0]?.segment?.name ?? "";
      let type: Event["type"] = "festival";
      if (segment === "Music")  type = "concert";
      if (segment === "Sports") type = "sport";
      if (segment === "Arts & Theatre") type = "concert";
      return {
        name: ev.name ?? "", type,
        when: ev.dates?.start?.localDate ?? startDate,
        description: ev.info ?? ev.pleaseNote ?? `${segment} event in ${city}`,
        price: ev.priceRanges?.[0]?.min ? `From $${ev.priceRanges[0].min}` : "See website",
        venue: ev._embedded?.venues?.[0]?.name ?? "",
        ticketUrl: ev.url ?? "", source: "Ticketmaster",
      } as Event;
    });
  } catch { return []; }
}

// ── Eventbrite ────────────────────────────────────────────────
// NOTE: Eventbrite shut down public search in 2020; the free token now only
// returns events owned by your account. We try anyway in case the user has
// an org account, but failures are silent.
async function fetchEventbrite(city: string, startDate: string, endDate: string): Promise<Event[]> {
  const token = process.env.EVENTBRITE_API_KEY;
  if (!token) return [];
  try {
    const url = `https://www.eventbriteapi.com/v3/events/search/?location.address=${encodeURIComponent(city)}&start_date.range_start=${startDate}T00:00:00&start_date.range_end=${endDate}T23:59:59&expand=venue`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return [];
    const data = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data?.events ?? []).slice(0, 15).map((ev: any) => ({
      name: ev.name?.text ?? "",
      type: "festival" as Event["type"],
      when: (ev.start?.local ?? startDate).split("T")[0],
      description: (ev.description?.text ?? "").slice(0, 200),
      price: ev.is_free ? "Free" : "See website",
      venue: ev.venue?.name ?? ev.venue?.address?.localized_address_display ?? "",
      ticketUrl: ev.url ?? "",
      source: "Eventbrite",
    }));
  } catch { return []; }
}

// ── RapidAPI — Google Events (real-time) ──────────────────────
async function fetchRapidEvents(city: string, country: string, startDate: string, endDate: string): Promise<Event[]> {
  const key = process.env.RAPIDAPI_KEY;
  if (!key) return [];
  try {
    const query = encodeURIComponent(`events in ${city} ${country}`);
    const days = Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000);
    const dateParam = days <= 1 ? "today" : days <= 7 ? "week" : "month";
    const res = await fetch(
      `https://real-time-events-search.p.rapidapi.com/search-events?query=${query}&date=${dateParam}&is_virtual=false&start=0`,
      { headers: { "x-rapidapi-key": key, "x-rapidapi-host": "real-time-events-search.p.rapidapi.com" } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const start = new Date(startDate).getTime();
    const end   = new Date(endDate).getTime() + 24 * 3600 * 1000;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data?.data ?? []).map((ev: any) => {
      const iso = ev.start_time ?? ev.start_time_utc ?? "";
      const when = iso ? iso.split("T")[0] : startDate;
      const ts = iso ? new Date(iso).getTime() : NaN;
      const tags: string[] = (ev.tags ?? []).map((x: string) => x.toLowerCase());
      let type: Event["type"] = "festival";
      if (tags.some(t => t.includes("concert") || t.includes("music"))) type = "concert";
      else if (tags.some(t => t.includes("sport") || t.includes("game"))) type = "sport";
      else if (tags.some(t => t.includes("fair")  || t.includes("festival"))) type = "festival";
      return {
        name: ev.name ?? "", type, when,
        description: (ev.description ?? "").slice(0, 200),
        price: ev.ticket_links?.length ? "See website" : "Free / See website",
        venue: ev.venue?.name ?? ev.venue?.full_address ?? "",
        ticketUrl: ev.link ?? ev.ticket_links?.[0]?.link ?? "",
        source: "Google Events",
        _ts: ts,
      } as Event & { _ts: number };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }).filter((ev: any) => ev.name && (!ev._ts || isNaN(ev._ts) || (ev._ts >= start && ev._ts <= end)))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map(({ _ts, ...rest }: any) => rest)
      .slice(0, 15);
  } catch { return []; }
}

// ── Cache eventos ─────────────────────────────────────────────
type EventsCacheEntry = { ts: number; events: Event[] };
const EVENTS_CACHE: Map<string, EventsCacheEntry> =
  (global as unknown as { __eventsCache?: Map<string, EventsCacheEntry> }).__eventsCache ?? new Map();
(global as unknown as { __eventsCache?: Map<string, EventsCacheEntry> }).__eventsCache = EVENTS_CACHE;
const EVENTS_TTL_MS = 24 * 60 * 60 * 1000;
const cacheKey = (c: string, co: string, s: string, e: string) =>
  `${c}|${co}|${s}|${e}`.toLowerCase();

// ── Google Places ─────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function enrichRestaurantData(restaurants: any[], city: string) {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return;
  try {
    for (const resto of restaurants.slice(0, 12)) {
      const res = await fetch(`https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(resto.name + " " + city)}&key=${key}`);
      const data = await res.json();
      const place = data?.results?.[0];
      if (place) {
        if (place.rating)            resto.rating  = String(place.rating);
        if (place.formatted_address) resto.address = place.formatted_address;
        if (place.place_id)          resto.placeId = place.place_id;
        if (place.user_ratings_total) resto.reviewsCount = place.user_ratings_total;
      }
      if (place?.place_id) {
        const det = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=website,url,international_phone_number&key=${key}`);
        const dj = await det.json();
        if (dj?.result?.website) resto.website = dj.result.website;
        if (dj?.result?.url)     resto.googleMapsUrl = dj.result.url;
      }
    }
  } catch { /* silent */ }
}

// ── Geoapify (alternatives only — NUNCA pushear como item nuevo) ─
// Para evitar duplicar el slot "10:00" en el Día 1 con POIs sueltos,
// los POIs de Geoapify se inyectan SOLO como alternativas en items
// existentes de tipo "sight" del primer día.
async function enrichWithGeoapify(itinerary: ItineraryData, form: TripFormData) {
  const key = process.env.GEOAPIFY_API_KEY;
  if (!key) return;
  try {
    const geoRes = await fetch(`https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(form.city + ", " + form.country)}&limit=1&apiKey=${key}`);
    const geoData = await geoRes.json();
    const coords = geoData?.features?.[0]?.geometry?.coordinates;
    if (!coords) return;
    const [lon, lat] = coords;
    const poiRes = await fetch(`https://api.geoapify.com/v2/places?categories=tourism.attraction,tourism.sights,entertainment.museum&filter=circle:${lon},${lat},6000&limit=12&apiKey=${key}`);
    const poiData = await poiRes.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pois = ((poiData?.features ?? []) as any[])
      .map((p) => ({
        name: p?.properties?.name as string,
        cat: (p?.properties?.categories?.[0] as string) ?? "Attraction",
        website: p?.properties?.website as string | undefined,
      }))
      .filter((p) => p.name);
    if (!pois.length) return;

    // Set de nombres ya usados en TODO el itinerario para no repetir.
    const used = new Set<string>();
    for (const d of itinerary.days ?? []) {
      for (const it of d.items ?? []) {
        used.add(it.name.toLowerCase());
        for (const a of it.alternatives ?? []) used.add(a.name.toLowerCase());
      }
    }

    // Inyecta como alternativas en items "sight" del día 1, 2 y 3 (si existen)
    for (const day of (itinerary.days ?? []).slice(0, 3)) {
      const sightItems = (day.items ?? []).filter((i) => i.type === "sight" || i.type === "event");
      for (const item of sightItems) {
        item.alternatives = item.alternatives ?? [];
        if (item.alternatives.length >= 3) continue;
        for (const p of pois) {
          if (used.has(p.name.toLowerCase())) continue;
          if (item.alternatives.length >= 3) break;
          item.alternatives.push({
            name: p.name,
            description: `${p.cat} in ${form.city}.`,
            type: "sight",
            duration: "1h",
            transport: "walking",
            transportTime: "varies",
            price: item.price ?? "$$",
            rating: "",
            tip: p.website ? `Visit: ${p.website}` : "",
          });
          used.add(p.name.toLowerCase());
        }
      }
    }
  } catch { /* silent */ }
}

// ── Normalización horaria por día ─────────────────────────────
// 1) Convierte cualquier "HH:MM" raro a minutos.
// 2) Si hay items con la MISMA hora, los espacia hacia adelante.
// 3) Garantiza orden ascendente y mantiene todo dentro de [dayStart, dayEnd].
function timeToMin(t: string): number {
  const m = /^(\d{1,2}):(\d{2})/.exec(t || "");
  if (!m) return 0;
  return Math.min(23 * 60 + 59, Math.max(0, parseInt(m[1], 10) * 60 + parseInt(m[2], 10)));
}
function minToTime(min: number): string {
  const h = Math.floor(min / 60), m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
function normalizeDayTimes(itinerary: ItineraryData, dayStart: string, dayEnd: string) {
  const start = timeToMin(dayStart || "08:00");
  const end   = timeToMin(dayEnd   || "23:00");
  for (const day of itinerary.days ?? []) {
    if (!day.items?.length) continue;
    // Orden por hora original
    day.items.sort((a, b) => timeToMin(a.time) - timeToMin(b.time));
    let prev = -1;
    for (let i = 0; i < day.items.length; i++) {
      let t = timeToMin(day.items[i].time);
      if (t < start) t = start;
      if (t > end)   t = end;
      // Evitar empate o retroceso: separar al menos 30 min
      if (t <= prev) t = Math.min(end, prev + 90);
      day.items[i].time = minToTime(t);
      prev = t;
    }
  }
}

// ── Main handler ──────────────────────────────────────────────
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const form: TripFormData = req.body;
  if (!form.city || !form.country || !form.startDate || !form.endDate) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  // Default to "on" so traditional + real-time events are ALWAYS fetched.
  // Override with EVENTS_MODE=off (skip RapidAPI) or cache-only (read cache only) if needed.
  const EVENTS_MODE = (process.env.EVENTS_MODE ?? "on").toLowerCase();

  try {
    // 1. Groq — core itinerary
    const prompt = buildItineraryPrompt(form);
    const rawText = await callGroq(prompt, 8000);
    const jsonStr = extractJSON(rawText);
    let itinerary: ItineraryData;
    try { itinerary = JSON.parse(jsonStr); }
    catch {
      const fixText = await callGroq(`Fix this JSON and return ONLY valid JSON, no explanation:\n\n${jsonStr}`, 8000, 0.2);
      itinerary = JSON.parse(extractJSON(fixText));
    }
    itinerary.events      = itinerary.events      ?? [];
    itinerary.alerts      = itinerary.alerts      ?? [];
    itinerary.restaurants = itinerary.restaurants ?? [];

    // 2. Hotels
    itinerary.hotels = buildHotelLinks(form);

    // 3. Paralelo: Wikidata + Weather + Ticketmaster + Eventbrite + Traditional(Groq)
    const [wikidataRes, weatherRes, tmRes, ebRes, tradRes] = await Promise.allSettled([
      fetchWikidataAttractions(form.city),
      fetchWeather(form.city, form.country),
      fetchTicketmaster(form.city, form.startDate, form.endDate),
      fetchEventbrite(form.city, form.startDate, form.endDate),
      fetchTraditionalEvents(form),
    ]);

    if (wikidataRes.status === "fulfilled") {
      const wdPlaces = wikidataRes.value;
      for (const day of itinerary.days ?? []) {
        for (const item of day.items ?? []) {
          if (item.type !== "sight") continue;
          const match = wdPlaces.find(
            p => p.name.toLowerCase().includes(item.name.toLowerCase().split(" ")[0])
              || item.name.toLowerCase().includes(p.name.toLowerCase().split(" ")[0])
          );
          if (match?.description && match.description.length > 20) item.wikidataDescription = match.description;
        }
      }
    }

    if (weatherRes.status === "fulfilled" && weatherRes.value) {
      itinerary.weather = { ...itinerary.weather, ...weatherRes.value };
    }

    const tmEvents    = tmRes.status === "fulfilled" ? tmRes.value : [];
    const ebEvents    = ebRes.status === "fulfilled" ? ebRes.value : [];
    const tradEvents  = tradRes.status === "fulfilled" ? tradRes.value : [];

    // 4. RapidAPI — controlado por EVENTS_MODE y cache
    const ckey = cacheKey(form.city, form.country, form.startDate, form.endDate);
    const cached = EVENTS_CACHE.get(ckey);
    const cacheValid = cached && (Date.now() - cached.ts) < EVENTS_TTL_MS;

    let rapidEvents: Event[] = [];
    const sources: string[] = [];
    if (cacheValid) {
      rapidEvents = cached!.events;
      sources.push("rapidapi-cache");
    } else if (EVENTS_MODE === "off" || EVENTS_MODE === "cache-only") {
      // no llamada
    } else {
      rapidEvents = await fetchRapidEvents(form.city, form.country, form.startDate, form.endDate);
      EVENTS_CACHE.set(ckey, { ts: Date.now(), events: rapidEvents });
      if (rapidEvents.length) sources.push("rapidapi");
    }

    // 5. Merge + dedupe (case-insensitive por nombre normalizado)
    const seen = new Set(itinerary.events.map(e => e.name.toLowerCase().trim()));
    const pushEvents = (arr: Event[], label: string) => {
      let added = 0;
      for (const ev of arr) {
        const k = (ev?.name ?? "").toLowerCase().trim();
        if (!k || seen.has(k)) continue;
        itinerary.events.push(ev);
        seen.add(k);
        added++;
      }
      if (added) sources.push(`${label}(${added})`);
    };
    pushEvents(tradEvents, "tradition");
    pushEvents(tmEvents, "ticketmaster");
    pushEvents(ebEvents, "eventbrite");
    pushEvents(rapidEvents, "google-events");
    itinerary.events.sort((a, b) => (a.when ?? "").localeCompare(b.when ?? ""));

    // 6. Restaurantes + Geoapify
    await enrichRestaurantData(itinerary.restaurants as unknown[], form.city);
    await enrichWithGeoapify(itinerary, form);

    // 7. Normalizar horas: únicas, ascendentes, dentro de la ventana del cliente
    normalizeDayTimes(itinerary, form.dayStartTime || "08:00", form.dayEndTime || "23:00");

    itinerary.generatedBy = `Groq LLaMA 3.3 70B · ${sources.length ? sources.join(" · ") : "no external events"} · Wikidata`;

    return res.status(200).json(itinerary);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[generate] Error:", message);
    return res.status(500).json({ error: "Failed to generate itinerary", detail: message });
  }
}

export const config = { api: { responseLimit: "10mb" } };
