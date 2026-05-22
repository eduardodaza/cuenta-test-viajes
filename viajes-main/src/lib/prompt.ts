// src/lib/prompt.ts
import type { TripFormData } from "./types";

export function buildItineraryPrompt(form: TripFormData): string {
  const sd = new Date(form.startDate + "T12:00:00");
  const ed = new Date(form.endDate + "T12:00:00");
  const days = Math.round((ed.getTime() - sd.getTime()) / 86400000) + 1;
  const locale = form.locale ?? "es";

  const dateStr = sd.toLocaleDateString(locale === "es" ? "es-ES" : locale, {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
  const dateEndStr = ed.toLocaleDateString(locale === "es" ? "es-ES" : locale, {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  return `You are an expert travel planner with deep local knowledge. Generate a COMPLETE, DETAILED tourist itinerary.
Respond ONLY in ${locale === "es" ? "Spanish" : locale === "fr" ? "French" : locale === "de" ? "German" : locale === "pt" ? "Portuguese" : locale === "it" ? "Italian" : "English"}.

Trip details:
- City: ${form.city}, ${form.country}
- Dates: ${dateStr} to ${dateEndStr} (${days} days)
- Travelers: ${form.travelers} (${form.travelerType})
- Budget: ${form.budget}
- Interests: ${form.interests.join(", ")}

CRITICAL RULES — MUST FOLLOW:
1. RESTAURANTS: Only suggest restaurants that ACTUALLY EXIST in ${form.city}, ${form.country}. Do NOT invent names. Use well-known local establishments. Each restaurant must be located in ${form.city} specifically.
2. ATTRACTIONS: Schedule visits respecting real opening hours. Museums typically open 09:00-18:00. Restaurants: lunch 12:00-15:00, dinner 19:00-23:00. Bars/nightlife after 20:00. Do NOT schedule a museum visit at 20:00 or a restaurant at 07:00.
3. EVENTS: Only include events that realistically could occur during ${dateStr} to ${dateEndStr}. Do NOT invent specific dated events.
4. BUDGET: Prices must be realistic for ${form.city}, ${form.country} and consistent with the "${form.budget}" budget level.
5. TRANSPORT: Walking times between places must be geographically realistic for ${form.city}.

Respond ONLY with valid JSON (no backticks, no markdown, no comments). Use exactly this schema:

{
  "city": "${form.city}",
  "country": "${form.country}",
  "tagline": "inspiring phrase max 10 words",
  "summary": "2-sentence trip overview",
  "weather": {
    "maxTemp": 27,
    "minTemp": 18,
    "seaTemp": 24,
    "description": "sunny Mediterranean summer"
  },
  "estimatedBudgetPerDay": "€80–130",
  "days": [
    {
      "dayNum": 1,
      "theme": "Day theme",
      "date": "Sunday, July 12",
      "zone": "Main zones / neighborhoods",
      "items": [
        {
          "id": "d1i1",
          "time": "09:00",
          "type": "sight|food|transport|event|alert|beach|night",
          "name": "Place or activity name — must exist in ${form.city}",
          "description": "Useful tourist description in 2 sentences",
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
      "name": "Real restaurant name that exists in ${form.city}",
      "type": "cuisine type",
      "priceRange": "$ / $$ / $$$ / $$$$",
      "rating": "4.3",
      "specialty": "signature dish",
      "zone": "neighborhood in ${form.city}",
      "source": "TripAdvisor / Google Maps / Yelp",
      "address": "real street address in ${form.city} if known"
    }
  ],
  "events": [
    {
      "name": "event name",
      "type": "festival|concert|permanent|sport|market|cinema",
      "when": "dates or 'permanent'",
      "description": "brief description",
      "price": "free / approximate price",
      "venue": "venue name in ${form.city}"
    }
  ],
  "alerts": [
    {
      "level": "alto|medio|bajo",
      "zone": "zone name in ${form.city}",
      "description": "what to watch out for",
      "tip": "practical safety tip"
    }
  ]
}

Additional rules:
- Include 6-8 activities per day, distributed from 08:00 to 22:00 respecting real business hours
- Group nearby attractions to minimize travel time
- ALL restaurants must be real businesses located in ${form.city}, ${form.country}
- Include at least 2-3 restaurants per price tier matching the "${form.budget}" budget
- Alerts must be realistic for ${form.city}
- The JSON must be strictly valid`;
}
