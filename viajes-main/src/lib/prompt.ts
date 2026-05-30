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

  const minItems = 7;
  const maxItems = 10;

  // ── Perfilado por tipo de viajero ──────────────────────────
  const travelerProfile: Record<string, string> = {
    pareja: "ROMANTIC COUPLE: prioritize scenic viewpoints, sunset spots, intimate cafés, wine bars, candle-lit dinners, boutique experiences, photo-worthy locations, couples' spa or rooftop bars. AVOID kid-focused parks or rowdy hostel bars.",
    familia: "FAMILY WITH KIDS: prioritize child-friendly museums (interactive), parks, zoos/aquariums, family restaurants with menu infantil, attractions with short queues or pre-booked tickets, no late nightlife, dinner before 21:00. AVOID bars, cabarets, very long museum visits, extreme adventure.",
    amigos: "GROUP OF FRIENDS: prioritize street food, food markets, brewery tours, lively bars and clubs, group activities (kayak, bike tour, escape room), social/iconic nightlife venues, shareable experiences. Heavier night block.",
    solo: "SOLO TRAVELER: prioritize walking tours, communal hostels' free tours, cafés with good wifi, safe transit, iconic landmarks (best done alone), local-recommended spots, social bars where it's easy to meet people. Avoid couples-only romantic dinners.",
    negocios: "BUSINESS TRAVELER: prioritize efficient itinerary near financial district / business hubs, quick high-quality lunches, iconic must-see in 1–2 hours blocks, executive dinners, fewer items per day with longer slots, transport that minimizes friction. No long beach days or full-day excursions unless weekend.",
  };

  // ── Perfilado por presupuesto ──────────────────────────────
  const budgetProfile: Record<string, string> = {
    economico: "$ BUDGET: free/cheap attractions (parks, free museum days, viewpoints), street food and mercados, hostels area, public transport only, $ restaurants. NEVER suggest $$$ or $$$$ venues unless it is a once-in-a-lifetime free-to-look attraction.",
    moderado: "$$ MODERATE: mainstream paid attractions, mid-range restaurants ($$), occasional $$$ highlight, mix of metro/walking/occasional taxi, mid-tier tours.",
    premium: "$$$ PREMIUM: skip-the-line tickets, guided private tours, $$$ restaurants, rooftop bars, premium experiences (helicopter ride, michelin lunch), taxi/uber comfort.",
    lujo: "ELITE LUXURY: private guides, Michelin-starred restaurants, $$$$ exclusively, private transfers, VIP/concierge experiences, after-hours private museum visits, luxury spa, helicopter, yacht. NEVER suggest $ or backpacker items.",
  };

  // ── Mapa de intereses → categorías a priorizar ─────────────
  const interestKeywords = form.interests.join(" ").toLowerCase();
  const focus: string[] = [];
  if (/historia|cultura|history|culture/.test(interestKeywords)) focus.push("historic monuments, old town, museums, cathedrals, palaces, ruins");
  if (/gastron|food/.test(interestKeywords)) focus.push("food markets, local specialty restaurants, food tours, cooking classes, tapas/street food crawls");
  if (/naturaleza|nature/.test(interestKeywords)) focus.push("parks, gardens, viewpoints, hikes, nature reserves, day trips to natural sites");
  if (/nocturna|night/.test(interestKeywords)) focus.push("rooftop bars, clubs, live music venues, cabarets, late-night neighborhoods");
  if (/compras|shopping/.test(interestKeywords)) focus.push("shopping streets, boutique districts, designer stores, flea markets, malls");
  if (/arte|museo|art/.test(interestKeywords)) focus.push("art museums, galleries, street art tours, contemporary art districts");
  if (/aventura|advent/.test(interestKeywords)) focus.push("adventure sports, kayak/bike/climbing, day-trip excursions, extreme activities");
  if (/fotograf|photo/.test(interestKeywords)) focus.push("most photogenic viewpoints, sunrise/sunset spots, scenic neighborhoods, Instagrammable cafés");
  if (/bienestar|wellness/.test(interestKeywords)) focus.push("spas, hammams, yoga studios, healthy restaurants, tranquil gardens");
  if (/familiar|family/.test(interestKeywords)) focus.push("child-friendly attractions, parks with playgrounds, interactive museums, easy walks");
  if (/playa|beach/.test(interestKeywords)) focus.push("nearest beaches, beach clubs, seafront promenades, coastal day trips");
  if (/deporte|sport/.test(interestKeywords)) focus.push("stadium tours, local sport events in the dates, sport activities, fan zones");

  const tpKey = (form.travelerType || "pareja").toLowerCase();
  const bgKey = (form.budget || "moderado").toLowerCase();
  const travelerLine = travelerProfile[tpKey] || travelerProfile.pareja;
  const budgetLine = budgetProfile[bgKey] || budgetProfile.moderado;
  const focusLine = focus.length
    ? `MUST emphasize these categories (because the user picked those interests): ${focus.join(" | ")}.`
    : "No specific interests selected — balance culture, food and nature.";

  return `You are a SENIOR LOCAL TRAVEL EXPERT for ${form.city}, ${form.country}, with deep knowledge of the MOST EMBLEMATIC landmarks, traditional culture, popular festivals, iconic nightlife, top-rated venues from TripAdvisor / Google Maps / Yelp / Lonely Planet / official tourism boards, and what locals actually recommend. Generate a realistic, INSIDER-LEVEL itinerary in ${lang}.

TRIP:
- Destination: ${form.city}, ${form.country}
- Dates: ${dateStr} to ${dateEndStr} (${days} days, ${startMonth} ${startDay}–${endDay})
- Travelers: ${form.travelers} (${form.travelerType})
- Budget: ${form.budget}
- Interests: ${form.interests.join(", ")}
- Day window requested by the client: ${dayStart} → ${dayEnd}

=== PERSONALIZATION (CRITICAL — the SAME city must produce DIFFERENT itineraries for different traveler types / budgets / interests) ===

TRAVELER PROFILE — ${form.travelerType.toUpperCase()}:
${travelerLine}

BUDGET PROFILE — ${form.budget.toUpperCase()}:
${budgetLine}

INTEREST FOCUS:
${focusLine}

Hard personalization rules:
- At least 70% of items must clearly match the traveler profile + budget tier.
- The price tag "$ / $$ / $$$ / $$$$" of every item MUST be consistent with the budget profile above. A "economico" trip must NEVER recommend a $$$$ restaurant.
- The interests listed by the user MUST appear as the dominant themes across the days. If the user did NOT select an interest (e.g. "nightlife"), keep night items minimal.
- Do NOT produce a "generic top-10" itinerary; produce one that visibly reflects the combination above.

=== ABSOLUTE RULES ===

RULE 0 — DAY WINDOW (CRITICAL):
- EVERY day starts at ${dayStart} and ends at or before ${dayEnd}.
- The FIRST item of each day MUST start at ${dayStart} (or within 15 min after).
- The LAST real item MUST end on/before ${dayEnd}.
- Distribute items EVENLY across the window. Time slots MUST be DIFFERENT for each item of the same day — NEVER two items at the same time, NEVER two items at "10:00" on the same day. Spread them: e.g. 06:00, 08:00, 10:00, 12:30, 15:00, 17:30, 19:30, 21:30.
- Do NOT leave empty windows larger than 2.5 hours between items.
- If ${dayStart} is before 08:00, start with sunrise viewpoints / early markets / breakfast spots that genuinely open early.

RULE 1 — REAL OPENING HOURS (still apply within the day window):
- Museums/cultural sites: 09:00–17:00/18:00. Never start a museum visit after 16:00.
- Churches: 07:00–12:00 and 15:00–18:00.
- Morning markets: 06:00–13:00.
- Lunch: 12:00–15:30 ONLY. Dinner: 19:00–23:00 ONLY.
- Cafes/breakfast: 07:00–11:00.
- Parks/viewpoints: 06:00–20:00.
- Bars/nightlife: 20:00–02:00.
- Shopping: 10:00–20:00.

RULE 2 — RESTAURANTS MUST BE REAL, ABUNDANT AND ALIGNED TO BUDGET + ROUTE:
- Use ONLY restaurants that genuinely exist in ${form.city}, ${form.country}.
- Provide BETWEEN ${minResto} AND ${maxResto} restaurants total.
- For EACH day at least 3 options near that day's zones: breakfast/café, lunch, dinner.
- Cover ALL price tiers BUT bias the recommended ones to the budget profile.
- Each restaurant includes "dayHint" (1..${days}) and "mealHint" (breakfast|lunch|dinner|snack).

RULE 3 — EVENTS, FESTIVALS AND TRADITIONS:
- Populate "events" with the BEST of what is happening in ${form.city} between ${startMonth} ${startDay} and ${endDay}.
- Never leave "events" empty if the destination has known recurring traditions for ${startMonth}.

RULE 4 — EMBLEMATIC FIRST, NO REPEATED ZONES:
- Day 1 includes the SINGLE most iconic must-see of ${form.city}.
- For ANY city, NEVER skip the world-famous landmarks in favor of obscure ones.
- Assign a DIFFERENT primary sector to each day. NEVER repeat the same "zone" as primary on two days.
- Within a day, cluster items in the day's primary sector + 1 adjacent sector.
- Day 1 = most iconic cluster. Day 2 = second-most iconic. Etc.

RULE 5 — DAILY VOLUME AND REAL DISPLACEMENT:
- ${minItems}–${maxItems} REAL items per day (sights, food, events, night), distributed across the ${dayStart}–${dayEnd} window.
- Transport hops do NOT count as items.
- Each day MUST cover at least: early/morning + late morning + lunch + afternoon + late afternoon + evening/dinner + (if dayEnd >= 21:00) a night closer.
- All "time" values within a day MUST be unique and ordered ascending.

RULE 6 — ALTERNATIVES PER ACTIVITY (CRITICAL — used by the "Personalizar" UI):
- For EVERY item of type "sight", "food", "event", "beach" or "night", you MUST include 2 to 3 REAL alternatives in the "alternatives" array.
- Each alternative is a DIFFERENT real place in ${form.city} that the traveler could swap into the SAME time slot of the day (similar type and opening hours, similar walking distance from the day's zone, same budget tier).
- Alternatives MUST be different from the main suggestion and from the alternatives of other items.
- Each alternative has: name, description (1 sentence), type, duration, transport, transportTime, price, rating, tip.
- "transport" items do NOT need alternatives.

=== END RULES ===

Respond ONLY with valid JSON (no markdown, no backticks):

{
  "city": "${form.city}",
  "country": "${form.country}",
  "tagline": "short inspiring phrase max 10 words",
  "summary": "2-sentence trip overview reflecting traveler type + budget + interests",
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
          "tip": "insider tip",
          "alternatives": [
            { "name": "alt 1 real place", "description": "1 sentence", "type": "sight",
              "duration": "1h", "transport": "walking", "transportTime": "5 min",
              "price": "$$", "rating": "4.4", "tip": "why pick this one" },
            { "name": "alt 2 real place", "description": "1 sentence", "type": "sight",
              "duration": "1h 30min", "transport": "metro", "transportTime": "10 min",
              "price": "$$", "rating": "4.6", "tip": "why pick this one" }
          ]
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
- Items per day reflect the TRAVELER PROFILE and BUDGET PROFILE above.
- Day 1 includes the SINGLE most iconic must-see of ${form.city}.
- Every day starts at ${dayStart} and ends at/before ${dayEnd} with ${minItems}–${maxItems} real items at UNIQUE ascending times.
- "zone" is unique per day. "restaurants" has ${minResto}–${maxResto} entries with dayHint for every day.
- Every "sight"/"food"/"event"/"beach"/"night" item has 2–3 "alternatives" filled with real venues.
- "events" has ≥4 entries.`;
}
