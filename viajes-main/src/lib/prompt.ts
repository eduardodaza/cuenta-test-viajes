// src/lib/prompt.ts
import type { TripFormData } from "./types";

// ── Shared context builder ────────────────────────────────────
function buildSharedContext(form: TripFormData) {
  const sd = new Date(form.startDate + "T12:00:00");
  const ed = new Date(form.endDate + "T12:00:00");
  const totalDays = Math.round((ed.getTime() - sd.getTime()) / 86400000) + 1;
  const locale = form.locale ?? "es";
  const lang =
    locale === "es" ? "Spanish" :
    locale === "fr" ? "French" :
    locale === "de" ? "German" :
    locale === "pt" ? "Portuguese" :
    locale === "it" ? "Italian" : "English";

  const dayStart = form.dayStartTime || "08:00";
  const dayEnd   = form.dayEndTime   || "23:00";
  const startMonth = sd.toLocaleString("en", { month: "long" });
  const startDay   = sd.getDate();
  const endDay     = ed.getDate();

  const travelerProfile: Record<string, string> = {
    pareja:   "ROMANTIC COUPLE: scenic viewpoints, sunset spots, intimate cafés, wine bars, candle-lit dinners, boutique experiences. AVOID kid parks or rowdy bars.",
    familia:  "FAMILY: child-friendly museums, parks, zoos/aquariums, family restaurants, short queues, dinner before 21:00. AVOID bars, cabarets.",
    amigos:   "FRIENDS: street food, markets, brewery tours, lively bars/clubs, group activities, iconic nightlife. Heavier night block.",
    solo:     "SOLO: walking tours, free tours, cafés with wifi, iconic landmarks, local spots, social bars.",
    negocios: "BUSINESS: efficient near business hubs, quick lunches, iconic sights 1-2h, executive dinners, low-friction transport.",
  };

  const budgetProfile: Record<string, string> = {
    economico: "$ BUDGET: free/cheap attractions, street food, public transport. NEVER $$$ or $$$$.",
    moderado:  "$$ MODERATE: mainstream paid attractions, mid-range restaurants, occasional $$$ highlight.",
    premium:   "$$$ PREMIUM: skip-the-line, private tours, $$$ restaurants, rooftop bars, taxis.",
    lujo:      "$$$$ LUXURY: private guides, Michelin restaurants, $$$$ only, private transfers, VIP.",
  };

  const interestKeywords = form.interests.join(" ").toLowerCase();
  const focus: string[] = [];
  if (/historia|cultura|history|culture/.test(interestKeywords)) focus.push("monuments, museums, cathedrals");
  if (/gastron|food/.test(interestKeywords))                     focus.push("food markets, local restaurants, food tours");
  if (/naturaleza|nature/.test(interestKeywords))                focus.push("parks, gardens, viewpoints");
  if (/nocturna|night/.test(interestKeywords))                   focus.push("rooftop bars, clubs, live music");
  if (/compras|shopping/.test(interestKeywords))                 focus.push("shopping streets, boutiques, flea markets");
  if (/arte|museo|art/.test(interestKeywords))                   focus.push("art museums, galleries, street art");
  if (/aventura|advent/.test(interestKeywords))                  focus.push("adventure sports, kayak/bike, excursions");
  if (/fotograf|photo/.test(interestKeywords))                   focus.push("photogenic viewpoints, sunrise/sunset spots");
  if (/bienestar|wellness/.test(interestKeywords))               focus.push("spas, yoga, healthy restaurants");
  if (/playa|beach/.test(interestKeywords))                      focus.push("beaches, beach clubs, seafront");
  if (/deporte|sport/.test(interestKeywords))                    focus.push("stadium tours, sport events");

  const tpKey = (form.travelerType || "pareja").toLowerCase();
  const bgKey = (form.budget || "moderado").toLowerCase();

  return {
    sd, ed, totalDays, lang, locale, dayStart, dayEnd,
    startMonth, startDay, endDay,
    travelerLine: travelerProfile[tpKey] || travelerProfile.pareja,
    budgetLine:   budgetProfile[bgKey]   || budgetProfile.moderado,
    focusLine: focus.length ? focus.join(", ") : "culture, food, nature",
  };
}

