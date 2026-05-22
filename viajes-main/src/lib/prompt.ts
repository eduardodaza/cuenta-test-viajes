// src/lib/prompt.ts
import type { TripFormData } from "./types";

const LANG_MAP: Record<string, string> = {
  es: "Spanish", en: "English", fr: "French",
  de: "German",  pt: "Portuguese", it: "Italian",
};

function formatDate(date: Date, locale: string): string {
  return date.toLocaleDateString(locale === "es" ? "es-ES" : locale, {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}

// ── Main itinerary prompt ─────────────────────────────────────
export function buildItineraryPrompt(form: TripFormData): string {
  const sd   = new Date(form.startDate + "T12:00:00");
  const ed   = new Date(form.endDate   + "T12:00:00");
  const days = Math.round((ed.getTime() - sd.getTime()) / 86400000) + 1;
  const lang = LANG_MAP[form.locale ?? "es"] ?? "Spanish";

  return `You are an expert travel planner and local guide with deep knowledge of global tourism.
Respond ONLY in ${lang}. Return ONLY valid JSON — no backticks, no markdown, no comments.

Trip details:
- City: ${form.city}, ${form.country}
- Dates: ${formatDate(sd, form.locale)} to ${formatDate(ed, form.locale)} (${days} days)
- Travelers: ${form.travelers} (${form.travelerType})
- Budget: ${form.budget}
- Interests: ${form.interests.join(", ")}

CRITICAL RESTAURANT RULES — read carefully:
1. Select ONLY restaurants that are genuinely well-known and highly rated by tourists
2. Base your selection on real ratings from TripAdvisor, Google Maps and Yelp
3. Each restaurant MUST be located near the day's route to minimize travel
4. Include the real street address for every restaurant
5. Include the neighborhood/zone so users know exactly where it is
6. Mark the source platform that best covers this restaurant (TripAdvisor / Google Maps / Yelp)
7. Minimum 2 restaurants per price tier ($, $$, $$$, $$$$)
8. Prioritize restaurants with 4.0+ ratings and 100+ reviews

CRITICAL ATTRACTION RULES:
1. All sights must be REAL places that exist in ${form.city}
2. Include realistic entry prices in local currency
3. Include realistic visit duration and transport time from previous stop
4. Group attractions by geographic proximity each day to minimize travel
5. Include a real insider tip for each major attraction

Return ONLY this exact JSON structure:
{
  "city": "city name",
  "country": "country name",
  "tagline": "inspiring phrase max 10 words",
  "summary": "2-sentence trip overview",
  "weather": {
    "maxTemp": 27,
    "minTemp": 18,
    "seaTemp": null,
    "description": "warm sunny days"
  },
  "estimatedBudgetPerDay": "€80–130 per person",
  "days": [
    {
      "dayNum": 1,
      "theme": "Descriptive day theme",
      "date": "Sunday, July 12",
      "zone": "Main neighborhoods covered today",
      "items": [
        {
          "id": "d1i1",
          "time": "09:00",
          "type": "sight|food|transport|event|alert|beach|night",
          "name": "Exact place name",
          "description": "2 useful sentences for tourists",
          "duration": "1h 30min",
          "transport": "walking|metro|bus|taxi",
          "transportTime": "12 min",
          "price": "$|$$|$$$|$$$$",
          "priceDetail": "€12 per person / free",
          "rating": "4.6",
          "tip": "Practical insider tip"
        }
      ]
    }
  ],
  "restaurants": [
    {
      "name": "Exact restaurant name",
      "type": "Cuisine type",
      "priceRange": "$|$$|$$$|$$$$",
      "rating": "4.4",
      "reviewCount": "2,400+ reviews",
      "specialty": "Signature dish or what they are known for",
      "zone": "Exact neighborhood",
      "address": "Full street address",
      "source": "TripAdvisor|Google Maps|Yelp",
      "dayNum": 1,
      "tip": "Best time to go or reservation tip"
    }
  ],
  "events": [
    {
      "name": "Event name",
      "type": "festival|concert|permanent|sport|market|cinema",
      "when": "Exact dates or permanent",
      "description": "Brief useful description",
      "price": "Free / €10–20",
      "venue": "Venue name and zone"
    }
  ],
  "alerts": [
    {
      "level": "alto|medio|bajo",
      "zone": "Zone name",
      "description": "What tourists should know",
      "tip": "Practical safety advice"
    }
  ]
}

Additional rules:
- 6-8 activities per day from morning to night
- Group nearby attractions each day — never send tourists back and forth
- Transport times between stops must be realistic
- Events must reflect real festivals or seasons for these exact dates
- Alerts must be realistic and specific to ${form.city}
- JSON must be strictly valid — no trailing commas, no comments`;
}

// ── Wikidata SPARQL — atracciones turísticas reales ──────────
export function buildWikidataSPARQL(city: string): string {
  // Busca atracciones turísticas, museos y monumentos con label, coordenadas y descripción
  return `
SELECT DISTINCT ?place ?placeLabel ?description ?coord ?instanceLabel WHERE {
  ?place wdt:P131* ?cityEntity .
  ?cityEntity rdfs:label "${city}"@en .
  ?place wdt:P31 ?instance .
  ?instance wdt:P279* wd:Q570116 .
  OPTIONAL { ?place schema:description ?description . FILTER(LANG(?description) = "en") }
  OPTIONAL { ?place wdt:P625 ?coord }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en,es" . }
}
LIMIT 10
`.trim();
}

// ── Events + Security prompt para segundo modelo si se usa ───
export function buildEventsSecurityPrompt(form: TripFormData): string {
  const sd  = new Date(form.startDate + "T12:00:00");
  const ed  = new Date(form.endDate   + "T12:00:00");
  const fmt = (d: Date) => d.toLocaleDateString("en-US", { month:"long", day:"numeric", year:"numeric" });

  return `Find real, current information about ${form.city}, ${form.country}.
Return ONLY valid JSON — no markdown, no explanation.

{
  "events": [
    {
      "name": "event name",
      "type": "festival|concert|permanent|sport|market|cinema",
      "when": "exact dates",
      "description": "brief description",
      "price": "free or price",
      "venue": "venue name"
    }
  ],
  "alerts": [
    {
      "level": "alto|medio|bajo",
      "zone": "zone name",
      "description": "what tourists should know",
      "tip": "practical safety tip"
    }
  ]
}

Find up to 6 real events happening between ${fmt(sd)} and ${fmt(ed)} in ${form.city}.
Find up to 5 current tourist safety alerts for ${form.city} in ${new Date().getFullYear()}.`;
}
