// src/pages/api/generate.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { buildItineraryPrompt } from "@/lib/prompt";
import type { TripFormData, ItineraryData, Hotel } from "@/lib/types";

// ── Helpers ───────────────────────────────────────────────────

function extractJSON(text: string): string {
  let s = text.replace(/```json/g, "").replace(/```/g, "").trim();
  const a = s.indexOf("{"), b = s.lastIndexOf("}");
  if (a > -1 && b > a) s = s.substring(a, b + 1);
  return s;
}

// ── Hotel links — deep-links con ciudad + fechas + huéspedes ──
// Todas las plataformas abren YA con los datos pre-cargados.

function buildHotelLinks(form: TripFormData): Hotel[] {
  const cityCountry = `${form.city}, ${form.country}`;
  const q       = encodeURIComponent(cityCountry);
  const cityEnc = encodeURIComponent(form.city);
  const cin     = form.startDate;             // YYYY-MM-DD
  const cout    = form.endDate;               // YYYY-MM-DD
  const adults  = Math.max(1, Number(form.travelers) || 1);

  const base = {
    stars: 0, reviewScore: 0, reviewCount: 0,
    pricePerNight: "Ver precios", currency: "",
    address: cityCountry,
  };

  return [
    {
      ...base,
      name: `Hoteles en ${form.city} — Booking.com`,
      platform: "Booking.com",
      url: `https://www.booking.com/searchresults.html?ss=${q}&checkin=${cin}&checkout=${cout}&group_adults=${adults}&no_rooms=1&group_children=0&selected_currency=USD`,
    },
    {
      ...base,
      name: `Hoteles en ${form.city} — Hotels.com`,
      platform: "Hotels.com",
      url: `https://www.hotels.com/Hotel-Search?destination=${q}&startDate=${cin}&endDate=${cout}&rooms=1&adults=${adults}`,
    },
    {
      ...base,
      name: `Hoteles en ${form.city} — Expedia`,
      platform: "Expedia",
      url: `https://www.expedia.com/Hotel-Search?destination=${q}&startDate=${cin}&endDate=${cout}&rooms=1&adults=${adults}`,
    },
    {
      ...base,
      name: `Hoteles en ${form.city} — Airbnb`,
      platform: "Airbnb",
      url: `https://www.airbnb.com/s/${cityEnc}/homes?checkin=${cin}&checkout=${cout}&adults=${adults}`,
    },
    {
      ...base,
      name: `Hoteles en ${form.city} — Trivago`,
      platform: "Trivago",
      // Trivago acepta fechas/huéspedes en query — usa el buscador estándar
      url: `https://www.trivago.com/en-US/srl?search=200-${cityEnc}&aDateRange%5Barr%5D=${cin}&aDateRange%5Bdep%5D=${cout}&aRooms%5B0%5D%5Badults%5D=${adults}`,
    },
    {
      ...base,
      name: `Hoteles en ${form.city} — Kayak`,
      platform: "Kayak",
      url: `https://www.kayak.com/hotels/${cityEnc}/${cin}/${cout}/${adults}adults`,
    },
  ];
}

// ── Groq ──────────────────────────────────────────────────────

