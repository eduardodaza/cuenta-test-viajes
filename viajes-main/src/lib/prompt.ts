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
    pareja:   "ROMANTIC COUPLE: scenic viewpoints, sunset spots, intimate cafés, wine bars, candle-lit dinners, boutique experiences, photo-worthy locations, couples spa/rooftop. AVOID kid parks or rowdy bars.",
    familia:  "FAMILY WITH KIDS: child-friendly museums, parks, zoos/aquariums, family restaurants, short queues, no late nightlife, dinner before 21:00. AVOID bars, cabarets, very long museum visits.",
    amigos:   "FRIENDS GROUP: street food, food markets, brewery tours, lively bars/clubs, group activities (kayak, bike, escape room), iconic nightlife. Heavier night block.",
    solo:     "SOLO TRAVELER: walking tours, free tours, cafés with wifi, safe transit, iconic landmarks, local spots, social bars. Avoid couples-only dinners.",
    negocios: "BUSINESS: efficient near financial district, quick lunches, iconic sights in 1-2h blocks, executive dinners, fewer items/day, low-friction transport. No full-day excursions.",
  };

  const budgetProfile: Record<string, string> = {
    economico: "$ BUDGET: free/cheap attractions, street food, public transport, $ restaurants. NEVER $$$ or $$$$ venues.",
    moderado:  "$$ MODERATE: mainstream paid attractions, mid-range $$  restaurants, occasional $$$ highlight, metro/walking.",
    premium:   "$$$ PREMIUM: skip-the-line, private tours, $$$ restaurants, rooftop bars, premium experiences, taxi/uber.",
    lujo:      "$$$$ LUXURY: private guides, Michelin restaurants, $$$$ only, private transfers, VIP/concierge, luxury spa.",
  };

  const interestKeywords = form.interests.join(" ").toLowerCase();
  const focus: string[] = [];
  if (/historia|cultura|history|culture/.test(interestKeywords)) focus.push("historic monuments, museums, cathedrals, palaces");
  if (/gastron|food/.test(interestKeywords))                     focus.push("food markets, local restaurants, food tours");
  if (/naturaleza|nature/.test(interestKeywords))                focus.push("parks, gardens, viewpoints, nature reserves");
  if (/nocturna|night/.test(interestKeywords))                   focus.push("rooftop bars, clubs, live music, late-night neighborhoods");
  if (/compras|shopping/.test(interestKeywords))                 focus.push("shopping streets, boutiques, flea markets");
  if (/arte|museo|art/.test(interestKeywords))                   focus.push("art museums, galleries, street art");
  if (/aventura|advent/.test(interestKeywords))                  focus.push("adventure sports, kayak/bike, excursions");
  if (/fotograf|photo/.test(interestKeywords))                   focus.push("photogenic viewpoints, sunrise/sunset spots, scenic cafés");
  if (/bienestar|wellness/.test(interestKeywords))               focus.push("spas, yoga, healthy restaurants, tranquil gardens");
  if (/playa|beach/.test(interestKeywords))                      focus.push("beaches, beach clubs, seafront promenades");
  if (/deporte|sport/.test(interestKeywords))                    focus.push("stadium tours, sport events, fan zones");

  const tpKey = (form.travelerType || "pareja").toLowerCase();
  const bgKey = (form.budget || "moderado").toLowerCase();

  return {
    sd, ed, totalDays, lang, dayStart, dayEnd,
    startMonth, startDay, endDay,
    travelerLine: travelerProfile[tpKey] || travelerProfile.pareja,
    budgetLine:   budgetProfile[bgKey]   || budgetProfile.moderado,
    focusLine: focus.length
      ? `Emphasize: ${focus.join(" | ")}.`
      : "Balance culture, food and nature.",
    minItems: 7,
    maxItems: 10,
  };
}