// ── Prompt para un lote de días (máx 6 días por llamada) ──────
// Usa formato compacto (1 frase de descripción, 1-2 alternativas)
// para caber en el límite de 8192 tokens de Groq free tier.
export function buildDaysBatchPrompt(form: TripFormData, fromDay: number, toDay: number): string {
  const ctx = buildSharedContext(form);
  const { sd, totalDays, lang, dayStart, dayEnd, startMonth, startDay, endDay,
          travelerLine, budgetLine, focusLine } = ctx;

  const batchCount = toDay - fromDay + 1;

  // Build date labels
  const dayLabels: string[] = [];
  for (let d = fromDay; d <= toDay; d++) {
    const dt = new Date(sd);
    dt.setDate(sd.getDate() + (d - 1));
    const locale = form.locale ?? "es";
    dayLabels.push(dt.toLocaleDateString(locale === "es" ? "es-ES" : locale, {
      weekday: "long", day: "numeric", month: "long",
    }));
  }

  // Build the zones note for continuity in later batches
  const laterBatchNote = fromDay > 1
    ? `Days 1–${fromDay - 1} already generated. Use DIFFERENT zones and DIFFERENT landmarks from earlier days. Do NOT repeat any POI used previously, not even inside "alternatives".`
    : `Day 1 MUST start with the #1 most iconic must-see of ${form.city} (e.g. Sagrada Família in Barcelona, Eiffel Tower in Paris, Colosseum in Rome).`;

  return `You are a SENIOR LOCAL TRAVEL EXPERT for ${form.city}, ${form.country}. Generate a schedule in ${lang}.

TRIP: ${form.city}, ${form.country} | ${totalDays} total days (${startMonth} ${startDay}–${endDay}) | ${form.travelers} (${form.travelerType}) | Budget: ${form.budget} | Interests: ${focusLine}
Day window: ${dayStart}–${dayEnd}
Traveler: ${travelerLine}
Budget: ${budgetLine}
${laterBatchNote}

RULES (all mandatory):
1. Generate ONLY days ${fromDay} to ${toDay}. Each day: 7–10 items.
2. Times: unique, ascending, evenly spread from ${dayStart} to ${dayEnd}. No gap > 2.5 hours.
3. Each day uses a UNIQUE zone/sector (different from every other day in the full trip).
4. HIERARCHY — CRITICAL: The PRIMARY "name" of every sight/event MUST be one of the top-tier iconic landmarks of ${form.city} (the ones any tourist guide lists in "top 10 must-see"). NEVER place a top-tier icon inside "alternatives" — icons go in the main slot. "alternatives" are SECONDARY options (lesser-known but quality picks in the same zone & budget). Example for Barcelona: Sagrada Família, Park Güell, Casa Batlló, La Pedrera (Casa Milà), Camp Nou, Tibidabo, Catedral, Casa Vicens, Palau de la Música, Mercat de la Boqueria, Barri Gòtic, Montjuïc → ALL these belong in PRIMARY slots across the trip, never as alternatives.
5. NO REPETITION: A POI used as PRIMARY or as ALTERNATIVE in any day CANNOT appear again in ANY other day (neither primary nor alternative). Each POI is unique across the entire trip.
6. Every sight/food/event/beach/night item: include "alternatives" array with 2 REAL alternatives (same zone, same budget tier, NEVER an iconic top-10 landmark).
7. Prices consistent with budget profile. Lunch 12:00–15:30. Dinner 19:00–23:00. Museums 09:00–17:00.
8. All places must be REAL venues that exist in ${form.city}.
9. description: 1 sentence only (keep tokens short). tip: max 10 words.

Respond ONLY with a valid JSON array (no markdown, no backticks, no explanation):
[
  {
    "dayNum": ${fromDay},
    "theme": "day theme",
    "date": "${dayLabels[0]}",
    "zone": "primary sector",
    "items": [
      {"id":"d${fromDay}i1","time":"${dayStart}","type":"sight","name":"Real Place","description":"One sentence.","duration":"1h 30min","transport":"metro","transportTime":"10 min","price":"$$","rating":"4.8","tip":"Book online","alternatives":[{"name":"Alt Place 1","description":"One sentence.","type":"sight","duration":"1h","transport":"walking","transportTime":"5 min","price":"$$","rating":"4.5","tip":"Why go"},{"name":"Alt Place 2","description":"One sentence.","type":"sight","duration":"1h","transport":"metro","transportTime":"8 min","price":"$$","rating":"4.4","tip":"Why go"}]},
      {"id":"d${fromDay}i2","time":"10:30","type":"food","name":"Real Café","description":"One sentence.","duration":"45min","transport":"walking","transportTime":"5 min","price":"$","rating":"4.3","tip":"Try croissant","alternatives":[{"name":"Alt Café","description":"One sentence.","type":"food","duration":"45min","transport":"walking","transportTime":"3 min","price":"$","rating":"4.2","tip":"Why go"}]},
      {"id":"d${fromDay}i3","time":"12:00","type":"sight","name":"Real Landmark","description":"One sentence.","duration":"2h","transport":"metro","transportTime":"10 min","price":"$$","rating":"4.7","tip":"Arrive early","alternatives":[{"name":"Alt Landmark","description":"One sentence.","type":"sight","duration":"1h 30min","transport":"walking","transportTime":"12 min","price":"$$","rating":"4.5","tip":"Why go"}]},
      {"id":"d${fromDay}i4","time":"14:30","type":"food","name":"Real Lunch","description":"One sentence.","duration":"1h","transport":"walking","transportTime":"5 min","price":"$$","rating":"4.6","tip":"Signature dish","alternatives":[{"name":"Alt Lunch","description":"One sentence.","type":"food","duration":"1h","transport":"walking","transportTime":"7 min","price":"$$","rating":"4.4","tip":"Why go"}]},
      {"id":"d${fromDay}i5","time":"16:30","type":"sight","name":"Real Afternoon","description":"One sentence.","duration":"1h 30min","transport":"walking","transportTime":"8 min","price":"$","rating":"4.5","tip":"Tip","alternatives":[{"name":"Alt Afternoon","description":"One sentence.","type":"sight","duration":"1h","transport":"walking","transportTime":"5 min","price":"$","rating":"4.3","tip":"Why go"}]},
      {"id":"d${fromDay}i6","time":"19:00","type":"food","name":"Real Dinner","description":"One sentence.","duration":"1h 30min","transport":"taxi","transportTime":"10 min","price":"$$$","rating":"4.7","tip":"Reserve ahead","alternatives":[{"name":"Alt Dinner","description":"One sentence.","type":"food","duration":"1h 30min","transport":"walking","transportTime":"10 min","price":"$$","rating":"4.5","tip":"Why go"}]},
      {"id":"d${fromDay}i7","time":"21:30","type":"night","name":"Real Bar/Night","description":"One sentence.","duration":"1h 30min","transport":"walking","transportTime":"5 min","price":"$$","rating":"4.4","tip":"Tip","alternatives":[{"name":"Alt Night","description":"One sentence.","type":"night","duration":"1h","transport":"walking","transportTime":"5 min","price":"$$","rating":"4.3","tip":"Why go"}]}
    ]
  }${batchCount > 1 ? `,
  {
    "dayNum": ${fromDay + 1},
    "theme": "theme for day ${fromDay + 1}",
    "date": "${dayLabels[1] ?? ""}",
    "zone": "DIFFERENT sector from day ${fromDay}",
    "items": [ /* same 7-10 items structure, different places and zone */ ]
  }` : ""}${batchCount > 2 ? `,
  {
    "dayNum": ${fromDay + 2},
    "theme": "theme for day ${fromDay + 2}",
    "date": "${dayLabels[2] ?? ""}",
    "zone": "DIFFERENT sector from days ${fromDay} and ${fromDay + 1}",
    "items": [ /* same 7-10 items structure, different places and zone */ ]
  }` : ""}
]`;
}

