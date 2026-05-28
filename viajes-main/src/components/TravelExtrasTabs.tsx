// src/components/TravelExtrasTabs.tsx
// FIX (beta):
//  - Auto-detección del origen del cliente vía ipapi.co (gratis, sin key).
//  - Google Flights con URL estructurada (#flt=ORIG.DEST.YYYY-MM-DD*...).
//  - Skyscanner: solo /transport/flights/<from>/<to>/<YYMMDD>/<YYMMDD>/ cuando hay 2 IATAs reales.
//    Si falta origen tras la detección, abrimos buscador con hash destino (no más 404).
//  - Autos: usamos Booking.com Cars (resuelve texto libre) en lugar del /search-results de Rentalcars
//    que ya no funciona sin locationId. Conservamos Kayak como alternativa.

import { useEffect, useMemo, useState } from "react";

type Tab = "flights" | "cars" | "transport" | "tours";

type Props = {
  city: string;
  country: string;
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD
  originCity?: string;
  originIATA?: string;
  destIATA?: string;
  pax?: number;
};

type ApiResp = {
  meta: { sources: Record<string, string>; counts: Record<string, number> };
  flights: any[];
  cars: any[];
  transport: any[];
  tours: any[];
};

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "flights",   label: "Vuelos",     icon: "✈️" },
  { id: "cars",      label: "Autos",      icon: "🚗" },
  { id: "transport", label: "Transporte", icon: "🚕" },
  { id: "tours",     label: "Tours",      icon: "🎭" },
];

/* ------------------------------ helpers ------------------------------ */
function toYYMMDD(d: string): string {
  const [y, m, dd] = d.split("-");
  return `${y.slice(2)}${m}${dd}`;
}

const CITY_IATA: Record<string, string> = {
  madrid: "MAD", barcelona: "BCN", paris: "PAR", london: "LON", londres: "LON",
  rome: "ROM", roma: "ROM", milan: "MIL", milano: "MIL", lisbon: "LIS", lisboa: "LIS",
  amsterdam: "AMS", berlin: "BER", miami: "MIA", "new york": "NYC", "nueva york": "NYC",
  bogota: "BOG", "bogotá": "BOG", medellin: "MDE", "medellín": "MDE",
  cali: "CLO", cartagena: "CTG", panama: "PTY", "panamá": "PTY",
  cancun: "CUN", "cancún": "CUN", mexico: "MEX", "ciudad de mexico": "MEX", "ciudad de méxico": "MEX",
  "buenos aires": "BUE", lima: "LIM", santiago: "SCL", quito: "UIO",
  caracas: "CCS", guayaquil: "GYE", "san jose": "SJO", "san josé": "SJO",
  guatemala: "GUA", "san salvador": "SAL", tegucigalpa: "TGU", managua: "MGA",
  habana: "HAV", "la habana": "HAV", "santo domingo": "SDQ",
  toronto: "YTO", montreal: "YMQ", vancouver: "YVR",
  "los angeles": "LAX", chicago: "CHI", houston: "HOU", dallas: "DFW",
  orlando: "ORL", boston: "BOS", washington: "WAS", atlanta: "ATL",
  "san francisco": "SFO", seattle: "SEA", "las vegas": "LAS", denver: "DEN",
  frankfurt: "FRA", munich: "MUC", zurich: "ZRH", vienna: "VIE", viena: "VIE",
  praga: "PRG", prague: "PRG", dublin: "DUB", brussels: "BRU", bruselas: "BRU",
  estambul: "IST", istanbul: "IST", dubai: "DXB", "abu dhabi": "AUH",
  tokyo: "TYO", tokio: "TYO", "hong kong": "HKG", singapore: "SIN", singapur: "SIN",
  bangkok: "BKK", seoul: "SEL", seúl: "SEL", sydney: "SYD", melbourne: "MEL",
};

