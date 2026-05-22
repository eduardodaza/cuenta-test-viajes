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
  const firstDayLabel = sd.toLocaleDateString(locale === "es" ? "es-ES" : locale, {
    weekday: "long", day: "numeric", month: "long",
  });

  return `You are a local travel expert for ${form.city}, ${form.country}. Generate a realistic tourist itinerary in ${lang}.

TRIP:
- Destination: ${form.city}, ${form.country}
- Dates: ${dateStr} to ${dateEndStr} (${days} days)
- Travelers: ${form.travelers} (${form.travelerType})
- Budget: ${form.budget}
- Interests: ${form.interests.join(", ")}

=== ABSOLUTE RULES — NEVER VIOLATE ===

RULE 1 — REAL OPENING HOURS (apply to every single item in every day):

MUSEUMS & CULTURAL SITES:
- Typical hours: 09:00 to 17:00 or 18:00
- Last entry usually 1 hour before closing
- NEVER schedule a museum visit starting after 16:00
- NEVER schedule a museum visit ending after 18:00

CHURCHES & CATHEDRALS:
- Typical hours: 07:00 to 12:00 and 15:00 to 18:00
- Avoid scheduling during midday (12:00–15:00) when many close

MARKETS:
- Morning markets: 06:00 to 13:00
- NEVER schedule a morning market after 12:00

RESTAURANTS — LUNCH:
- Only between 12:00 and 15:30
- NEVER schedule lunch at 10:00 or 17:00

RESTAURANTS — DINNER:
- Only between 19:00 and 23:00
- NEVER schedule dinner at 16:00 or 18:00

CAFES & BREAKFAST:
- 07:00 to 11:00

PARKS & OUTDOOR ATTRACTIONS:
- Any time between 06:00 and 20:00
- Avoid after dark unless specifically a night attraction

BARS & NIGHTLIFE:
- Only after 20:00, ideally 21:00–02:00

SHOPPING / MALLS:
- 10:00 to 20:00

TOURS & EXCURSIONS:
- Morning: start 08:00–10:00
- Afternoon: start 14:00–15:00
- NEVER start a long tour after 16:00

A CORRECT DAY LOOKS LIKE THIS:
08:00 — Breakfast at a café
09:30 — Visit museum or attraction (arrives before 10:00, leaves by 12:00)
12:30 — Lunch at a local restaurant
14:30 — Visit another attraction or neighborhood walk
17:00 — Relaxing activity, park, viewpoint, shopping
19:30 — Aperitif or drinks
21:00 — Dinner at a restaurant

AN INCORRECT DAY (NEVER DO THIS):
18:00 — Museum visit ← WRONG, museum is closing
20:00 — Lunch ← WRONG, too late for lunch
07:00 — Dinner ← WRONG, too early for dinner

RULE 2 — RESTAURANTS MUST BE IN ${form.city}:
- Every restaurant must physically exist in ${form.city}, ${form.country}
- NEVER suggest restaurants from other cities or countries
- NEVER invent restaurant names
- Only suggest restaurants you are certain exist in ${form.city}
- If unsure, describe generically: "traditional local restaurant in [neighborhood of ${form.city}]"

RULE 3 — EVENTS MUST MATCH THE TRAVEL MONTH (${startMonth}):
- Only include events that actually happen in ${startMonth} in ${form.city}
- DO NOT include annual festivals that occur in other months
- Example: if travel is in May, do NOT suggest a December festival
- If no confirmed events exist for ${startMonth}, use permanent attractions only and leave events array as []

RULE 4 — GEOGRAPHY:
- All places must be located in ${form.city}, ${form.country}
- Walking/transport times must be geographically realistic

=== END RULES ===

Respond ONLY with valid JSON. No markdown, no backticks, no comments outside the JSON:

{
  "city": "${form.city}",
  "country": "${form.country}",
  "tagline": "short inspiring phrase max 10 words",
  "summary": "2-sentence trip overview",
  "weather": {
    "maxTemp": 28,
    "minTemp": 18,
    "description": "warm and sunny"
  },
  "estimatedBudgetPerDay": "COP 250.000–400.000",
  "days": [
    {
      "dayNum": 1,
      "theme": "day theme",
      "date": "${firstDayLabel}",
      "zone": "main neighborhood visited",
      "items": [
        {
          "id": "d1i1",
          "time": "09:00",
          "type": "sight|food|transport|event|alert|beach|night",
          "name": "name of place — must exist and be open at this time in ${form.city}",
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
      "address": "real street address in ${form.city} if known"
    }
  ],
  "events": [],
  "alerts": [
    {
      "level": "alto|medio|bajo",
      "zone": "zone in ${form.city}",
      "description": "safety note",
      "tip": "practical tip"
    }
  ]
}

Include 6-8 items per day. Every item's time must respect the opening hours listed above.`;
}
