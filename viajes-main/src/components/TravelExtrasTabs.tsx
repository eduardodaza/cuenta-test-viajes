// src/components/TravelExtrasTabs.tsx
// Drop-in component. Úsalo en la página de resultados del viaje, junto a la lista de hoteles.
//
// FIX recurrente (beta):
//   - Skyscanner solo recibe rutas /transport/flights/... cuando origin/dest son IATA reales.
//     Si el origen viene como texto libre o placeholder, cae a una página Skyscanner válida del destino.
//   - Rentalcars usa /search-results con locationName + fechas; evita NaN y formularios vacíos.
//   - Viator/GetYourGuide siempre reciben fechas y viajeros en la URL final.

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

/* ------------------------------ deep-link helpers ------------------------------ */
// Skyscanner usa YYMMDD en su URL canónica de búsqueda.
function toYYMMDD(d: string): string {
  const [y, m, dd] = d.split("-");
  return `${y.slice(2)}${m}${dd}`;
}

function ymdParts(d: string) {
  const [y, m, dd] = d.split("-");
  return { y, m, d: String(Number(dd)), mm: String(Number(m)) };
}

const CITY_IATA: Record<string, string> = {
  madrid: "MAD",
  barcelona: "BCN",
  paris: "PAR",
  london: "LON",
  londres: "LON",
  rome: "ROM",
  roma: "ROM",
  milan: "MIL",
  milano: "MIL",
  lisbon: "LIS",
  lisboa: "LIS",
  amsterdam: "AMS",
  berlin: "BER",
  miami: "MIA",
  "new york": "NYC",
  "nueva york": "NYC",
  bogota: "BOG",
  bogotá: "BOG",
  medellin: "MDE",
  medellín: "MDE",
  cali: "CLO",
  cartagena: "CTG",
  panama: "PTY",
  panamá: "PTY",
  cancun: "CUN",
  cancún: "CUN",
  mexico: "MEX",
  "ciudad de mexico": "MEX",
  "ciudad de méxico": "MEX",
  buenosaires: "BUE",
  "buenos aires": "BUE",
  lima: "LIM",
  santiago: "SCL",
  quito: "UIO",
};

