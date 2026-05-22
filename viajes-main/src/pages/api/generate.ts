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

// ── Hotel links — sin API, gratuito ──────────────────────────

function buildHotelLinks(form: TripFormData): Hotel[] {
  const query = encodeURIComponent(`${form.city}, ${form.country}`);
  const city  = encodeURIComponent(form.city);
  const ctry  = encodeURIComponent(form.country);
  const cin   = form.startDate;
  const cout  = form.endDate;
  const adults = form.travelers;

  return [
    {
      name: `Hoteles en ${form.city} — Booking.com`,
      stars: 0, reviewScore: 0, reviewCount: 0,
      pricePerNight: "Ver precios", currency: "",
      address: `${form.city}, ${form.country}`,
      platform: "Booking.com",
      url: `https://www.booking.com/searchresults.html?ss=${query}&checkin=${cin}&checkout=${cout}&group_adults=${adults}&selected_currency=USD`,
    },
    {
      name: `Hoteles en ${form.city} — Hotels.com`,
      stars: 0, reviewScore: 0, reviewCount: 0,
      pricePerNight: "Ver precios", currency: "",
      address: `${form.city}, ${form.country}`,
      platform: "Hotels.com",
      url: `https://www.hotels.com/search.do?q-destination=${query}&q-check-in=${cin}&q-check-out=${cout}&q-rooms=1&q-room-0-adults=${adults}`,
    },
    {
      name: `Hoteles en ${form.city} — Expedia`,
      stars: 0, reviewScore: 0, reviewCount: 0,
      pricePerNight: "Ver precios", currency: "",
      address: `${form.city}, ${form.country}`,
      platform: "Expedia",
      url: `https://www.expedia.com/Hotel-Search?destination=${query}&startDate=${cin}&endDate=${cout}&adults=${adults}`,
    },
    {
      name: `Hoteles en ${form.city} — Hostelworld`,
      stars: 0, reviewScore: 0, reviewCount: 0,
      pricePerNight: "Ver precios", currency: "",
      address: `${form.city}, ${form.country}`,
      platform: "Hostelworld",
      url: `https://www.hostelworld.com/findabed.php/ChosenCity.${city}/ChosenCountry.${ctry}/DateFrom.${cin}/DateTo.${cout}/number_of_guests.${adults}`,
    },
    {
      name: `Hoteles en ${form.city} — TripAdvisor`,
      stars: 0, reviewScore: 0, reviewCount: 0,
      pricePerNight: "Ver precios", currency: "",
      address: `${form.city}, ${form.country}`,
      platform: "TripAdvisor",
      url: `https://www.tripadvisor.com/Search?q=${query}+hotels`,
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

// ── Ticketmaster ──────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchTicketmaster(city: string, startDate: string, endDate: string): Promise<any[]> {
  const key = process.env.TICKETMASTER_API_KEY;
  if (!key) return [];
  try {
    const res = await fetch(
      `https://app.ticketmaster.com/discovery/v2/events.json?city=${encodeURIComponent(city)}&startDateTime=${startDate}T00:00:00Z&endDateTime=${endDate}T23:59:59Z&size=8&apikey=${key}`
    );
    const data = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data?._embedded?.events ?? []).map((ev: any) => ({
      name:        ev.name ?? "",
      type:        ev.classifications?.[0]?.segment?.name === "Music" ? "concert" : "festival",
      when:        ev.dates?.start?.localDate ?? startDate,
      description: ev.info ?? ev.pleaseNote ?? "",
      price:       ev.priceRanges?.[0]?.min ? `From $${ev.priceRanges[0].min}` : "See website",
      venue:       ev._embedded?.venues?.[0]?.name ?? "",
      ticketUrl:   ev.url ?? "",
      source:      "Ticketmaster",
    }));
  } catch { return []; }
}

// ── Eventbrite ────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchEventbrite(city: string, startDate: string, endDate: string): Promise<any[]> {
  const key = process.env.EVENTBRITE_API_KEY;
  if (!key) return [];
  try {
    const res = await fetch(
      `https://www.eventbriteapi.com/v3/events/search/?q=${encodeURIComponent(city)}&start_date.range_start=${startDate}T00:00:00Z&start_date.range_end=${endDate}T23:59:59Z&expand=venue&page_size=5&sort_by=date`,
      { headers: { Authorization: `Bearer ${key}` } }
    );
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    let rawText  = await callGroq(prompt, 6000);
    let jsonStr  = extractJSON(rawText);

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

    // ── 2. Hotels — links directos sin API ───────────────────
    itinerary.hotels = buildHotelLinks(form);

    // ── 3. Parallel enrichment ────────────────────────────────
    const [wikidataRes, weatherRes, tmRes, ebRes] = await Promise.allSettled([
      fetchWikidataAttractions(form.city),
      fetchWeather(form.city, form.country),
      fetchTicketmaster(form.city, form.startDate, form.endDate),
      fetchEventbrite(form.city, form.startDate, form.endDate),
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

    // ── 6. Ticketmaster events ────────────────────────────────
    if (tmRes.status === "fulfilled") {
      const seen = new Set(itinerary.events.map(e => e.name.toLowerCase()));
      for (const ev of tmRes.value) {
        if (!seen.has(ev.name.toLowerCase())) {
          itinerary.events.unshift(ev);
          seen.add(ev.name.toLowerCase());
        }
      }
    }

    // ── 7. Eventbrite events ──────────────────────────────────
    if (ebRes.status === "fulfilled") {
      const seen = new Set(itinerary.events.map(e => e.name.toLowerCase()));
      for (const ev of ebRes.value) {
        if (!seen.has(ev.name.toLowerCase())) {
          itinerary.events.push(ev);
          seen.add(ev.name.toLowerCase());
        }
      }
    }

    // ── 8. Google Places ratings ──────────────────────────────
    await enrichRestaurantRatings(itinerary.restaurants, form.city);

    // ── 9. Geoapify POIs ──────────────────────────────────────
    await enrichWithGeoapify(itinerary, form);

    // ── 10. Source tag ────────────────────────────────────────
    itinerary.generatedBy = "Groq LLaMA 3.3 70B · Wikidata · Ticketmaster · Eventbrite";

    return res.status(200).json(itinerary);

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[generate] Error:", message);
    return res.status(500).json({ error: "Failed to generate itinerary", detail: message });
  }
}

export const config = { api: { responseLimit: "10mb" } };