// ── Prompt para un lote de días ───────────────────────────────
// Genera SOLO el array "days" para los días fromDay..toDay (1-indexed).
export function buildDaysBatchPrompt(form: TripFormData, fromDay: number, toDay: number): string {
  const ctx = buildSharedContext(form);
  const { sd, totalDays, lang, dayStart, dayEnd, startMonth, startDay, endDay,
          travelerLine, budgetLine, focusLine, minItems, maxItems } = ctx;

  // Build date labels for each day in the batch
  const dayLabels: string[] = [];
  for (let d = fromDay; d <= toDay; d++) {
    const dt = new Date(sd);
    dt.setDate(sd.getDate() + (d - 1));
    const locale = form.locale ?? "es";
    dayLabels.push(dt.toLocaleDateString(locale === "es" ? "es-ES" : locale, {
      weekday: "long", day: "numeric", month: "long",
    }));
  }

  const batchSize = toDay - fromDay + 1;
  const exampleItems = `[
    {"id":"d${fromDay}i1","time":"${dayStart}","type":"sight","name":"REAL landmark","description":"2 sentences.","duration":"1h 30min","transport":"metro","transportTime":"10 min","price":"$$","rating":"4.8","tip":"insider tip","alternatives":[{"name":"Alt A","description":"1 sentence.","type":"sight","duration":"1h","transport":"walking","transportTime":"5 min","price":"$$","rating":"4.5","tip":"why"},{"name":"Alt B","description":"1 sentence.","type":"sight","duration":"1h","transport":"metro","transportTime":"8 min","price":"$$","rating":"4.4","tip":"why"}]},
    {"id":"d${fromDay}i2","time":"10:30","type":"food","name":"REAL café","description":"2 sentences.","duration":"1h","transport":"walking","transportTime":"5 min","price":"$","rating":"4.3","tip":"try X","alternatives":[{"name":"Alt C","description":"1 sentence.","type":"food","duration":"45min","transport":"walking","transportTime":"3 min","price":"$","rating":"4.2","tip":"why"}]},
    {"id":"d${fromDay}i3","time":"12:00","type":"sight","name":"REAL museum","description":"2 sentences.","duration":"2h","transport":"metro","transportTime":"10 min","price":"$$","rating":"4.7","tip":"book online","alternatives":[{"name":"Alt D","description":"1 sentence.","type":"sight","duration":"1h 30min","transport":"walking","transportTime":"12 min","price":"$$","rating":"4.5","tip":"why"}]},
    {"id":"d${fromDay}i4","time":"14:30","type":"food","name":"REAL lunch restaurant","description":"2 sentences.","duration":"1h 30min","transport":"walking","transportTime":"5 min","price":"$$","rating":"4.6","tip":"try X","alternatives":[{"name":"Alt E","description":"1 sentence.","type":"food","duration":"1h","transport":"walking","transportTime":"7 min","price":"$$","rating":"4.4","tip":"why"}]},
    {"id":"d${fromDay}i5","time":"16:30","type":"sight","name":"REAL afternoon sight","description":"2 sentences.","duration":"1h 30min","transport":"walking","transportTime":"8 min","price":"$","rating":"4.5","tip":"tip","alternatives":[{"name":"Alt F","description":"1 sentence.","type":"sight","duration":"1h","transport":"walking","transportTime":"5 min","price":"$","rating":"4.3","tip":"why"}]},
    {"id":"d${fromDay}i6","time":"19:00","type":"food","name":"REAL dinner spot","description":"2 sentences.","duration":"2h","transport":"taxi","transportTime":"10 min","price":"$$$","rating":"4.7","tip":"reserve","alternatives":[{"name":"Alt G","description":"1 sentence.","type":"food","duration":"1h 30min","transport":"walking","transportTime":"10 min","price":"$$","rating":"4.5","tip":"why"}]},
    {"id":"d${fromDay}i7","time":"21:30","type":"night","name":"REAL bar or viewpoint","description":"2 sentences.","duration":"1h 30min","transport":"walking","transportTime":"5 min","price":"$$","rating":"4.4","tip":"tip","alternatives":[{"name":"Alt H","description":"1 sentence.","type":"night","duration":"1h","transport":"walking","transportTime":"5 min","price":"$$","rating":"4.3","tip":"why"}]}
  ]`;

  const daySchemas = Array.from({ length: batchSize }, (_, i) => {
    const dn = fromDay + i;
    return `{"dayNum":${dn},"theme":"theme for day ${dn}","date":"${dayLabels[i]}","zone":"UNIQUE sector day ${dn} — different from all other days","items":/* ${minItems}-${maxItems} items, times evenly spread from ${dayStart} to ${dayEnd} */[]}`;
  }).join(",\n    ");

  return `You are a SENIOR LOCAL TRAVEL EXPERT for ${form.city}, ${form.country}. Generate a day-by-day schedule in ${lang}.

TRIP: ${form.city}, ${form.country} | ${totalDays} days total (${startMonth} ${startDay}–${endDay}) | ${form.travelers} travelers (${form.travelerType}) | Budget: ${form.budget} | Interests: ${form.interests.join(", ")}
Day window: ${dayStart} → ${dayEnd}

TRAVELER: ${travelerLine}
BUDGET: ${budgetLine}
FOCUS: ${focusLine}

RULES:
- Generate ONLY days ${fromDay} to ${toDay} of the full ${totalDays}-day trip.
- Each day: ${minItems}–${maxItems} items. Times UNIQUE and ascending from ${dayStart} to ${dayEnd}. Spread evenly, NO gap > 2.5h.
- Day ${fromDay} zone must be DIFFERENT from zones of other days. Each day covers a different primary sector.
${fromDay === 1 ? `- Day 1 MUST include the single most iconic must-see of ${form.city}.` : `- Day ${fromDay}+ continues from earlier days, uses DIFFERENT zones and landmarks.`}
- Every sight/food/event/beach/night item: 2–3 real alternatives (same zone, same budget tier).
- Price tags consistent with budget profile. At least 70% items match traveler profile.
- Lunch 12:00–15:30, Dinner 19:00–23:00, Museums 09:00–17:00, Bars 20:00–02:00.
- Use ONLY real places that exist in ${form.city}.

EXAMPLE of one day's items array (follow this structure exactly):
${exampleItems}

Respond ONLY with a valid JSON array (no markdown, no backticks) of ${batchSize} day object(s):
[
  ${daySchemas}
]`;
}