async function callGroq(prompt: string, maxTokens: number): Promise<string> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      max_tokens: maxTokens,
      temperature: 0.7,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Groq error ${res.status}: ${JSON.stringify(err)}`);
  }
  const data = await res.json();
  const text: string = data?.choices?.[0]?.message?.content ?? "";
  if (!text) throw new Error(`Empty Groq response`);
  return text;
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
      name: b.placeLabel?.value ?? "",
      description: b.desc?.value ?? "",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    })).filter((p: any) => p.name && !p.name.startsWith("Q"));
  } catch { return []; }
}

// ── OpenWeather ───────────────────────────────────────────────

async function fetchWeather(city: string, country: string) {
  const key = process.env.OPENWEATHER_API_KEY;
  if (!key) return null;
  try {
    const geoRes = await fetch(
      `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(city + "," + country)}&limit=1&appid=${key}`
    );
    const geo = await geoRes.json();
    if (!geo?.[0]) return null;
    const { lat, lon } = geo[0];
    const wxRes = await fetch(
      `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${key}&units=metric&cnt=7`
    );
    const wx = await wxRes.json();
    const item = wx?.list?.[0];
    if (!item) return null;
    return {
      maxTemp:     Math.round(item.main.temp_max),
      minTemp:     Math.round(item.main.temp_min),
      description: item.weather?.[0]?.description ?? "",
    };
  } catch { return null; }
}

// ── Ticketmaster (conciertos, deportes, festivales) ───────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchTicketmaster(city: string, startDate: string, endDate: string): Promise<any[]> {
  const key = process.env.TICKETMASTER_API_KEY;
  if (!key) return [];
  try {
    const res = await fetch(
      `https://app.ticketmaster.com/discovery/v2/events.json?city=${encodeURIComponent(city)}&startDateTime=${startDate}T00:00:00Z&endDateTime=${endDate}T23:59:59Z&size=20&sort=date,asc&apikey=${key}`
    );
    const data = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data?._embedded?.events ?? []).map((ev: any) => {
      const segment = ev.classifications?.[0]?.segment?.name ?? "";
      let type: string = "festival";
      if (segment === "Music")  type = "concert";
      if (segment === "Sports") type = "sport";
      if (segment === "Arts & Theatre") type = "show";
      return {
        name:        ev.name ?? "",
        type,
        when:        ev.dates?.start?.localDate ?? startDate,
        description: ev.info ?? ev.pleaseNote ?? `${segment} event in ${city}`,
        price:       ev.priceRanges?.[0]?.min ? `From $${ev.priceRanges[0].min}` : "See website",
        venue:       ev._embedded?.venues?.[0]?.name ?? "",
        ticketUrl:   ev.url ?? "",
        source:      "Ticketmaster",
      };
    });
  } catch { return []; }
}

