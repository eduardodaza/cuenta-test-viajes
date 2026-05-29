// src/lib/prompt.ts
import type { TripFormData } from "./types";

export function buildItineraryPrompt(form: TripFormData): string {
  const sd = new Date(form.startDate + "T12:00:00");
  const ed = new Date(form.endDate + "T12:00:00");
  const days = Math.round((ed.getTime() - sd.getTime()) / 86400000) + 1;
  const locale = form.locale ?? "es";
  const lang = locale === "es" ? "Spanish" : locale === "fr" ? "French" : locale === "de" ? "German" : locale === "pt" ? "Portuguese" : locale === "it" ? "Italian" : "English";

  const dayStart = form.dayStartTime || "08:00";
  const dayEnd   = form.dayEndTime   || "23:00";

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

  const minResto = Math.max(9, days * 3);
  const maxResto = Math.min(18, days * 3 + 3);

  // Más items por día porque la ventana horaria es mayor (08:00–23:00 por default).
  const minItems = 7;
  const maxItems = 10;

  return `You are a SENIOR LOCAL TRAVEL EXPERT for ${form.city}, ${form.country}, with deep knowledge of the MOST EMBLEMATIC landmarks, traditional culture, popular festivals, iconic nightlife, top-rated venues from TripAdvisor / Google Maps / Yelp / Lonely Planet / official tourism boards, and what locals actually recommend. Generate a realistic, INSIDER-LEVEL itinerary in ${lang}.

TRIP:
- Destination: ${form.city}, ${form.country}
- Dates: ${dateStr} to ${dateEndStr} (${days} days, ${startMonth} ${startDay}–${endDay})
- Travelers: ${form.travelers} (${form.travelerType})
- Budget: ${form.budget}
- Interests: ${form.interests.join(", ")}
- Day window requested by the client: ${dayStart} → ${dayEnd}

=== ABSOLUTE RULES ===

RULE 0 — DAY WINDOW (CRITICAL):
- EVERY day starts at ${dayStart} and ends at or before ${dayEnd}.
- The FIRST item of each day MUST start at ${dayStart} (or within 15 min after).
- The LAST real item MUST end on/before ${dayEnd}.
- Distribute items evenly across the window. Do NOT leave large empty gaps.
- If ${dayStart} is before 08:00, start with sunrise viewpoints / early markets / breakfast spots that genuinely open that early. If no real venue opens that early, start with a walk/jog through an iconic plaza/park and breakfast at the first café that opens nearby.

RULE 1 — REAL OPENING HOURS (still apply within the day window):
- Museums/cultural sites: 09:00–17:00/18:00. Never start a museum visit after 16:00.
- Churches: 07:00–12:00 and 15:00–18:00.
- Morning markets: 06:00–13:00.
- Lunch: 12:00–15:30 ONLY. Dinner: 19:00–23:00 ONLY.
- Cafes/breakfast: 07:00–11:00.
- Parks/viewpoints: 06:00–20:00.
- Bars/nightlife: 20:00–02:00.
- Shopping: 10:00–20:00.

RULE 2 — RESTAURANTS MUST BE REAL, ABUNDANT AND ALIGNED TO THE DAILY ROUTE:
- Use ONLY restaurants that genuinely exist in ${form.city}, ${form.country}.
- Provide BETWEEN ${minResto} AND ${maxResto} restaurants total.
- For EACH day at least 3 options near that day's zones: breakfast/café, lunch close to the midday attraction, dinner in a nightlife/dining neighborhood.
- Cover ALL price tiers and mix cuisines. Prioritize TripAdvisor/Google Maps/Yelp top-rated.
- Each restaurant includes "dayHint" (1..${days}) and "mealHint" (breakfast|lunch|dinner|snack).

RULE 3 — EVENTS, FESTIVALS AND TRADITIONS:
- Populate "events" with the BEST of what is happening in ${form.city} between ${startMonth} ${startDay} and ${endDay}: recurring traditional festivals, iconic year-round shows, scheduled performances.
- Never leave "events" empty if the destination has known recurring traditions for ${startMonth}.

RULE 4 — THE DAILY ITINERARY MUST INCLUDE THE MOST EMBLEMATIC LOCAL ICONS FIRST:
- The single most iconic landmark of ${form.city} MUST appear on Day 1.
- Do NOT skip world-famous must-sees in favor of obscure neighborhoods.
- For Madrid: Plaza Mayor, Palacio Real, Puerta del Sol, Mercado San Miguel, Gran Vía, Retiro, Prado, Reina Sofía, Thyssen, Templo de Debod, Bernabéu must all be considered.
- For Paris: Tour Eiffel, Louvre, Notre-Dame, Montmartre/Sacré-Cœur, Champs-Élysées, Arc de Triomphe, Musée d'Orsay, Marais, Île de la Cité, Versailles must all be considered.
- For Rome: Colosseum, Roman Forum, Vatican, Sistine Chapel, Trevi, Pantheon, Piazza Navona, Spanish Steps, Trastevere.
- For NY: Times Square, Central Park, Statue of Liberty, Empire State, Brooklyn Bridge, MoMA, Met, 9/11 Memorial, High Line.
- Apply the same emblematic-first logic to ANY city. NEVER leave out the #1 landmark.

RULE 5 — GEOGRAPHY, SECTORS, NO REPETITION:
- Think first in CITY SECTORS / NEIGHBORHOODS. Assign a DIFFERENT primary sector to each day. NEVER repeat the same "zone" as primary on two days.
- Within a day, cluster items in the day's primary sector + 1 adjacent sector. No pinballing across the city.
- Day 1 = most iconic cluster. Day 2 = second-most iconic. Etc. For 5+ day trips include a day trip (Toledo/Versailles/Tivoli).

RULE 6 — DAILY VOLUME AND REAL DISPLACEMENT/VISIT TIMES:
- ${minItems}–${maxItems} REAL items per day (sights, food, events, night), distributed across the ${dayStart}–${dayEnd} window.
- Transport hops do NOT count as items; add them as "transport" items between real stops when displacement > 15 min.
- Every item: realistic "duration" + when moving to next, "transport" + "transportTime".
- Each day MUST cover at least: early/morning + lunch + afternoon + evening/dinner + (if dayEnd >= 21:00) a night closer.

=== END RULES ===

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
      "zone": "PRIMARY sector — unique across all days",
      "items": [
        {
          "id": "d1i1",
          "time": "${dayStart}",
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
      "name": "real restaurant in ${form.city}",
      "type": "cuisine",
      "priceRange": "$ / $$ / $$$ / $$$$",
      "rating": "4.3",
      "specialty": "signature dish",
      "zone": "neighborhood",
      "source": "TripAdvisor / Google Maps / Yelp",
      "address": "real street address if known",
      "dayHint": 1,
      "mealHint": "lunch"
    }
  ],
  "events": [
    { "name": "real event", "type": "festival|concert|permanent|sport|market|cinema",
      "when": "YYYY-MM-DD or 'every Friday'", "description": "why + what",
      "price": "Free / $ / $$ / $$$", "venue": "real venue", "source": "local" }
  ],
  "alerts": [
    { "level": "alto|medio|bajo", "zone": "zone", "description": "safety note", "tip": "practical tip" }
  ]
}

HARD CONSTRAINTS — verify before responding:
- Day 1 includes the SINGLE most iconic must-see of ${form.city}.
- Every day starts at ${dayStart} and ends at/before ${dayEnd} with ${minItems}–${maxItems} real items.
- "zone" is unique per day. "restaurants" has ${minResto}–${maxResto} entries with dayHint for every day.
- "events" has ≥4 entries.`;
}