// ── Prompt para metadata (restaurants + events + alerts + header) ─
export function buildMetadataPrompt(form: TripFormData): string {
  const ctx = buildSharedContext(form);
  const { totalDays, lang, dayStart, dayEnd, startMonth, startDay, endDay,
          travelerLine, budgetLine } = ctx;

  const sd = new Date(form.startDate + "T12:00:00");
  const ed = new Date(form.endDate + "T12:00:00");
  const locale = form.locale ?? "es";
  const dateStr    = sd.toLocaleDateString(locale === "es" ? "es-ES" : locale, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const dateEndStr = ed.toLocaleDateString(locale === "es" ? "es-ES" : locale, { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const minResto = Math.max(9, totalDays * 3);
  const maxResto = Math.min(18, totalDays * 3 + 3);

  return `You are a local expert for ${form.city}, ${form.country}. Generate trip metadata in ${lang}.

TRIP: ${dateStr} to ${dateEndStr} (${totalDays} days) | ${form.travelers} (${form.travelerType}) | Budget: ${form.budget}
TRAVELER: ${travelerLine}
BUDGET: ${budgetLine}
Day window: ${dayStart}–${dayEnd}

Generate ONLY the following JSON object (no markdown, no backticks):
{
  "city": "${form.city}",
  "country": "${form.country}",
  "tagline": "inspiring phrase max 10 words",
  "summary": "2-sentence overview matching traveler type + budget + interests",
  "weather": {"maxTemp": 25, "minTemp": 15, "description": "weather for ${startMonth}"},
  "estimatedBudgetPerDay": "realistic range in local currency",
  "restaurants": [
    {
      "name": "real restaurant in ${form.city}",
      "type": "cuisine type",
      "priceRange": "$ or $$ or $$$ or $$$$",
      "rating": "4.3",
      "specialty": "signature dish",
      "zone": "neighborhood",
      "source": "TripAdvisor / Google Maps",
      "address": "real address if known",
      "dayHint": 1,
      "mealHint": "breakfast or lunch or dinner or snack"
    }
  ],
  "events": [
    {"name": "real event", "type": "festival or concert or permanent or sport or market", "when": "YYYY-MM-DD or recurrence", "description": "1-2 sentences", "price": "Free or $ or $$", "venue": "real venue", "source": "local"}
  ],
  "alerts": [
    {"level": "alto or medio or bajo", "zone": "zone name", "description": "safety note", "tip": "practical tip"}
  ]
}

CONSTRAINTS:
- restaurants: ${minResto}–${maxResto} entries. At least 3 per day (breakfast + lunch + dinner). dayHint 1..${totalDays}. Budget-aligned prices.
- events: ≥4 entries. Include festivals/traditions happening in ${form.city} in ${startMonth} (${startDay}–${endDay}). Include iconic recurring shows/nightlife if nothing special.
- alerts: 2–4 entries for ${form.city}.
- All restaurants and venues must be REAL places in ${form.city}, ${form.country}.`;
}

// ── Legacy single-call prompt (kept for fallback) ─────────────
export function buildItineraryPrompt(form: TripFormData): string {
  const ctx = buildSharedContext(form);
  const { sd, ed, totalDays, lang, dayStart, dayEnd, startMonth, startDay, endDay,
          travelerLine, budgetLine, focusLine, minItems, maxItems } = ctx;
  const locale = form.locale ?? "es";
  const dateStr    = sd.toLocaleDateString(locale === "es" ? "es-ES" : locale, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const dateEndStr = ed.toLocaleDateString(locale === "es" ? "es-ES" : locale, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const firstDayLabel = sd.toLocaleDateString(locale === "es" ? "es-ES" : locale, { weekday: "long", day: "numeric", month: "long" });
  const minResto = Math.max(9, totalDays * 3);
  const maxResto = Math.min(18, totalDays * 3 + 3);
  // suppress unused warning
  void ed;

  return `You are a SENIOR LOCAL TRAVEL EXPERT for ${form.city}, ${form.country}. Generate an itinerary in ${lang}.

TRIP: ${dateStr} to ${dateEndStr} (${totalDays} days, ${startMonth} ${startDay}–${endDay}) | ${form.travelers} (${form.travelerType}) | Budget: ${form.budget} | Interests: ${form.interests.join(", ")} | Day: ${dayStart}→${dayEnd}

TRAVELER: ${travelerLine}
BUDGET: ${budgetLine}
FOCUS: ${focusLine}

RULES: Day 1 = most iconic landmark. Each day unique zone. ${minItems}–${maxItems} items/day, times unique ascending ${dayStart}→${dayEnd}, no gap >2.5h. Every sight/food/event/night: 2–3 alternatives. Prices match budget. Lunch 12-15:30, Dinner 19-23. ${minResto}–${maxResto} restaurants with dayHint. ≥4 events. All places REAL in ${form.city}.

Respond ONLY valid JSON (no markdown):
{"city":"${form.city}","country":"${form.country}","tagline":"max 10 words","summary":"2 sentences","weather":{"maxTemp":25,"minTemp":15,"description":"weather"},"estimatedBudgetPerDay":"range","days":[{"dayNum":1,"theme":"theme","date":"${firstDayLabel}","zone":"sector","items":[{"id":"d1i1","time":"${dayStart}","type":"sight","name":"place","description":"2 sentences","duration":"1h 30min","transport":"metro","transportTime":"10 min","price":"$$","rating":"4.8","tip":"tip","alternatives":[{"name":"alt","description":"1 sentence","type":"sight","duration":"1h","transport":"walking","transportTime":"5 min","price":"$$","rating":"4.4","tip":"why"}]}]}],"restaurants":[{"name":"restaurant","type":"cuisine","priceRange":"$$","rating":"4.3","specialty":"dish","zone":"neighborhood","source":"TripAdvisor","address":"address","dayHint":1,"mealHint":"lunch"}],"events":[{"name":"event","type":"festival","when":"YYYY-MM-DD","description":"why","price":"Free","venue":"venue","source":"local"}],"alerts":[{"level":"medio","zone":"zone","description":"note","tip":"tip"}]}`;
}
