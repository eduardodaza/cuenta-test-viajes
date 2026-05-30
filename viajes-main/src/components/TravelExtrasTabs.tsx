// src/components/TravelExtrasTabs.tsx
// Drop-in component. Funciona para CUALQUIER ciudad (Madrid, París, Roma, NY, etc.)
// Cambios clave (beta):
//   - Skyscanner: solo /transport/flights/ con IATAs reales; si no, fallback a /flights/search.
//   - Booking.com Cars (más confiable que Rentalcars search-results, que requiere geolocation interna).
//   - Transport: NUNCA confía en bookUrl si parece hardcodeado a otra ciudad o no es URL válida.
//     Usa apps canónicas (Uber, Bolt, Free Now, Cabify, Lyft) + Google Maps Transit por ciudad.
//   - Auto-detección de origen vía ipapi (sin key).

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
function ymdParts(d: string) {
  const [y, m, dd] = d.split("-");
  return { y, m, d: String(Number(dd)), mm: String(Number(m)) };
}

const CITY_IATA: Record<string, string> = {
  madrid: "MAD", barcelona: "BCN", paris: "PAR", london: "LON", londres: "LON",
  rome: "ROM", roma: "ROM", milan: "MIL", milano: "MIL", lisbon: "LIS", lisboa: "LIS",
  amsterdam: "AMS", berlin: "BER", munich: "MUC", münchen: "MUC", vienna: "VIE", viena: "VIE",
  prague: "PRG", praga: "PRG", dublin: "DUB", zurich: "ZRH", zúrich: "ZRH",
  miami: "MIA", "new york": "NYC", "nueva york": "NYC", "los angeles": "LAX",
  chicago: "CHI", "san francisco": "SFO", boston: "BOS", "las vegas": "LAS",
  bogota: "BOG", "bogotá": "BOG", medellin: "MDE", "medellín": "MDE",
  cali: "CLO", cartagena: "CTG", panama: "PTY", "panamá": "PTY",
  cancun: "CUN", "cancún": "CUN", mexico: "MEX", "ciudad de mexico": "MEX", "ciudad de méxico": "MEX",
  guadalajara: "GDL", monterrey: "MTY",
  "buenos aires": "BUE", buenosaires: "BUE", lima: "LIM", santiago: "SCL", quito: "UIO",
  saopaulo: "SAO", "sao paulo": "SAO", "são paulo": "SAO", rio: "RIO", "rio de janeiro": "RIO",
  tokyo: "TYO", tokio: "TYO", osaka: "OSA", seoul: "SEL", seúl: "SEL",
  bangkok: "BKK", singapore: "SIN", singapur: "SIN", dubai: "DXB", istanbul: "IST", estambul: "IST",
};

