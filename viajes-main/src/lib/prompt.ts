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

  // Cantidad dinámica: ~3 por día (desayuno/almuerzo/cena) con mínimo 9 y máximo 18
  const minResto = Math.max(9, days * 3);
  const maxResto = Math.min(18, days * 3 + 3);

  return `You are a SENIOR LOCAL TRAVEL EXPERT for ${form.city}, ${form.country}, with deep knowledge of traditional culture, popular festivals, iconic nightlife, top-rated venues from TripAdvisor / Google Maps / Yelp, and what locals actually recommend. Generate a realistic, INSIDER-LEVEL itinerary in ${lang}.

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
  a) RECURRING TRADITIONAL FESTIVALS that historically happen every year in this exact window
     (examples of the kind of thing to include if relevant to the city/dates:
      Feria de Cali = Dec 25–30 in Cali, Feria de las Flores = early August in Medellín,
      Carnaval de Barranquilla = Feb/Mar, Carnaval de Negros y Blancos = Jan in Pasto,
      Oktoberfest = late Sep in Munich, Fallas = March in Valencia, etc.).
  b) ICONIC LOCAL SHOWS / NIGHTLIFE that run year-round and are CAN'T-MISS for any visitor
     (e.g. for Cali: Delirio, El Mulato Cabaret, Tin Tin Deo, Zaperoco;
      for Medellín: Comuna 13 graffiti tour, Guatapé day trip, Parque Lleras nightlife;
      for Buenos Aires: a real tango show; for Tokyo: a sumo or robot show, etc.).
  c) Permanent attractions with scheduled performances (theaters, peñas, dance shows).

NEVER leave "events" empty if the destination has known recurring traditions for ${startMonth}. Use your knowledge of the city. Each event must include realistic "when" (YYYY-MM-DD inside the trip window or "every Thursday/Friday/Saturday" for recurring shows), a venue, and a brief description of why it matters.

RULE 4 — THE DAILY ITINERARY MUST INCLUDE LOCAL ICONS:
At least one item per trip MUST be a celebrated local cultural experience (traditional show, signature nightlife, iconic neighborhood tour). For Cali this means including Delirio (Fridays) or a salsa show at El Mulato / Zaperoco / Tin Tin Deo. For Medellín, Comuna 13 graffiti tour + a Guatapé excursion. Apply the same logic to any destination.

RULE 5 — GEOGRAPHY:
- All places located in ${form.city}, ${form.country}.
- Walking/transport times realistic.

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
      "zone": "main neighborhood visited",
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

Include 6-8 items per day. Populate "restaurants" with ${minResto}-${maxResto} entries distributed across all days (use "dayHint"). Populate "events" with AT LEAST 4 entries combining traditional festivals (if any in window) and iconic recurring shows/nightlife. Every time must respect the opening hours above.`;
}
