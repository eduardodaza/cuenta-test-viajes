// src/lib/prompt.ts
import type { TripFormData } from "./types";

export function buildItineraryPrompt(form: TripFormData): string {
  const sd = new Date(form.startDate + "T12:00:00");
  const ed = new Date(form.endDate + "T12:00:00");
  const days = Math.round((ed.getTime() - sd.getTime()) / 86400000) + 1;
  const locale = form.locale ?? "es";
  const lang = locale === "es" ? "Spanish" : locale === "fr" ? "French" : locale === "de" ? "German" : locale === "pt" ? "Portuguese" : locale === "it" ? "Italian" : "English";

  const dateStr = sd.toLocaleDateString(locale === "es" ? "es-ES" : locale, {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
  const dateEndStr = ed.toLocaleDateString(locale === "es" ? "es-ES" : locale, {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const startMonth = sd.toLocaleString("en", { month: "long" });
  const startDay = sd.getDate();
  const endDay = ed.getDate();
  const firstDayLabel = sd.toLocaleDateString(locale === "es" ? "es-ES" : locale, {
    weekday: "long", day: "numeric", month: "long",
  });

  // Cantidad de restaurantes: ~3 por día con mínimo 9 y máximo 18
  const minResto = Math.max(9, days * 3);
  const maxResto = Math.min(18, days * 3 + 3);

  // Actividades por día: aumentamos a 6–8 reales (no contamos transportes como item)
  const minItems = 6;
  const maxItems = 8;

  return `You are a SENIOR LOCAL TRAVEL EXPERT for ${form.city}, ${form.country}, with deep knowledge of traditional culture, popular festivals, iconic nightlife, top-rated venues from TripAdvisor / Google Maps / Yelp / Lonely Planet / official tourism boards, and what locals actually recommend. Generate a realistic, INSIDER-LEVEL itinerary in ${lang}.

TRIP:
- Destination: ${form.city}, ${form.country}
- Dates: ${dateStr} to ${dateEndStr} (${days} days, ${startMonth} ${startDay}–${endDay})
- Travelers: ${form.travelers} (${form.travelerType})
- Budget: ${form.budget}
- Interests: ${form.interests.join(", ")}

=== ABSOLUTE RULES ===

RULE 1 — REAL OPENING HOURS:
- Museums/cultural sites: 09:00–17:00/18:00. Never start after 16:00.
- Churches: 07:00–12:00 and 15:00–18:00.
- Morning markets: 06:00–13:00.
- Lunch: 12:00–15:30 ONLY. Dinner: 19:00–23:00 ONLY.
- Cafes/breakfast: 07:00–11:00.
- Parks: 06:00–20:00.
- Bars/nightlife: 20:00–02:00.
- Shopping: 10:00–20:00.
- Long tours: start 08:00–10:00 or 14:00–15:00, never after 16:00.

RULE 2 — RESTAURANTS MUST BE REAL, ABUNDANT AND ALIGNED TO THE DAILY ROUTE:
- Use ONLY restaurants that genuinely exist in ${form.city}, ${form.country}.
- Provide BETWEEN ${minResto} AND ${maxResto} restaurants total (NEVER fewer than ${minResto}).
- Distribute them so that for EACH day of the trip there are AT LEAST 3 options near the
  zones/attractions of that day: one breakfast/café, one lunch close to the midday
  attraction, one dinner in a nightlife/dining neighborhood.
- Cover ALL price tiers: at least 3 "$" (casual / street food / market), at least 3 "$$"
  (mid-range local favorite), at least 2 "$$$" (premium / signature), and 1 "$$$$" only if
  the city has world-class fine dining.
- Mix cuisines: traditional local, contemporary, international, vegetarian/vegan option.
- Prioritize places with strong reputation on TripAdvisor / Google Maps / Yelp.
- Never invent names. If unsure of a name, omit it (do NOT fabricate).
- For EACH restaurant include the field "dayHint" with the day number it best fits
  (1..${days}) and "mealHint" = "breakfast" | "lunch" | "dinner" | "snack".

RULE 3 — EVENTS, FESTIVALS AND TRADITIONS (CRITICAL — THIS IS THE APP'S VALUE):
You MUST populate "events" with the BEST of what is happening in ${form.city} between ${startMonth} ${startDay} and ${endDay}. Include:
  a) RECURRING TRADITIONAL FESTIVALS that historically happen every year in this exact window.
  b) ICONIC LOCAL SHOWS / NIGHTLIFE that run year-round and are CAN'T-MISS for any visitor.
  c) Permanent attractions with scheduled performances (theaters, peñas, dance shows).
NEVER leave "events" empty if the destination has known recurring traditions for ${startMonth}.

RULE 4 — THE DAILY ITINERARY MUST INCLUDE LOCAL ICONS:
At least one item per trip MUST be a celebrated local cultural experience.

RULE 5 — GEOGRAPHY, SECTORS AND NO REPETITION (CRITICAL — FIXES THE MAIN UX BUG):
- All places located in ${form.city}, ${form.country}, with realistic walking/transport times.
- THINK FIRST in terms of CITY SECTORS / NEIGHBORHOODS. Internally list the 6–10 most
  important tourist sectors of ${form.city} (e.g. for Madrid: Centro/Sol-Gran Vía, Austrias,
  Barrio de las Letras, Retiro-Prado, Salamanca, Chamberí, Malasaña-Conde Duque, Chueca,
  Lavapiés-La Latina, Chamartín-Bernabéu; for Paris: Île de la Cité, Le Marais, Latin Quarter,
  Saint-Germain, Champs-Élysées-Étoile, Montmartre, Opéra, Bastille, Trocadéro, Belleville).
- ASSIGN A DIFFERENT PRIMARY SECTOR TO EACH DAY. NEVER repeat the same "zone" value as the
  primary zone of two different days. If the trip is longer than the number of strong sectors,
  use clearly different secondary sectors or a day-trip (e.g. Toledo/Segovia from Madrid,
  Versailles from Paris) — but never duplicate.
- Within a day, items SHOULD cluster in the day's primary sector and ONE adjacent sector to
  minimize displacement. Do NOT pinball across the city.
- HIERARCHY BY TOURIST IMPORTANCE (use Google Maps reviews + TripAdvisor "Things to do" +
  official tourism board + Lonely Planet "Top experiences" as your mental ranking):
    * Day 1: the SINGLE most iconic landmark of the city + its surrounding sector
      (e.g. Madrid → Plaza Mayor + Palacio Real + Almudena + Mercado San Miguel).
    * Day 2: the second-most iconic cluster (e.g. Madrid → Prado + Retiro + Barrio de las Letras).
    * Day 3: third cluster (e.g. Reina Sofía + Lavapiés + La Latina tapas).
    * Day 4+: progressively broader portfolio (Bernabéu/Salamanca shopping, Malasaña/Chueca
      local life, day trips). Only include nightlife-only neighborhoods like Malasaña as a
      PRIMARY zone if you still have unused top-tier sectors covered first.
- For VERY SHORT trips (1–3 days) prioritize ONLY the most emblematic, must-see icons of
  ${form.city}; do NOT dilute with secondary neighborhoods.
- For LONGER trips (5+ days) expand the portfolio: include a day trip and at least one
  off-the-beaten-path sector.

RULE 6 — DAILY VOLUME AND REAL DISPLACEMENT/VISIT TIMES:
- Each day MUST contain ${minItems}–${maxItems} REAL items (sights, food, events, night).
  Transport hops do NOT count toward the minimum — add them as "transport" items between
  real stops when displacement > 15 min.
- Every item MUST include realistic "duration" (visit time at the place) AND, when moving
  to the next item, "transport" (walking/metro/bus/taxi) + "transportTime" (e.g. "10 min").
- Typical realistic visit times: major museum 2h–3h, palace/cathedral 1h–1h30, viewpoint
  20–40 min, market 45 min–1h, walking tour of a neighborhood 1h30–2h, meal 1h–1h30.
- Each day MUST cover morning + lunch + afternoon + evening/dinner (4 time blocks minimum).

=== END RULES ===

BEFORE WRITING JSON, INTERNALLY (do NOT output) plan:
  1) List the 6–10 top tourist sectors of ${form.city} ranked by global importance.
  2) Assign each trip day to a DIFFERENT primary sector following the hierarchy in RULE 5.
  3) For each day, list 6–8 real top-rated places inside that sector + 1 adjacent sector.
  4) Verify NO two days share the same primary "zone" string.

Respond ONLY with valid JSON (no markdown, no backticks):

{
  "city": "${form.city}",
  "country": "${form.country}",
  "tagline": "short inspiring phrase max 10 words",
  "summary": "2-sentence trip overview",
  "weather": { "maxTemp": 28, "minTemp": 18, "description": "warm and sunny" },
  "estimatedBudgetPerDay": "COP 250.000–400.000",
  "days": [
    {
      "dayNum": 1,
      "theme": "day theme",
      "date": "${firstDayLabel}",
      "zone": "PRIMARY sector for this day — MUST be unique across all days",
      "items": [
        {
          "id": "d1i1",
          "time": "09:00",
          "type": "sight|food|transport|event|alert|beach|night",
          "name": "real place open at this time in ${form.city}",
          "description": "2-sentence description with practical info",
          "duration": "1h 30min",
          "transport": "walking / metro / bus / taxi",
          "transportTime": "10 min",
          "price": "$ / $$ / $$$ / $$$$",
          "rating": "4.5",
          "tip": "insider tip"
        }
      ]
    }
  ],
  "restaurants": [
    {
      "name": "real restaurant name in ${form.city}",
      "type": "cuisine type",
      "priceRange": "$ / $$ / $$$ / $$$$",
      "rating": "4.3",
      "specialty": "signature dish",
      "zone": "neighborhood in ${form.city}",
      "source": "TripAdvisor / Google Maps / Yelp",
      "address": "real street address in ${form.city} if known",
      "dayHint": 1,
      "mealHint": "lunch"
    }
  ],
  "events": [
    {
      "name": "real festival / show / concert / fair happening in ${form.city} during the trip dates",
      "type": "festival|concert|permanent|sport|market|cinema",
      "when": "YYYY-MM-DD or 'every Friday' for recurring shows",
      "description": "why it matters + what to expect",
      "price": "Free / $ / $$ / $$$",
      "venue": "real venue in ${form.city}",
      "source": "local knowledge / official site"
    }
  ],
  "alerts": [
    { "level": "alto|medio|bajo", "zone": "zone in ${form.city}", "description": "safety note", "tip": "practical tip" }
  ]
}

HARD CONSTRAINTS — verify before responding:
- Each day has ${minItems}–${maxItems} real items (excluding transport hops) covering morning, lunch, afternoon and evening.
- The "zone" value of every day is DIFFERENT from every other day's "zone".
- Days are ordered by tourist importance (most iconic sector first).
- "restaurants" has ${minResto}–${maxResto} entries distributed via "dayHint" so every day gets ≥3.
- "events" has ≥4 entries combining traditional festivals (if any in window) and iconic recurring shows.
- Every time respects the opening hours in RULE 1.`;
}
