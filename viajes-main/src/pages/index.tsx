// src/pages/index.tsx
import React, { useState } from "react";
import Head from "next/head";
import type { TripFormData, ItineraryData, Locale } from "@/lib/types";
import TripForm from "@/components/TripForm";
import Loader from "@/components/Loader";
import ItineraryView from "@/components/ItineraryView";
import { t } from "@/lib/i18n";

type AppState = "form" | "loading" | "result";

const BLUEPRINTS = [
  { tag: "LISBON / PORTUGAL", title: "Siete colinas y bares con azulejos ocultos" },
  { tag: "SEOUL / SOUTH KOREA", title: "Neones digitales y dinastía Joseon" },
  { tag: "ROME / ITALY", title: "Concreto brutalista y carciofi alla giudia" },
];

export default function Home() {
  const [state, setState] = useState<AppState>("form");
  const [itinerary, setItinerary] = useState<ItineraryData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastForm, setLastForm] = useState<TripFormData | null>(null);
  const [locale, setLocale] = useState<Locale>("es");

  async function handleSubmit(form: TripFormData) {
    setLastForm(form);
    setLocale(form.locale);
    setState("loading");
    setError(null);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data: ItineraryData = await res.json();
      setItinerary(data);
      setState("result");
    } catch (err) {
      setError("Failed to generate itinerary. Please try again.");
      setState("form");
    }
  }

  function handleReset() {
    setState("form");
    setItinerary(null);
    setError(null);
  }

  return (
    <>
      <Head>
        <title>TripCraft AI — Itinerarios turísticos inteligentes</title>
        <meta
          name="description"
          content="Genera itinerarios turísticos personalizados con IA. Lugares, restaurantes, eventos y alertas de seguridad en segundos."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/20">
        {/* Header */}
        <nav className="sticky top-0 z-50 flex items-center justify-between px-6 md:px-8 py-5 bg-background/80 backdrop-blur-md border-b border-border">
          <div className="text-base md:text-xl font-semibold tracking-tighter flex items-center gap-2">
            <div className="size-3 bg-primary rounded-full" />
            TRIPCRAFT AI
          </div>
          <div className="flex items-center gap-6">
            <div className="flex bg-black/5 rounded-full p-1 text-[10px] font-mono">
              <button
                onClick={() => setLocale("es")}
                className={`px-3 py-1 rounded-full transition-colors ${
                  locale === "es" ? "bg-white shadow-sm" : "text-muted"
                }`}
              >
                ES
              </button>
              <button
                onClick={() => setLocale("en")}
                className={`px-3 py-1 rounded-full transition-colors ${
                  locale === "en" ? "bg-white shadow-sm" : "text-muted"
                }`}
              >
                EN
              </button>
            </div>
            <a
              href="#blueprints"
              className="hidden sm:inline text-sm font-medium hover:text-primary transition-colors uppercase tracking-widest"
            >
              {locale === "es" ? "Ejemplos" : "About"}
            </a>
          </div>
        </nav>

        {state === "form" && (
          <>
            <main className="max-w-7xl mx-auto px-6 md:px-8 py-12 md:py-16 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">
              {/* Hero */}
              <div className="lg:col-span-5 flex flex-col justify-center animate-reveal">
                <span className="font-mono text-xs uppercase tracking-[0.3em] text-primary mb-6">
                  {locale === "es" ? "El nuevo Grand Tour" : "The New Grand Tour"}
                </span>
                <h1 className="text-5xl md:text-6xl lg:text-7xl font-display italic leading-[0.9] text-balance mb-8">
                  {locale === "es" ? (
                    <>
                      Viajar es un <br />
                      <span className="text-accent">arte de llegar.</span>
                    </>
                  ) : (
                    <>
                      Travel is an <br />
                      <span className="text-accent">art of arrival.</span>
                    </>
                  )}
                </h1>
                <p className="text-lg text-muted max-w-[40ch] leading-relaxed mb-10">
                  {locale === "es"
                    ? "Nuestra IA no solo encuentra rutas; teje narrativas. Define tus parámetros y dejá que diseñemos tu próximo recuerdo."
                    : "Our AI doesn't just find routes; it crafts narratives. Define your parameters and let us sequence your next memory."}
                </p>

                <div className="hidden lg:block space-y-6">
                  <div className="flex items-start gap-4 p-4 border-l-2 border-primary/20">
                    <span className="font-mono text-[10px] py-1">01</span>
                    <div>
                      <p className="font-medium">
                        {locale === "es" ? "Síntesis curada" : "Curated synthesis"}
                      </p>
                      <p className="text-xs text-muted">
                        {locale === "es"
                          ? "Mezclando historia profunda con pulsos locales."
                          : "Merging historical depth with local pulses."}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4 p-4 border-l-2 border-primary/20">
                    <span className="font-mono text-[10px] py-1">02</span>
                    <div>
                      <p className="font-medium">
                        {locale === "es" ? "Día por día" : "Day by day"}
                      </p>
                      <p className="text-xs text-muted">
                        {locale === "es"
                          ? "Restaurantes, eventos y alertas de seguridad."
                          : "Restaurants, events and safety alerts."}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4 p-4 border-l-2 border-primary/20">
                    <span className="font-mono text-[10px] py-1">03</span>
                    <div>
                      <p className="font-medium">
                        {locale === "es" ? "Listo en segundos" : "Ready in seconds"}
                      </p>
                      <p className="text-xs text-muted">
                        {locale === "es"
                          ? "Personalizable después de generarlo."
                          : "Editable after generation."}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Form */}
              <div className="lg:col-span-7 animate-reveal [animation-delay:200ms]">
                <TripForm
                  onSubmit={handleSubmit}
                  loading={false}
                  locale={locale}
                  onLocaleChange={setLocale}
                />
                {error && (
                  <div className="mt-4 px-4 py-3 bg-red-50 border border-red-200 rounded-sm text-red-700 text-sm">
                    ⚠️ {error}
                  </div>
                )}
              </div>
            </main>

            {/* Blueprints */}
            <section id="blueprints" className="px-6 md:px-8 py-20 md:py-24 border-t border-border max-w-7xl mx-auto">
              <div className="flex items-baseline justify-between mb-12">
                <h3 className="text-3xl md:text-4xl font-display italic">
                  {locale === "es" ? "Itinerarios recientes." : "Recent blueprints."}
                </h3>
                <a href="#" className="text-xs font-mono uppercase border-b border-primary">
                  {locale === "es" ? "Ver archivo" : "View archive"}
                </a>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {BLUEPRINTS.map((b, i) => (
                  <div key={i} className="group cursor-pointer">
                    <div className="w-full aspect-[4/5] bg-gradient-to-br from-zinc-200 via-zinc-100 to-zinc-300 mb-4 overflow-hidden relative">
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-500" />
                      <div className="absolute bottom-4 left-4 font-mono text-[9px] uppercase tracking-widest text-foreground/40">
                        {String(i + 1).padStart(2, "0")} / 03
                      </div>
                    </div>
                    <p className="font-mono text-[10px] text-muted mb-1">{b.tag}</p>
                    <p className="text-lg font-display italic">{b.title}</p>
                  </div>
                ))}
              </div>
            </section>

            <footer className="px-6 md:px-8 py-10 border-t border-border max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3 text-xs font-mono text-muted uppercase tracking-widest">
              <span>© {new Date().getFullYear()} TripCraft AI</span>
              <span>{locale === "es" ? "Beta privada · v0.2" : "Private beta · v0.2"}</span>
            </footer>
          </>
        )}

        {state === "loading" && lastForm && (
          <Loader city={`${lastForm.city}, ${lastForm.country}`} locale={locale} />
        )}

        {state === "result" && itinerary && (
          <ItineraryView data={itinerary} locale={locale} onReset={handleReset} />
        )}
      </div>
    </>
  );
}