// ── RapidAPI: Real-Time Events Search (Google Events) ─────────
// Fuente gratuita amplia: conciertos, ferias, partidos, eventos locales
// scrapeados desde Google Events. Tier free en RapidAPI.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchRapidEvents(city: string, country: string, startDate: string, endDate: string): Promise<any[]> {
  const key = process.env.RAPIDAPI_KEY;
  if (!key) return [];
  try {
    const query = encodeURIComponent(`events in ${city} ${country}`);
    const res = await fetch(
      `https://real-time-events-search.p.rapidapi.com/search-events?query=${query}&date=month&is_virtual=false&start=0`,
      {
        headers: {
          "x-rapidapi-key":  key,
          "x-rapidapi-host": "real-time-events-search.p.rapidapi.com",
        },
      }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const start = new Date(startDate).getTime();
    const end   = new Date(endDate).getTime() + 24 * 3600 * 1000;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data?.data ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((ev: any) => {
        const iso = ev.start_time ?? ev.start_time_utc ?? "";
        const when = iso ? iso.split("T")[0] : startDate;
        const ts = iso ? new Date(iso).getTime() : NaN;
        const tags: string[] = (ev.tags ?? []).map((x: string) => x.toLowerCase());
        let type = "festival";
        if (tags.some(t => t.includes("concert") || t.includes("music"))) type = "concert";
        else if (tags.some(t => t.includes("sport") || t.includes("game"))) type = "sport";
        else if (tags.some(t => t.includes("fair")  || t.includes("festival"))) type = "festival";
        else if (tags.some(t => t.includes("art")   || t.includes("theatre") || t.includes("theater"))) type = "show";
        return {
          name:        ev.name ?? "",
          type,
          when,
          ts,
          description: (ev.description ?? "").slice(0, 200),
          price:       ev.ticket_links?.length ? "See website" : "Free / See website",
          venue:       ev.venue?.name ?? ev.venue?.full_address ?? "",
          ticketUrl:   ev.link ?? ev.ticket_links?.[0]?.link ?? "",
          source:      "Google Events",
        };
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((ev: any) => ev.name && (!ev.ts || isNaN(ev.ts) || (ev.ts >= start && ev.ts <= end)))
      .slice(0, 15);
  } catch { return []; }
}

// ── Eventbrite (legacy — la mayoría de keys ya no pueden buscar) ─

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchEventbrite(city: string, startDate: string, endDate: string): Promise<any[]> {
  const key = process.env.EVENTBRITE_API_KEY;
  if (!key) return [];
  try {
    const res = await fetch(
      `https://www.eventbriteapi.com/v3/events/search/?q=${encodeURIComponent(city)}&start_date.range_start=${startDate}T00:00:00Z&start_date.range_end=${endDate}T23:59:59Z&expand=venue&page_size=5&sort_by=date`,
      { headers: { Authorization: `Bearer ${key}` } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data?.events ?? []).filter((ev: any) => ev.name?.text).map((ev: any) => ({
      name:        ev.name?.text ?? "",
      type:        ev.category_id === "103" ? "concert" : ev.category_id === "108" ? "sport" : "festival",
      when:        ev.start?.local?.split("T")[0] ?? startDate,
      description: ev.description?.text?.slice(0, 150) ?? ev.summary ?? "",
      price:       ev.is_free ? "Free" : ev.ticket_availability?.minimum_ticket_price?.display ?? "See website",
      venue:       ev.venue?.name ?? "",
      ticketUrl:   ev.url ?? "",
      source:      "Eventbrite",
    }));
  } catch { return []; }
}

// ── Google Places ─────────────────────────────────────────────

async function enrichRestaurantRatings(restaurants: ItineraryData["restaurants"], city: string) {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return;
  try {
    for (const resto of restaurants.slice(0, 4)) {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(resto.name + " " + city)}&key=${key}`
      );
      const data = await res.json();
      const place = data?.results?.[0];
      if (place) {
        if (place.rating)            resto.rating  = String(place.rating);
        if (place.formatted_address) resto.address = place.formatted_address;
      }
    }
  } catch { /* silent */ }
}

// ── Geoapify ──────────────────────────────────────────────────

async function enrichWithGeoapify(itinerary: ItineraryData, form: TripFormData) {
  const key = process.env.GEOAPIFY_API_KEY;
  if (!key) return;
  try {
    const geoRes = await fetch(
      `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(form.city + ", " + form.country)}&limit=1&apiKey=${key}`
    );
    const geoData = await geoRes.json();
    const coords = geoData?.features?.[0]?.geometry?.coordinates;
    if (!coords) return;
    const [lon, lat] = coords;
    const poiRes = await fetch(
      `https://api.geoapify.com/v2/places?categories=tourism.attraction,tourism.sights,entertainment.museum&filter=circle:${lon},${lat},5000&limit=6&apiKey=${key}`
    );
    const poiData = await poiRes.json();
    if (itinerary.days?.[0]) {
      for (const place of (poiData?.features ?? []).slice(0, 3)) {
        const props = place.properties;
        const name = props?.name;
        if (!name) continue;
        const alreadyIn = itinerary.days[0].items.some(
          (item: { name: string }) => item.name.toLowerCase() === name.toLowerCase()
        );
        if (!alreadyIn) {
          itinerary.days[0].items.push({
            id:            `geo_${Math.random().toString(36).slice(2, 8)}`,
            time:          "10:00",
            type:          "sight",
            name,
            description:   `${props.categories?.[0] ?? "Attraction"} in ${form.city}.`,
            duration:      "1h",
            transport:     "walking",
            transportTime: "varies",
            price:         "$",
            rating:        "",
            tip:           props.website ? `Visit: ${props.website}` : "",
          });
        }
      }
    }
  } catch { /* silent */ }
}

// ── Main handler ──────────────────────────────────────────────

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const form: TripFormData = req.body;
  if (!form.city || !form.country || !form.startDate || !form.endDate) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    // ── 1. Groq — core itinerary ──────────────────────────────
    const prompt = buildItineraryPrompt(form);
    const rawText = await callGroq(prompt, 6000);
    const jsonStr = extractJSON(rawText);

    let itinerary: ItineraryData;
    try {
      itinerary = JSON.parse(jsonStr);
    } catch {
      const fixText = await callGroq(
        `Fix this JSON and return ONLY valid JSON, no explanation:\n\n${jsonStr}`, 6000
      );
      itinerary = JSON.parse(extractJSON(fixText));
    }

    itinerary.events      = itinerary.events      ?? [];
    itinerary.alerts      = itinerary.alerts      ?? [];
    itinerary.restaurants = itinerary.restaurants ?? [];

    // ── 2. Hotels — deep-links con fechas/ciudad/huéspedes ───
    itinerary.hotels = buildHotelLinks(form);

    // ── 3. Parallel enrichment ────────────────────────────────
    const [wikidataRes, weatherRes, tmRes, ebRes, rapidRes] = await Promise.allSettled([
      fetchWikidataAttractions(form.city),
      fetchWeather(form.city, form.country),
      fetchTicketmaster(form.city, form.startDate, form.endDate),
      fetchEventbrite(form.city, form.startDate, form.endDate),
      fetchRapidEvents(form.city, form.country, form.startDate, form.endDate),
    ]);

    // ── 4. Wikidata descriptions ──────────────────────────────
    if (wikidataRes.status === "fulfilled") {
      const wdPlaces = wikidataRes.value;
      for (const day of itinerary.days ?? []) {
        for (const item of day.items ?? []) {
          if (item.type !== "sight") continue;
          const match = wdPlaces.find(
            p => p.name.toLowerCase().includes(item.name.toLowerCase().split(" ")[0])
              || item.name.toLowerCase().includes(p.name.toLowerCase().split(" ")[0])
          );
          if (match?.description && match.description.length > 20) {
            item.wikidataDescription = match.description;
          }
        }
      }
    }

    // ── 5. Weather ────────────────────────────────────────────
    if (weatherRes.status === "fulfilled" && weatherRes.value) {
      itinerary.weather = { ...itinerary.weather, ...weatherRes.value };
    }

    // ── 6/7/8. Merge events from all sources (dedupe by name) ─
    const seen = new Set(itinerary.events.map(e => e.name.toLowerCase().trim()));
    const pushEvents = (arr: unknown) => {
      if (!Array.isArray(arr)) return;
      for (const ev of arr) {
        const key = (ev?.name ?? "").toLowerCase().trim();
        if (!key || seen.has(key)) continue;
        itinerary.events.push(ev);
        seen.add(key);
      }
    };
    if (tmRes.status    === "fulfilled") pushEvents(tmRes.value);
    if (rapidRes.status === "fulfilled") pushEvents(rapidRes.value);
    if (ebRes.status    === "fulfilled") pushEvents(ebRes.value);

    // Ordenar por fecha asc
    itinerary.events.sort((a, b) => (a.when ?? "").localeCompare(b.when ?? ""));

    // ── 9. Google Places ratings ──────────────────────────────
    await enrichRestaurantRatings(itinerary.restaurants, form.city);

    // ── 10. Geoapify POIs ─────────────────────────────────────
    await enrichWithGeoapify(itinerary, form);

    // ── 11. Source tag ────────────────────────────────────────
    itinerary.generatedBy = "Groq LLaMA 3.3 70B · Ticketmaster · Google Events · Wikidata";

    return res.status(200).json(itinerary);

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[generate] Error:", message);
    return res.status(500).json({ error: "Failed to generate itinerary", detail: message });
  }
}

export const config = { api: { responseLimit: "10mb" } };
