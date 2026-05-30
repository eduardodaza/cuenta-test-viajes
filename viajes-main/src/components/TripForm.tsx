// src/components/TripForm.tsx
import React, { useState, useEffect } from "react";
import type { TripFormData, Budget, TravelerType, Locale } from "@/lib/types";
import { t } from "@/lib/i18n";

const INTERESTS = [
  "🏛️ Historia & Cultura", "🍽️ Gastronomía", "🌿 Naturaleza",
  "🎵 Vida nocturna", "🛍️ Compras", "🎨 Arte & Museos",
  "🧗 Aventura", "📷 Fotografía", "🧘 Bienestar", "👨‍👩‍👧 Familiar",
  "🏖️ Playas", "⚽ Deporte",
];

const BUDGETS: Budget[] = ["economico", "moderado", "premium", "lujo"];
const BUDGET_SHORT: Record<Budget, string> = {
  economico: "$", moderado: "$$", premium: "$$$", lujo: "ELITE",
};

interface Props {
  onSubmit: (data: TripFormData) => void;
  loading: boolean;
  locale: Locale;
  onLocaleChange?: (l: Locale) => void;
}

export default function TripForm({ onSubmit, loading, locale }: Props) {
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [travelers, setTravelers] = useState(2);
  const [travelerType, setTravelerType] = useState<TravelerType>("pareja");
  const [budget, setBudget] = useState<Budget>("moderado");
  const [interests, setInterests] = useState<string[]>([
    "🏛️ Historia & Cultura", "🍽️ Gastronomía",
  ]);
  const [dayStartTime, setDayStartTime] = useState("08:00");
  const [dayEndTime, setDayEndTime] = useState("23:00");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dateRange, setDateRange] = useState("");
  const [citySuggestions, setCitySuggestions] = useState<{ city: string; country: string }[]>([]);
  const [showCitySuggest, setShowCitySuggest] = useState(false);

  // Autocomplete de ciudad → autocompleta país. Usa Nominatim (gratis, sin key).
  // Si Nominatim falla o tarda, el usuario igual puede escribir manualmente.
  useEffect(() => {
    const q = city.trim();
    if (q.length < 2) { setCitySuggestions([]); return; }
    const ctrl = new AbortController();
    const tm = setTimeout(async () => {
      try {
        const url = `https://nominatim.openstreetmap.org/search?city=${encodeURIComponent(q)}&format=json&addressdetails=1&limit=6&accept-language=${locale}`;
        const res = await fetch(url, {
          signal: ctrl.signal,
          headers: { "Accept": "application/json" },
        });
        if (!res.ok) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data: any[] = await res.json();
        const seen = new Set<string>();
        const list: { city: string; country: string }[] = [];
        for (const r of data) {
          const a = r.address || {};
          const cityName = a.city || a.town || a.village || a.municipality || a.county || r.display_name?.split(",")[0];
          const countryName = a.country;
          if (!cityName || !countryName) continue;
          const k = `${cityName}|${countryName}`.toLowerCase();
          if (seen.has(k)) continue;
          seen.add(k);
          list.push({ city: cityName, country: countryName });
          if (list.length >= 6) break;
        }
        setCitySuggestions(list);
      } catch { /* silent */ }
    }, 300);
    return () => { ctrl.abort(); clearTimeout(tm); };
  }, [city, locale]);

  useEffect(() => {
    const today = new Date();
    const end = new Date(today);
    end.setDate(end.getDate() + 3);
    setStartDate(today.toISOString().split("T")[0]);
    setEndDate(end.toISOString().split("T")[0]);
  }, []);

  useEffect(() => {
    if (!startDate || !endDate) return;
    const sd = new Date(startDate + "T12:00:00");
    const ed = new Date(endDate + "T12:00:00");
    if (ed < sd) { setDateRange(""); return; }
    const days = Math.round((ed.getTime() - sd.getTime()) / 86400000) + 1;
    const fmt = (d: Date) =>
      d.toLocaleDateString(locale === "es" ? "es-ES" : "en-US", {
        day: "numeric", month: "short", year: "numeric",
      });
    setDateRange(`${fmt(sd)} → ${fmt(ed)} · ${days} ${days > 1 ? (locale === "es" ? "días" : "days") : locale === "es" ? "día" : "day"}`);
  }, [startDate, endDate, locale]);

  function toggleInterest(i: string) {
    setInterests((prev) => prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]);
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!city.trim()) errs.city = t("errorRequired", locale);
    if (!country.trim()) errs.country = t("errorRequired", locale);
    if (!startDate) errs.startDate = t("errorRequired", locale);
    if (!endDate) errs.endDate = t("errorRequired", locale);
    if (startDate && endDate && new Date(endDate) < new Date(startDate))
      errs.endDate = t("errorDateRange", locale);
    if (dayStartTime && dayEndTime && dayEndTime <= dayStartTime)
      errs.dayEndTime = locale === "es" ? "Debe ser posterior a la hora de inicio" : "Must be after start time";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    onSubmit({
      city, country, startDate, endDate, travelers, travelerType, budget, interests, locale,
      dayStartTime, dayEndTime,
    });
  }

  const tz = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC";

  return (
    <div className="bg-white border border-border shadow-manifest p-6 md:p-10 rounded-sm relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-accent via-primary to-background" />
      <div className="flex justify-between items-end mb-8 md:mb-10">
        <h2 className="text-sm font-mono uppercase tracking-widest">
          {locale === "es" ? "Manifiesto del viaje (v.01)" : "Trip Manifest (v.01)"}
        </h2>
        <span className="hidden sm:inline text-[10px] text-muted font-mono">{tz}</span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8 md:space-y-10">
        {/* Location */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8">
          <div className="space-y-2 relative">
            <label className="text-[10px] uppercase tracking-widest text-muted block">{t("city", locale)}</label>
            <input type="text" value={city}
              onChange={(e) => { setCity(e.target.value); setShowCitySuggest(true); }}
              onFocus={() => setShowCitySuggest(true)}
              onBlur={() => setTimeout(() => setShowCitySuggest(false), 200)}
              autoComplete="off"
              placeholder={locale === "es" ? "Ej. Barcelona" : "e.g. Kyoto"}
              className={`w-full text-xl md:text-2xl font-display italic bg-transparent border-b ${errors.city ? "border-red-500" : "border-border"} focus:border-primary outline-none py-2 transition-colors placeholder:text-foreground/30`} />
            {showCitySuggest && citySuggestions.length > 0 && (
              <ul className="absolute left-0 right-0 top-full z-30 bg-white border border-border shadow-lg max-h-64 overflow-auto text-sm">
                {citySuggestions.map((s, i) => (
                  <li key={i}
                    onMouseDown={(e) => { e.preventDefault(); setCity(s.city); setCountry(s.country); setShowCitySuggest(false); }}
                    className="px-3 py-2 cursor-pointer hover:bg-black/5">
                    <span className="font-medium">{s.city}</span>
                    <span className="text-muted"> · {s.country}</span>
                  </li>
                ))}
              </ul>
            )}
            {errors.city && <p className="text-red-600 text-[11px]">{errors.city}</p>}
          </div>
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-widest text-muted block">{t("country", locale)}</label>
            <input type="text" value={country} onChange={(e) => setCountry(e.target.value)}
              placeholder={locale === "es" ? "España" : "Japan"}
              autoComplete="off"
              className={`w-full text-xl md:text-2xl font-display italic bg-transparent border-b ${errors.country ? "border-red-500" : "border-border"} focus:border-primary outline-none py-2 transition-colors placeholder:text-foreground/30`} />
            {errors.country && <p className="text-red-600 text-[11px]">{errors.country}</p>}
          </div>
        </div>

        {/* Dates + travelers */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8">
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-widest text-muted block">{t("startDate", locale)}</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
              className="w-full text-sm font-mono border-b border-border py-2 bg-transparent outline-none focus:border-primary" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-widest text-muted block">{t("endDate", locale)}</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
              className="w-full text-sm font-mono border-b border-border py-2 bg-transparent outline-none focus:border-primary" />
            {errors.endDate && <p className="text-red-600 text-[11px]">{errors.endDate}</p>}
          </div>
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-widest text-muted block">{t("travelers", locale)}</label>
            <input type="number" min={1} max={20} value={travelers} onChange={(e) => setTravelers(Number(e.target.value))}
              className="w-full text-sm font-mono border-b border-border py-2 bg-transparent outline-none focus:border-primary" />
          </div>
        </div>

        {/* Horario del día */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8">
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-widest text-muted block">
              {locale === "es" ? "Hora de inicio del día" : "Day start time"}
            </label>
            <input type="time" value={dayStartTime} onChange={(e) => setDayStartTime(e.target.value)}
              className="w-full text-sm font-mono border-b border-border py-2 bg-transparent outline-none focus:border-primary" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-widest text-muted block">
              {locale === "es" ? "Hora de cierre del día" : "Day end time"}
            </label>
            <input type="time" value={dayEndTime} onChange={(e) => setDayEndTime(e.target.value)}
              className="w-full text-sm font-mono border-b border-border py-2 bg-transparent outline-none focus:border-primary" />
            {errors.dayEndTime && <p className="text-red-600 text-[11px]">{errors.dayEndTime}</p>}
          </div>
        </div>

        {dateRange && (
          <div className="font-mono text-[11px] text-muted -mt-4">
            🗓 {dateRange} · ⏰ {dayStartTime} → {dayEndTime}
          </div>
        )}

        {/* Style + budget */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
          <div className="space-y-4">
            <label className="text-[10px] uppercase tracking-widest text-muted block">{t("travelerType", locale)}</label>
            <div className="flex flex-wrap gap-2">
              {(["pareja", "familia", "amigos", "solo", "negocios"] as TravelerType[]).map((tt) => (
                <button type="button" key={tt} onClick={() => setTravelerType(tt)}
                  className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                    travelerType === tt ? "border-primary bg-primary text-white" : "border-border hover:border-primary"
                  }`}>{t(tt, locale)}</button>
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <label className="text-[10px] uppercase tracking-widest text-muted block">{t("budget", locale)}</label>
            <div className="grid grid-cols-4 gap-1">
              {BUDGETS.map((b) => (
                <button type="button" key={b} onClick={() => setBudget(b)} title={t(b, locale)}
                  className={`h-10 grid place-items-center border text-xs font-mono transition-colors ${
                    budget === b ? "border-primary bg-primary text-white" : "border-border hover:bg-black/5"
                  } ${b === "lujo" ? "text-[9px]" : ""}`}>
                  {BUDGET_SHORT[b]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Interests */}
        <div className="space-y-4">
          <label className="text-[10px] uppercase tracking-widest text-muted block">{t("interests", locale)}</label>
          <div className="flex flex-wrap gap-2">
            {INTERESTS.map((i) => {
              const on = interests.includes(i);
              return (
                <button type="button" key={i} onClick={() => toggleInterest(i)}
                  className={`px-4 py-2 text-xs rounded-full border transition-all ${
                    on ? "bg-accent text-white border-accent" : "bg-black/5 border-transparent hover:border-primary"
                  }`}>{i}</button>
              );
            })}
          </div>
        </div>

        <button type="submit" disabled={loading}
          className="w-full group relative overflow-hidden bg-foreground text-background py-5 md:py-6 flex items-center justify-center gap-4 hover:bg-accent transition-colors duration-500 disabled:opacity-60">
          <span className="font-mono text-sm uppercase tracking-[0.2em]">
            {locale === "es" ? "Diseñar mi viaje" : "Sequence my journey"}
          </span>
          <span className="text-lg group-hover:translate-x-1 transition-transform">→</span>
        </button>
      </form>

      <p className="mt-6 text-center text-[10px] text-muted uppercase tracking-[0.1em]">
        {locale === "es" ? "Resultados generados en ~10s con IA." : "Results generated in ~10s with AI."}
      </p>
    </div>
  );
}