function normalizeCityKey(value?: string): string {
  return (value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function cleanIata(value?: string, cityFallback?: string): string | undefined {
  const raw = (value || "").trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(raw)) return raw;
  const key = normalizeCityKey(cityFallback || value);
  return CITY_IATA[key] || CITY_IATA[key.replace(/\s+/g, "")];
}

function slug(value: string): string {
  return normalizeCityKey(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function buildSkyscannerUrl(opts: { from: string; to: string; originCity?: string; originIATA?: string; destIATA?: string; destCity: string; pax: number; }): string {
  const adults = Math.max(1, Number(opts.pax) || 1);
  const out = toYYMMDD(opts.from);
  const ret = toYYMMDD(opts.to);
  const origin = cleanIata(opts.originIATA, opts.originCity);
  const dest = cleanIata(opts.destIATA, opts.destCity);
  const common = `adults=${adults}&adultsv2=${adults}&cabinclass=economy&preferdirects=false&outboundaltsenabled=false&inboundaltsenabled=false&ref=home#/`;

  if (origin && dest) {
    return `https://www.skyscanner.net/transport/flights/${origin.toLowerCase()}/${dest.toLowerCase()}/${out}/${ret}/?${common}`;
  }

  if (dest) {
    const destSlug = slug(opts.destCity) || dest.toLowerCase();
    const monthView = `oym=${out.slice(0, 4)}&iym=${ret.slice(0, 4)}&selectedoday=${opts.from.slice(8, 10)}&selectediday=${opts.to.slice(8, 10)}&rtn=1&${common}`;
    return `https://www.skyscanner.net/transport/flights-to/${dest.toLowerCase()}/?${monthView}`;
  }

  const q = `${opts.originCity ? `${opts.originCity} to ` : ""}${opts.destCity} ${opts.from} ${opts.to} ${adults} adults`;
  return `https://www.skyscanner.net/?search=${encodeURIComponent(q)}`;
}

function buildGoogleFlightsUrl(opts: { from: string; to: string; originCity?: string; destCity: string; pax: number; }): string {
  const q = `Flights to ${opts.destCity}${opts.originCity ? ` from ${opts.originCity}` : ""} ${opts.from} ${opts.to} ${Math.max(1, Number(opts.pax) || 1)} adults`;
  return `https://www.google.com/travel/flights?q=${encodeURIComponent(q)}`;
}

function buildRentalcarsUrl(opts: { city: string; country?: string; from: string; to: string }): string {
  const a = ymdParts(opts.from);
  const b = ymdParts(opts.to);
  const locationName = [opts.city, opts.country].filter(Boolean).join(", ");
  const params = new URLSearchParams({
    locationName,
    dropLocationName: locationName,
    puDay: a.d,
    puMonth: a.mm,
    puYear: a.y,
    puHour: "10",
    puMinute: "0",
    doDay: b.d,
    doMonth: b.mm,
    doYear: b.y,
    doHour: "10",
    doMinute: "0",
    driversAge: "30",
    ftsType: "C",
    dropFtsType: "C",
  });
  return `https://www.rentalcars.com/search-results?${params.toString()}`;
}

function buildKayakCarsUrl(opts: { city: string; from: string; to: string }): string {
  return `https://www.kayak.com/cars/${encodeURIComponent(slug(opts.city))}/${opts.from}/${opts.to}`;
}

function buildViatorSearchUrl(opts: { city: string; from: string; to: string; pax: number; query?: string }): string {
  const params = new URLSearchParams({
    text: [opts.query, opts.city].filter(Boolean).join(" "),
    startDate: opts.from,
    endDate: opts.to,
    adult: String(Math.max(1, Number(opts.pax) || 1)),
    adults: String(Math.max(1, Number(opts.pax) || 1)),
  });
  return `https://www.viator.com/searchResults/all?${params.toString()}`;
}

function buildGetYourGuideSearchUrl(opts: { city: string; from: string; to: string; pax: number; query?: string }): string {
  const params = new URLSearchParams({
    q: [opts.query, opts.city].filter(Boolean).join(" "),
    date_from: opts.from,
    date_to: opts.to,
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
  } catch {
    return fallback;
  }
}

/* --------------------------------- component --------------------------------- */
export default function TravelExtrasTabs(props: Props) {
  const [tab, setTab] = useState<Tab>("flights");
  const [data, setData] = useState<ApiResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const qs = useMemo(() => {
    const p = new URLSearchParams({
      city: props.city,
      country: props.country,
      from: props.from,
      to: props.to,
      pax: String(props.pax ?? 1),
    });
    if (props.originCity) p.set("originCity", props.originCity);
    if (props.originIATA) p.set("originIATA", props.originIATA);
    if (props.destIATA)   p.set("destIATA", props.destIATA);
    return p.toString();
  }, [props]);

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

  // Deep-links calculados a partir de props del viaje (siempre vigentes).
  const trip = {
    skyscanner:   buildSkyscannerUrl({ from: props.from, to: props.to, originCity: props.originCity, originIATA: props.originIATA, destIATA: props.destIATA, destCity: props.city, pax: props.pax ?? 1 }),
    googleFlights:buildGoogleFlightsUrl({ from: props.from, to: props.to, originCity: props.originCity, destCity: props.city, pax: props.pax ?? 1 }),
    rentalcars:   buildRentalcarsUrl({ city: props.city, country: props.country, from: props.from, to: props.to }),
    kayakCars:    buildKayakCarsUrl({ city: props.city, from: props.from, to: props.to }),
    viator:       buildViatorSearchUrl({ city: props.city, from: props.from, to: props.to, pax: props.pax ?? 1 }),
    getYourGuide: buildGetYourGuideSearchUrl({ city: props.city, from: props.from, to: props.to, pax: props.pax ?? 1 }),
    city: props.city,
    from: props.from,
    to: props.to,
    pax: props.pax ?? 1,
  };

  return (
    <section className="mt-6 rounded-2xl border bg-white shadow-sm">
      <div className="flex gap-1 overflow-x-auto border-b p-2">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${
              tab === t.id ? "bg-black text-white" : "text-gray-600 hover:bg-gray-100"
            }`}
          >
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
  skyscanner: string;
  googleFlights: string;
  rentalcars: string;
  kayakCars: string;
  viator: string;
  getYourGuide: string;
  city: string;
  from: string;
  to: string;
  pax: number;
};

// Validamos las URLs que vienen del backend: si están vacías o son la home
// de Skyscanner/Rentalcars, las reemplazamos por el deep-link calculado.
function isUsefulUrl(u: string | undefined, host: string): boolean {
  if (!u) return false;
  try {
    const url = new URL(u);
    if (!url.hostname.includes(host)) return false;
    if (url.hostname.includes("skyscanner") && url.pathname.includes("/transport/flights/")) {
      const parts = url.pathname.split("/").filter(Boolean);
      const origin = parts[2] || "";
      const dest = parts[3] || "";
      return /^[a-z]{3}$/i.test(origin) && /^[a-z]{3}$/i.test(dest);
    }
    if (url.hostname.includes("rentalcars")) {
      return url.pathname.includes("search-results") && url.searchParams.has("locationName") && url.searchParams.has("puDay") && url.searchParams.has("doDay");
    }
    return url.pathname.length > 2 || url.searchParams.toString().length > 0;
  } catch { return false; }
}

function FlightsList({ items, trip }: { items: any[]; trip: TripLinks }) {
  if (!items.length) {
    // Aunque el backend no devuelva vuelos, mostramos los 2 buscadores con fechas pre-cargadas
    return (
      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <div className="font-semibold">Buscar vuelos con tus fechas</div>
          <div className="mt-1 text-sm text-gray-600">Skyscanner y Google Flights pre-rellenados con destino, fechas y pasajeros.</div>
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
        const gUrl = isUsefulUrl(f.bookUrl,    "google.com")     ? f.bookUrl    : trip.googleFlights;
        const sUrl = isUsefulUrl(f.bookUrlAlt, "skyscanner.")    ? f.bookUrlAlt : trip.skyscanner;
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
          <div className="mt-1 text-sm text-gray-600">Rentalcars y Kayak pre-rellenados con ciudad y fechas de recogida/devolución.</div>
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
        const rUrl = isUsefulUrl(c.bookUrl,    "rentalcars.") ? c.bookUrl    : trip.rentalcars;
        const kUrl = isUsefulUrl(c.bookUrlAlt, "kayak.")      ? c.bookUrlAlt : trip.kayakCars;
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
            <a className="rounded-lg border px-3 py-1.5 text-xs" href={t.rome2rio} target="_blank" rel="noreferrer">Rome2Rio</a>
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