function normalizeCityKey(value?: string): string {
  return (value || "").trim().toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ");
}

function cleanIata(value?: string, cityFallback?: string): string | undefined {
  const raw = (value || "").trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(raw)) return raw;
  const key = normalizeCityKey(cityFallback || value);
  return CITY_IATA[key] || CITY_IATA[key.replace(/\s+/g, "")];
}

function slug(value: string): string {
  return normalizeCityKey(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/* ----------------------- deep-link builders ----------------------- */

// Skyscanner — solo emitimos la ruta canónica cuando hay 2 IATAs reales.
function buildSkyscannerUrl(opts: { from: string; to: string; originIATA?: string; destIATA?: string; originCity?: string; destCity: string; pax: number; }): string {
  const adults = Math.max(1, Number(opts.pax) || 1);
  const out = toYYMMDD(opts.from);
  const ret = toYYMMDD(opts.to);
  const origin = cleanIata(opts.originIATA, opts.originCity);
  const dest   = cleanIata(opts.destIATA,   opts.destCity);
  const common = `adults=${adults}&adultsv2=${adults}&cabinclass=economy&rtn=1`;

  if (origin && dest) {
    return `https://www.skyscanner.net/transport/flights/${origin.toLowerCase()}/${dest.toLowerCase()}/${out}/${ret}/?${common}`;
  }
  // Sin origen: buscador con destino preseleccionado (NO /flights-to/ que da 404).
  const q = `${opts.originCity ? `${opts.originCity} a ` : ""}${opts.destCity} ${opts.from} ${opts.to} ${adults} adultos`;
  return `https://www.skyscanner.net/?search=${encodeURIComponent(q)}`;
}

// Google Flights — URL estructurada que SÍ pre-rellena cuando hay 2 IATAs.
function buildGoogleFlightsUrl(opts: { from: string; to: string; originIATA?: string; destIATA?: string; originCity?: string; destCity: string; pax: number; }): string {
  const adults = Math.max(1, Number(opts.pax) || 1);
  const origin = cleanIata(opts.originIATA, opts.originCity);
  const dest   = cleanIata(opts.destIATA,   opts.destCity);
  if (origin && dest) {
    const hash = `#flt=${origin}.${dest}.${opts.from}*${dest}.${origin}.${opts.to};c:USD;e:1;sd:1;t:f;px:${adults}`;
    return `https://www.google.com/travel/flights?hl=es&curr=USD${hash}`;
  }
  const q = `Vuelos${opts.originCity ? ` desde ${opts.originCity}` : ""} a ${opts.destCity} ${opts.from} ${opts.to} ${adults} adultos`;
  return `https://www.google.com/travel/flights?q=${encodeURIComponent(q)}&hl=es&curr=USD`;
}

// Autos — Booking.com Cars (heredero de Rentalcars, acepta texto libre y SÍ devuelve resultados).
function buildBookingCarsUrl(opts: { city: string; country?: string; from: string; to: string }): string {
  const loc = [opts.city, opts.country].filter(Boolean).join(", ");
  const params = new URLSearchParams({
    ss: loc,
    pickup_query: loc,
    dropoff_query: loc,
    from_date: opts.from,
    from_time: "10:00",
    to_date: opts.to,
    to_time: "10:00",
    driver_age: "30",
    aid: "304142",
    lang: "es",
  });
  return `https://cars.booking.com/searchresults.html?${params.toString()}`;
}

function buildKayakCarsUrl(opts: { city: string; from: string; to: string }): string {
  return `https://www.kayak.com/cars/${encodeURIComponent(slug(opts.city))}/${opts.from}/${opts.to}`;
}

function buildViatorSearchUrl(opts: { city: string; from: string; to: string; pax: number; query?: string }): string {
  const params = new URLSearchParams({
    text: [opts.query, opts.city].filter(Boolean).join(" "),
    startDate: opts.from, endDate: opts.to,
    adult: String(Math.max(1, Number(opts.pax) || 1)),
    adults: String(Math.max(1, Number(opts.pax) || 1)),
  });
  return `https://www.viator.com/searchResults/all?${params.toString()}`;
}

function buildGetYourGuideSearchUrl(opts: { city: string; from: string; to: string; pax: number; query?: string }): string {
  const params = new URLSearchParams({
    q: [opts.query, opts.city].filter(Boolean).join(" "),
    date_from: opts.from, date_to: opts.to,
    participants: String(Math.max(1, Number(opts.pax) || 1)),
  });
  return `https://www.getyourguide.com/s/?${params.toString()}`;
}

function withTripParams(url: string | undefined, opts: { city: string; from: string; to: string; pax: number; query?: string; provider: "viator" | "gyg" }): string {
  const fallback = opts.provider === "viator" ? buildViatorSearchUrl(opts) : buildGetYourGuideSearchUrl(opts);
  if (!url) return fallback;
  try {
    const parsed = new URL(url);
    if (opts.provider === "viator" && parsed.hostname.includes("viator.")) {
      parsed.searchParams.set("startDate", opts.from);
      parsed.searchParams.set("endDate", opts.to);
      parsed.searchParams.set("adult", String(Math.max(1, Number(opts.pax) || 1)));
      parsed.searchParams.set("adults", String(Math.max(1, Number(opts.pax) || 1)));
      if (!parsed.searchParams.get("text") && opts.query) parsed.searchParams.set("text", [opts.query, opts.city].join(" "));
      return parsed.toString();
    }
    if (opts.provider === "gyg" && parsed.hostname.includes("getyourguide.")) {
      parsed.searchParams.set("date_from", opts.from);
      parsed.searchParams.set("date_to", opts.to);
      parsed.searchParams.set("participants", String(Math.max(1, Number(opts.pax) || 1)));
      if (!parsed.searchParams.get("q") && opts.query) parsed.searchParams.set("q", [opts.query, opts.city].join(" "));
      return parsed.toString();
    }
    return fallback;
  } catch { return fallback; }
}

/* --------------------------- component --------------------------- */
export default function TravelExtrasTabs(props: Props) {
  const [tab, setTab] = useState<Tab>("flights");
  const [data, setData] = useState<ApiResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-detección del ORIGEN si el padre no lo proveyó.
  const [autoOrigin, setAutoOrigin] = useState<{ city?: string; iata?: string }>({});
  useEffect(() => {
    if (props.originIATA || props.originCity) return;
    let alive = true;
    (async () => {
      try {
        const r = await fetch("https://ipapi.co/json/");
        if (!r.ok) return;
        const j = await r.json();
        const city: string | undefined = j.city;
        const iata = cleanIata(undefined, city);
        if (alive) setAutoOrigin({ city, iata });
      } catch { /* silencio: sigue con destino solamente */ }
    })();
    return () => { alive = false; };
  }, [props.originIATA, props.originCity]);

  const effOriginCity = props.originCity || autoOrigin.city;
  const effOriginIATA = props.originIATA || autoOrigin.iata;

  const qs = useMemo(() => {
    const p = new URLSearchParams({
      city: props.city, country: props.country,
      from: props.from, to: props.to,
      pax: String(props.pax ?? 1),
    });
    if (effOriginCity) p.set("originCity", effOriginCity);
    if (effOriginIATA) p.set("originIATA", effOriginIATA);
    if (props.destIATA) p.set("destIATA", props.destIATA);
    return p.toString();
  }, [props, effOriginCity, effOriginIATA]);

  useEffect(() => {
    let alive = true;
    setLoading(true); setError(null);
    fetch(`/api/travel-extras?${qs}`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then(j => { if (alive) setData(j); })
      .catch(e => { if (alive) setError(e.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [qs]);

  const trip = {
    skyscanner:    buildSkyscannerUrl({ from: props.from, to: props.to, originCity: effOriginCity, originIATA: effOriginIATA, destIATA: props.destIATA, destCity: props.city, pax: props.pax ?? 1 }),
    googleFlights: buildGoogleFlightsUrl({ from: props.from, to: props.to, originCity: effOriginCity, originIATA: effOriginIATA, destIATA: props.destIATA, destCity: props.city, pax: props.pax ?? 1 }),
    rentalcars:    buildBookingCarsUrl({ city: props.city, country: props.country, from: props.from, to: props.to }),
    kayakCars:     buildKayakCarsUrl({ city: props.city, from: props.from, to: props.to }),
    viator:        buildViatorSearchUrl({ city: props.city, from: props.from, to: props.to, pax: props.pax ?? 1 }),
    getYourGuide:  buildGetYourGuideSearchUrl({ city: props.city, from: props.from, to: props.to, pax: props.pax ?? 1 }),
    city: props.city, from: props.from, to: props.to, pax: props.pax ?? 1,
    originCity: effOriginCity, originIATA: effOriginIATA,
  };

  return (
    <section className="mt-6 rounded-2xl border bg-white shadow-sm">
      <div className="flex gap-1 overflow-x-auto border-b p-2">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${
              tab === t.id ? "bg-black text-white" : "text-gray-600 hover:bg-gray-100"
            }`}>
            <span>{t.icon}</span>{t.label}
            {data?.meta?.counts?.[t.id] != null && (
              <span className="ml-1 rounded-full bg-gray-200 px-2 text-xs text-gray-700">{data.meta.counts[t.id]}</span>
            )}
          </button>
        ))}
      </div>

      {(tab === "flights") && (
        <div className="px-4 pt-3 text-xs text-gray-500">
          Origen detectado: <b>{effOriginCity || "—"}{effOriginIATA ? ` (${effOriginIATA})` : ""}</b> · Destino: <b>{props.city}{props.destIATA ? ` (${props.destIATA})` : ""}</b>
        </div>
      )}

      <div className="p-4">
        {loading && <div className="py-10 text-center text-gray-500">Buscando opciones actualizadas…</div>}
        {error && <div className="py-10 text-center text-red-600">Error: {error}</div>}
        {!loading && !error && data && (
          <>
            {tab === "flights"   && <FlightsList   items={data.flights}   trip={trip} />}
            {tab === "cars"      && <CarsList      items={data.cars}      trip={trip} />}
            {tab === "transport" && <TransportList items={data.transport} />}
            {tab === "tours"     && <ToursList     items={data.tours}     trip={trip} />}
            <p className="mt-4 text-xs text-gray-400">
              Fuentes: {Object.entries(data.meta.sources).map(([k,v]) => `${k}:${v}`).join(" · ")}
            </p>
          </>
        )}
      </div>
    </section>
  );
}

/* --------------------------- subcomponents --------------------------- */

function Price({ p }: { p?: { amount?: number; currency?: string; estimated?: boolean } }) {
  if (!p?.amount) return null;
  return <span className="text-base font-semibold">{p.estimated ? "~" : ""}{p.currency || "USD"} {Math.round(p.amount)}</span>;
}
function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border p-4 hover:shadow-md transition">{children}</div>;
}
function Empty() { return <div className="py-10 text-center text-gray-500">Sin resultados.</div>; }

type TripLinks = {
  skyscanner: string; googleFlights: string; rentalcars: string; kayakCars: string;
  viator: string; getYourGuide: string;
  city: string; from: string; to: string; pax: number;
  originCity?: string; originIATA?: string;
};

function isUsefulUrl(u: string | undefined, host: string): boolean {
  if (!u) return false;
  try {
    const url = new URL(u);
    if (!url.hostname.includes(host)) return false;
    if (url.hostname.includes("skyscanner") && url.pathname.includes("/transport/flights/")) {
      const parts = url.pathname.split("/").filter(Boolean);
      return /^[a-z]{3}$/i.test(parts[2] || "") && /^[a-z]{3}$/i.test(parts[3] || "");
    }
    return url.pathname.length > 2 || url.searchParams.toString().length > 0;
  } catch { return false; }
}

function FlightsList({ items, trip }: { items: any[]; trip: TripLinks }) {
  const noOrigin = !trip.originIATA;
  if (!items.length) {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <div className="font-semibold">Buscar vuelos con tus fechas</div>
          <div className="mt-1 text-sm text-gray-600">
            {noOrigin ? "No detectamos un IATA de origen; los buscadores abrirán con tu destino y fechas para que elijas el aeropuerto de salida."
                     : "Google Flights y Skyscanner pre-rellenados con origen, destino, fechas y pasajeros."}
          </div>
          <div className="mt-3 flex gap-2">
            <a className="rounded-lg bg-black px-3 py-1.5 text-xs text-white" href={trip.googleFlights} target="_blank" rel="noreferrer">Google Flights ↗</a>
            <a className="rounded-lg border px-3 py-1.5 text-xs" href={trip.skyscanner} target="_blank" rel="noreferrer">Skyscanner ↗</a>
          </div>
        </Card>
      </div>
    );
  }
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {items.map((f, i) => {
        const gUrl = isUsefulUrl(f.bookUrl, "google.com") ? f.bookUrl : trip.googleFlights;
        const sUrl = isUsefulUrl(f.bookUrlAlt, "skyscanner.") ? f.bookUrlAlt : trip.skyscanner;
        return (
          <Card key={i}>
            <div className="flex items-center justify-between">
              <div className="font-semibold">{f.airline} {f.airlineCode ? `(${f.airlineCode})` : ""}</div>
              <Price p={f.price} />
            </div>
            <div className="mt-1 text-sm text-gray-600">
              {f.stops === 0 ? "Directo" : `${f.stops} escala(s)`} · {f.estDurationHrs ? `${f.estDurationHrs}h` : f.duration ?? ""}
            </div>
            {f.notes && <div className="mt-1 text-xs text-gray-500">{f.notes}</div>}
            <div className="mt-3 flex gap-2">
              <a className="rounded-lg bg-black px-3 py-1.5 text-xs text-white" href={gUrl} target="_blank" rel="noreferrer">Google Flights</a>
              <a className="rounded-lg border px-3 py-1.5 text-xs" href={sUrl} target="_blank" rel="noreferrer">Skyscanner</a>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function CarsList({ items, trip }: { items: any[]; trip: TripLinks }) {
  if (!items.length) {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <div className="font-semibold">Buscar autos con tus fechas</div>
          <div className="mt-1 text-sm text-gray-600">Booking Cars (red Rentalcars) y Kayak pre-rellenados con ciudad y fechas de recogida/devolución.</div>
          <div className="mt-3 flex gap-2">
            <a className="rounded-lg bg-black px-3 py-1.5 text-xs text-white" href={trip.rentalcars} target="_blank" rel="noreferrer">Rentalcars ↗</a>
            <a className="rounded-lg border px-3 py-1.5 text-xs" href={trip.kayakCars} target="_blank" rel="noreferrer">Kayak ↗</a>
          </div>
        </Card>
      </div>
    );
  }
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {items.map((c, i) => {
        // El bookUrl viejo apuntaba al /search-results roto: si es de rentalcars.com sin locationId, lo sustituimos.
        const rUrl = isUsefulUrl(c.bookUrl, "booking.com") ? c.bookUrl : trip.rentalcars;
        const kUrl = isUsefulUrl(c.bookUrlAlt, "kayak.") ? c.bookUrlAlt : trip.kayakCars;
        return (
          <Card key={i}>
            <div className="flex items-center justify-between">
              <div className="font-semibold">{c.company} · <span className="text-gray-500">{c.category}</span></div>
              <Price p={{ amount: c.price?.total, currency: c.price?.currency, estimated: true }} />
            </div>
            <div className="mt-1 text-sm text-gray-600">{c.exampleModel}</div>
            {c.pickupHint && <div className="text-xs text-gray-500">Retiro: {c.pickupHint}</div>}
            <div className="mt-1 text-xs text-gray-500">~USD {c.price?.perDay}/día</div>
            <div className="mt-3 flex gap-2">
              <a className="rounded-lg bg-black px-3 py-1.5 text-xs text-white" href={rUrl} target="_blank" rel="noreferrer">Rentalcars</a>
              <a className="rounded-lg border px-3 py-1.5 text-xs" href={kUrl} target="_blank" rel="noreferrer">Kayak</a>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function TransportList({ items }: { items: any[] }) {
  if (!items.length) return <Empty />;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {items.map((t, i) => (
        <Card key={i}>
          <div className="flex items-center justify-between">
            <div className="font-semibold">{t.name}</div>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs">{t.type}</span>
          </div>
          {t.estPriceUSD && <div className="mt-1 text-sm">~USD {t.estPriceUSD} por trayecto</div>}
          {t.coverage && <div className="text-xs text-gray-500">Cobertura: {t.coverage}</div>}
          {t.safetyTip && <div className="mt-1 text-xs text-amber-700">⚠ {t.safetyTip}</div>}
          <div className="mt-3 flex gap-2">
            {t.bookUrl && <a className="rounded-lg bg-black px-3 py-1.5 text-xs text-white" href={t.bookUrl} target="_blank" rel="noreferrer">Abrir app</a>}
            {t.rome2rio && <a className="rounded-lg border px-3 py-1.5 text-xs" href={t.rome2rio} target="_blank" rel="noreferrer">Rome2Rio</a>}
          </div>
        </Card>
      ))}
    </div>
  );
}

function ToursList({ items, trip }: { items: any[]; trip: TripLinks }) {
  if (!items.length) {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <div className="font-semibold">Buscar tours con tus fechas</div>
          <div className="mt-1 text-sm text-gray-600">Viator y GetYourGuide pre-rellenados con destino, fechas y viajeros.</div>
          <div className="mt-3 flex gap-2">
            <a className="rounded-lg bg-black px-3 py-1.5 text-xs text-white" href={trip.getYourGuide} target="_blank" rel="noreferrer">GetYourGuide ↗</a>
            <a className="rounded-lg border px-3 py-1.5 text-xs" href={trip.viator} target="_blank" rel="noreferrer">Viator ↗</a>
          </div>
        </Card>
      </div>
    );
  }
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {items.map((t, i) => {
        const query = t.title || t.category || "tours";
        const gygUrl = withTripParams(t.bookUrl,    { city: trip.city, from: trip.from, to: trip.to, pax: trip.pax, query, provider: "gyg" });
        const viatorUrl = withTripParams(t.bookUrlAlt, { city: trip.city, from: trip.from, to: trip.to, pax: trip.pax, query, provider: "viator" });
        return (
          <Card key={i}>
            <div className="flex items-center justify-between">
              <div className="font-semibold">{t.title}</div>
              <Price p={t.price} />
            </div>
            <div className="mt-1 text-xs text-gray-500">{t.category} · {t.durationHrs}h {t.bestTimeOfDay ? `· ${t.bestTimeOfDay}` : ""}</div>
            {t.whyIconic && <div className="mt-2 text-sm text-gray-700">{t.whyIconic}</div>}
            <div className="mt-3 flex gap-2">
              <a className="rounded-lg bg-black px-3 py-1.5 text-xs text-white" href={gygUrl} target="_blank" rel="noreferrer">GetYourGuide</a>
              <a className="rounded-lg border px-3 py-1.5 text-xs" href={viatorUrl} target="_blank" rel="noreferrer">Viator</a>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