// ── Prompt para metadata: restaurants + events + header ───────
export function buildMetadataPrompt(form: TripFormData): string {
  const ctx = buildSharedContext(form);
  const { sd, ed, totalDays, lang, dayStart, dayEnd, startMonth, startDay, endDay,
          travelerLine, budgetLine } = ctx;
  const locale = ctx.locale;
  const dateStr    = sd.toLocaleDateString(locale === "es" ? "es-ES" : locale, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const dateEndStr = ed.toLocaleDateString(locale === "es" ? "es-ES" : locale, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const minResto = Math.max(9, totalDays * 3);
  const maxResto = Math.min(18, totalDays * 3 + 3);

  return `You are a local expert for ${form.city}, ${form.country}. Generate trip metadata in ${lang}.

TRIP: ${dateStr} to ${dateEndStr} (${totalDays} days, ${startMonth} ${startDay}–${endDay}) | ${form.travelers} (${form.travelerType}) | Budget: ${form.budget}
Traveler: ${travelerLine}
Budget: ${budgetLine}
Day window: ${dayStart}–${dayEnd}

Respond ONLY with a valid JSON object (no markdown, no backticks):
{
  "city": "${form.city}",
  "country": "${form.country}",
  "tagline": "inspiring phrase max 10 words",
  "summary": "2-sentence overview matching traveler + budget",
  "weather": {"maxTemp": 25, "minTemp": 15, "description": "weather for ${startMonth}"},
  "estimatedBudgetPerDay": "realistic range in local currency",
  "restaurants": [
    {"name":"Real Restaurant","type":"cuisine","priceRange":"$$","rating":"4.3","specialty":"dish","zone":"neighborhood","source":"TripAdvisor","address":"address if known","dayHint":1,"mealHint":"lunch"}
  ],
  "events": [
    {"name":"Real Event","type":"festival","when":"YYYY-MM-DD or recurrence","description":"1 sentence","price":"Free","venue":"Real Venue","source":"local"}
  ],
  "alerts": [
    {"level":"medio","zone":"zone","description":"safety note","tip":"practical tip"}
  ]
}

CONSTRAINTS:
- restaurants: exactly ${minResto}–${maxResto} real entries. dayHint 1..${totalDays}. At least 3/day (breakfast+lunch+dinner). Budget-consistent prices.
- events: ≥4 real entries. Include festivals/traditions in ${form.city} for ${startMonth}. Include iconic recurring shows if nothing special.
- alerts: 2–4 entries.
- All must be REAL places/events in ${form.city}, ${form.country}.`;
}

// ── Legacy single-call (kept, not used in main flow) ─────────
export function buildItineraryPrompt(form: TripFormData): string {
  const ctx = buildSharedContext(form);
  const { sd, totalDays, lang, dayStart, dayEnd, startMonth, startDay, endDay,
          travelerLine, budgetLine, focusLine } = ctx;
  const locale = ctx.locale;
  const firstDayLabel = sd.toLocaleDateString(locale === "es" ? "es-ES" : locale, { weekday: "long", day: "numeric", month: "long" });
  const minResto = Math.max(9, totalDays * 3);
  const maxResto = Math.min(18, totalDays * 3 + 3);

  return `You are a SENIOR LOCAL TRAVEL EXPERT for ${form.city}, ${form.country}. Generate in ${lang}.
TRIP: ${form.city} | ${totalDays} days (${startMonth} ${startDay}–${endDay}) | ${form.travelers} (${form.travelerType}) | Budget: ${form.budget} | Interests: ${focusLine} | Window: ${dayStart}→${dayEnd}
Traveler: ${travelerLine}
Budget: ${budgetLine}
RULES: Day1=#1 iconic must-see. Each day unique zone. 7–10 items/day, times unique ascending ${dayStart}→${dayEnd}, no gap >2.5h. HIERARCHY: top-tier iconic landmarks ALWAYS go in PRIMARY "name", NEVER inside "alternatives". NO POI REPETITION across days (not even in alternatives). Every sight/food/event/night: 2 SECONDARY alternatives (same zone & budget, never an iconic top-10). Budget-consistent prices. Lunch 12-15:30, Dinner 19-23. ${minResto}–${maxResto} restaurants with dayHint. ≥4 events. All places REAL in ${form.city}.
Respond ONLY valid JSON (no markdown):
{"city":"${form.city}","country":"${form.country}","tagline":"max 10 words","summary":"2 sentences","weather":{"maxTemp":25,"minTemp":15,"description":"weather"},"estimatedBudgetPerDay":"range","days":[{"dayNum":1,"theme":"theme","date":"${firstDayLabel}","zone":"sector","items":[{"id":"d1i1","time":"${dayStart}","type":"sight","name":"place","description":"1 sentence","duration":"1h 30min","transport":"metro","transportTime":"10 min","price":"$$","rating":"4.8","tip":"tip","alternatives":[{"name":"alt","description":"1 sentence","type":"sight","duration":"1h","transport":"walking","transportTime":"5 min","price":"$$","rating":"4.4","tip":"why"}]}]}],"restaurants":[{"name":"restaurant","type":"cuisine","priceRange":"$$","rating":"4.3","specialty":"dish","zone":"neighborhood","source":"TripAdvisor","address":"address","dayHint":1,"mealHint":"lunch"}],"events":[{"name":"event","type":"festival","when":"YYYY-MM-DD","description":"1 sentence","price":"Free","venue":"venue","source":"local"}],"alerts":[{"level":"medio","zone":"zone","description":"note","tip":"tip"}]}`;
}