function normalizeCityKey(value?: string): string {
  return (value || "").trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ");
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
function isValidHttpUrl(u?: string): boolean {
  if (!u) return false;
  try {
    const url = new URL(u);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch { return false; }
}

/* ------------------------------ deep-links ------------------------------ */
function buildSkyscannerUrl(opts: { from: string; to: string; originCity?: string; originIATA?: string; destIATA?: string; destCity: string; pax: number; }): string {
  const adults = Math.max(1, Number(opts.pax) || 1);
  const out = toYYMMDD(opts.from);
  const ret = toYYMMDD(opts.to);
  const origin = cleanIata(opts.originIATA, opts.originCity);
  const dest = cleanIata(opts.destIATA, opts.destCity);
  const common = `adults=${adults}&adultsv2=${adults}&cabinclass=economy&rtn=1&preferdirects=false&ref=home`;
  if (origin && dest) {
    return `https://www.skyscanner.net/transport/flights/${origin.toLowerCase()}/${dest.toLowerCase()}/${out}/${ret}/?${common}`;
  }
  // Fallback: página de búsqueda de Skyscanner (no la 404 /flights-to/)
  return `https://www.skyscanner.net/flights/search?adults=${adults}&from=${origin ?? ""}&to=${dest ?? ""}&depart=${opts.from}&return=${opts.to}`;
}

function buildGoogleFlightsUrl(opts: { from: string; to: string; originCity?: string; originIATA?: string; destCity: string; destIATA?: string; pax: number; }): string {
  const adults = Math.max(1, Number(opts.pax) || 1);
  const origin = opts.originIATA || opts.originCity || "";
  const dest = opts.destIATA || opts.destCity;
  // Hash deep-link estructurado: pre-rellena origen, destino, fechas y pasajeros.
  if (origin && /^[A-Z]{3}$/i.test(origin) && opts.destIATA) {
    const hash = `#flt=${origin.toUpperCase()}.${opts.destIATA.toUpperCase()}.${opts.from}*${opts.destIATA.toUpperCase()}.${origin.toUpperCase()}.${opts.to};c:USD;e:1;sd:1;t:f;px:${adults}`;
    return `https://www.google.com/travel/flights${hash}`;
  }
  const q = `Flights to ${dest}${origin ? ` from ${origin}` : ""} ${opts.from} ${opts.to} ${adults} adults`;
  return `https://www.google.com/travel/flights?q=${encodeURIComponent(q)}`;
}

// Booking.com Cars: acepta texto libre como ubicación y maneja bien fechas.
function buildBookingCarsUrl(opts: { city: string; country?: string; from: string; to: string }): string {
  const a = ymdParts(opts.from);
  const b = ymdParts(opts.to);
  const locationName = [opts.city, opts.country].filter(Boolean).join(", ");
  const params = new URLSearchParams({
    ss: locationName,
    pickup_date: opts.from,
    dropoff_date: opts.to,
    pickup_time: "10:00",
    dropoff_time: "10:00",
    driver_age: "30",
    "puYear": a.y, "puMonth": a.mm, "puDay": a.d, "puHour": "10", "puMinute": "0",
    "doYear": b.y, "doMonth": b.mm, "doDay": b.d, "doHour": "10", "doMinute": "0",
  });
  return `https://www.booking.com/cars/searchresults.html?${params.toString()}`;
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

/* ------------------- transporte: URLs canónicas por app ------------------- */
// Mapeamos por nombre de app a su URL oficial (sin importar la ciudad).
// El backend NO controla la app exacta que va a recomendar el LLM, así que aquí
// sanitizamos: si el bookUrl viene roto o hardcodeado a otra ciudad, lo reemplazamos.
const APP_URLS: Array<{ match: RegExp; url: string }> = [
  { match: /\buber\b/i,         url: "https://m.uber.com/" },
  { match: /\bbolt\b/i,         url: "https://bolt.eu/" },
  { match: /\bcabify\b/i,       url: "https://cabify.com/" },
  { match: /\bdidi\b/i,         url: "https://web.didiglobal.com/" },
  { match: /\bindrive|in.drive\b/i, url: "https://indrive.com/" },
  { match: /\blyft\b/i,         url: "https://www.lyft.com/" },
  { match: /\bfree.?now|mytaxi\b/i, url: "https://free-now.com/" },
  { match: /\bgrab\b/i,         url: "https://www.grab.com/" },
  { match: /\bola\b/i,          url: "https://www.olacabs.com/" },
  { match: /\bkakao.?t\b/i,     url: "https://kakaot.kakao.com/" },
  { match: /\bgett\b/i,         url: "https://gett.com/" },
  { match: /\b99\b/i,           url: "https://99app.com/" },
  { match: /\byandex\b/i,       url: "https://yandex.com/maps/" },
  { match: /\bcareem\b/i,       url: "https://www.careem.com/" },
];
function resolveTransportUrl(name: string, providedUrl: string | undefined, city: string, country?: string, type?: string): string {
  const normalizedName = normalizeCityKey(name);
  const normalizedType = normalizeCityKey(type);
  const officialTaxi = `https://www.google.com/maps/search/${encodeURIComponent(`Taxi oficial ${city} ${country || ""}`)}`;
  const airportTransfer = `https://www.google.com/search?q=${encodeURIComponent(`traslado aeropuerto oficial ${city} ${country || ""}`)}`;

  // Aerocity y TaxiMadrid han dado timeouts/certificados inválidos; nunca enlazamos directo a esos dominios.
  if (/aerocity|taxidemadrid|taxi de madrid|taxi.?madrid/.test(normalizedName)) {
    return normalizedType.includes("aerop") || normalizedName.includes("aerocity") ? airportTransfer : officialTaxi;
  }

  if (isValidHttpUrl(providedUrl)) {
    const parsed = new URL(providedUrl!);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    const u = providedUrl!.toLowerCase();
    const badDomains = ["aerocity.com", "taxidemadrid.com"];
    const isBlocked = badDomains.some(d => host === d || host.endsWith(`.${d}`));
    const cityKey = normalizeCityKey(city).replace(/\s+/g, "");
    const blacklist = ["madrid", "barcelona", "paris", "london", "roma", "rome", "berlin", "lisboa", "lisbon", "amsterdam"];
    const hardcodedToOther = blacklist.some(c => u.includes(c) && c !== cityKey && !u.includes(cityKey));
    if (!isBlocked && !hardcodedToOther) return providedUrl!;
  }

  for (const a of APP_URLS) {
    if (a.match.test(name)) return a.url;
  }
  if (normalizedType.includes("aerop") || normalizedName.includes("airport") || normalizedName.includes("aeropuerto")) return airportTransfer;
  if (normalizedType.includes("taxi") || normalizedName.includes("taxi")) return officialTaxi;
  if (/metro|bus|tranv|train|tren|transit|public|publico|público/.test(normalizedName + " " + normalizedType)) {
    return `https://www.google.com/maps/dir/?api=1&travelmode=transit&destination=${encodeURIComponent(`${city}, ${country || ""}`)}`;
  }
  return `https://www.google.com/maps/search/${encodeURIComponent(`${name || "transporte"} ${city} ${country || ""}`)}`;
}

/* --------------------------------- component --------------------------------- */
export default function TravelExtrasTabs(props: Props) {
  const [tab, setTab] = useState<Tab>("flights");
  const [data, setData] = useState<ApiResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoOrigin, setAutoOrigin] = useState<{ city?: string; iata?: string }>({});

  // Auto-detección de origen del navegador (solo si no vino en props).
  useEffect(() => {
    if (props.originCity || props.originIATA) return;
    let alive = true;
    fetch("https://ipapi.co/json/")
      .then(r => r.ok ? r.json() : null)
      .then(j => {
        if (!alive || !j) return;
        const city = j.city as string | undefined;
        const iata = cleanIata(undefined, city);
        setAutoOrigin({ city, iata });
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [props.originCity, props.originIATA]);

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
    skyscanner:   buildSkyscannerUrl({ from: props.from, to: props.to, originCity: effOriginCity, originIATA: effOriginIATA, destIATA: props.destIATA, destCity: props.city, pax: props.pax ?? 1 }),
    googleFlights:buildGoogleFlightsUrl({ from: props.from, to: props.to, originCity: effOriginCity, originIATA: effOriginIATA, destCity: props.city, destIATA: props.destIATA, pax: props.pax ?? 1 }),
    bookingCars:  buildBookingCarsUrl({ city: props.city, country: props.country, from: props.from, to: props.to }),
    kayakCars:    buildKayakCarsUrl({ city: props.city, from: props.from, to: props.to }),
    viator:       buildViatorSearchUrl({ city: props.city, from: props.from, to: props.to, pax: props.pax ?? 1 }),
    getYourGuide: buildGetYourGuideSearchUrl({ city: props.city, from: props.from, to: props.to, pax: props.pax ?? 1 }),
    city: props.city, from: props.from, to: props.to, pax: props.pax ?? 1,
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
              <span className="ml-1 rounded-full bg-gray-200 px-2 text-xs text-gray-700">
                {data.meta.counts[t.id]}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="p-4">
        {loading && <div className="py-10 text-center text-gray-500">Buscando opciones actualizadas…</div>}
        {error && <div className="py-10 text-center text-red-600">Error: {error}</div>}
        {!loading && !error && data && (
          <>
            {tab === "flights"   && <FlightsList   items={data.flights}   trip={trip} />}
            {tab === "cars"      && <CarsList      items={data.cars}      trip={trip} />}
            {tab === "transport" && <TransportList items={data.transport} city={props.city} country={props.country} />}
            {tab === "tours"     && <ToursList     items={data.tours}     trip={trip} />}
            <p className="mt-4 text-xs text-gray-400">
              Origen detectado: {effOriginCity || "—"}{effOriginIATA ? ` (${effOriginIATA})` : ""} ·
              Fuentes: {Object.entries(data.meta.sources).map(([k,v]) => `${k}:${v}`).join(" · ")}
            </p>
          </>
        )}
      </div>
    </section>
  );
}

/* ------------------------------ subcomponentes ----------------------------- */
function Price({ p }: { p?: { amount?: number; currency?: string; estimated?: boolean } }) {
  if (!p?.amount) return null;
  return (
    <span className="text-base font-semibold">
      {p.estimated ? "~" : ""}{p.currency || "USD"} {Math.round(p.amount)}
    </span>
  );
}
function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border p-4 hover:shadow-md transition">{children}</div>;
}

type TripLinks = {
  skyscanner: string; googleFlights: string;
  bookingCars: string; kayakCars: string;
  viator: string; getYourGuide: string;
  city: string; from: string; to: string; pax: number;
};

function FlightsList({ items, trip }: { items: any[]; trip: TripLinks }) {
  if (!items.length) {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <div className="font-semibold">Buscar vuelos con tus fechas</div>
          <div className="mt-1 text-sm text-gray-600">Google Flights y Skyscanner pre-rellenados con destino, fechas y pasajeros.</div>
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
      {items.map((f, i) => (
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
            <a className="rounded-lg bg-black px-3 py-1.5 text-xs text-white" href={trip.googleFlights} target="_blank" rel="noreferrer">Google Flights</a>
            <a className="rounded-lg border px-3 py-1.5 text-xs" href={trip.skyscanner} target="_blank" rel="noreferrer">Skyscanner</a>
          </div>
        </Card>
      ))}
    </div>
  );
}

function CarsList({ items, trip }: { items: any[]; trip: TripLinks }) {
  const card = (
    <Card>
      <div className="font-semibold">Buscar autos con tus fechas</div>
      <div className="mt-1 text-sm text-gray-600">Booking.com Cars y Kayak pre-rellenados con ciudad y fechas de recogida/devolución.</div>
      <div className="mt-3 flex gap-2">
        <a className="rounded-lg bg-black px-3 py-1.5 text-xs text-white" href={trip.bookingCars} target="_blank" rel="noreferrer">Booking Cars ↗</a>
        <a className="rounded-lg border px-3 py-1.5 text-xs" href={trip.kayakCars} target="_blank" rel="noreferrer">Kayak ↗</a>
      </div>
    </Card>
  );
  if (!items.length) return <div className="grid gap-3 md:grid-cols-2">{card}</div>;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {items.map((c, i) => (
        <Card key={i}>
          <div className="flex items-center justify-between">
            <div className="font-semibold">{c.company} · <span className="text-gray-500">{c.category}</span></div>
            <Price p={{ amount: c.price?.total, currency: c.price?.currency, estimated: true }} />
          </div>
          <div className="mt-1 text-sm text-gray-600">{c.exampleModel}</div>
          {c.pickupHint && <div className="text-xs text-gray-500">Retiro: {c.pickupHint}</div>}
          <div className="mt-1 text-xs text-gray-500">~USD {c.price?.perDay}/día</div>
          <div className="mt-3 flex gap-2">
            <a className="rounded-lg bg-black px-3 py-1.5 text-xs text-white" href={trip.bookingCars} target="_blank" rel="noreferrer">Booking Cars</a>
            <a className="rounded-lg border px-3 py-1.5 text-xs" href={trip.kayakCars} target="_blank" rel="noreferrer">Kayak</a>
          </div>
        </Card>
      ))}
    </div>
  );
}

function TransportList({ items, city, country }: { items: any[]; city: string; country?: string }) {
  if (!items.length) return <Empty />;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {items.map((t, i) => {
        const safeUrl = resolveTransportUrl(t.name || "", t.bookUrl, city, country, t.type);
        const rome2rio = `https://www.rome2rio.com/map/${encodeURIComponent(city)}`;
        return (
          <Card key={i}>
            <div className="flex items-center justify-between">
              <div className="font-semibold">{t.name}</div>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs">{t.type}</span>
            </div>
            {t.estPriceUSD && <div className="mt-1 text-sm">~USD {t.estPriceUSD} por trayecto</div>}
            {t.coverage && <div className="text-xs text-gray-500">Cobertura: {t.coverage}</div>}
            {t.safetyTip && <div className="mt-1 text-xs text-amber-700">⚠ {t.safetyTip}</div>}
            <div className="mt-3 flex gap-2">
              <a className="rounded-lg bg-black px-3 py-1.5 text-xs text-white" href={safeUrl} target="_blank" rel="noreferrer">Abrir app / web</a>
              <a className="rounded-lg border px-3 py-1.5 text-xs" href={rome2rio} target="_blank" rel="noreferrer">Rome2Rio</a>
            </div>
          </Card>
        );
      })}
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
        const gygUrl = withTripParams(t.bookUrl, { city: trip.city, from: trip.from, to: trip.to, pax: trip.pax, query, provider: "gyg" });
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

function Empty() {
  return <div className="py-8 text-center text-sm text-gray-500">Sin resultados para esta categoría.</div>;
}
