// src/components/TravelExtrasTabs.tsx
// Drop-in component. Úsalo en la página de resultados del viaje, junto a la lista de hoteles.
//
// FIX (beta):
//   - Los botones de Vuelos (Skyscanner / Google Flights) y Autos (Rentalcars / Kayak)
//     ahora SIEMPRE se construyen con deep-links válidos a partir de las fechas, ciudad
//     y número de pasajeros del viaje. Si el backend devuelve una URL, se respeta;
//     si no, se usa el deep-link generado aquí. Así nunca aterrizan en la home.

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
  // d = "YYYY-MM-DD"
  const [y, m, dd] = d.split("-");
  return `${y.slice(2)}${m}${dd}`;
}
// Rentalcars y Kayak usan partes separadas.
function ymdParts(d: string) {
  const [y, m, dd] = d.split("-");
  return { y, m, d: dd };
}

function buildSkyscannerUrl(opts: { from: string; to: string; originIATA?: string; destIATA?: string; destCity: string; pax: number; }): string {
  const adults = Math.max(1, opts.pax || 1);
  const out = toYYMMDD(opts.from);
  const ret = toYYMMDD(opts.to);
  if (opts.originIATA && opts.destIATA) {
    return `https://www.skyscanner.net/transport/flights/${opts.originIATA.toLowerCase()}/${opts.destIATA.toLowerCase()}/${out}/${ret}/?adults=${adults}`;
  }
  // Sin IATA → buscador general por ciudad destino
  return `https://www.skyscanner.net/transport/flights-to/${encodeURIComponent(opts.destCity.toLowerCase().replace(/\s+/g, "-"))}/?adults=${adults}&iym=${out.slice(0,4)}&oym=${ret.slice(0,4)}`;
}

function buildGoogleFlightsUrl(opts: { from: string; to: string; originCity?: string; destCity: string; pax: number; }): string {
  const q = `Flights to ${opts.destCity}${opts.originCity ? ` from ${opts.originCity}` : ""} on ${opts.from} through ${opts.to} for ${Math.max(1, opts.pax || 1)} adults`;
  return `https://www.google.com/travel/flights?q=${encodeURIComponent(q)}`;
}

function buildRentalcarsUrl(opts: { city: string; from: string; to: string }): string {
  const a = ymdParts(opts.from);
  const b = ymdParts(opts.to);
  const params = new URLSearchParams({
    location: opts.city,
    driverage: "30",
    puDay: a.d, puMonth: a.m, puYear: a.y, puHour: "10", puMinute: "00",
    doDay: b.d, doMonth: b.m, doYear: b.y, doHour: "10", doMinute: "00",
  });
  return `https://www.rentalcars.com/en/search/?${params.toString()}`;
}

function buildKayakCarsUrl(opts: { city: string; from: string; to: string }): string {
  const city = encodeURIComponent(opts.city.toLowerCase().replace(/\s+/g, "-"));
  return `https://www.kayak.com/cars/${city}/${opts.from}/${opts.to}`;
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
    skyscanner:   buildSkyscannerUrl({ from: props.from, to: props.to, originIATA: props.originIATA, destIATA: props.destIATA, destCity: props.city, pax: props.pax ?? 1 }),
    googleFlights:buildGoogleFlightsUrl({ from: props.from, to: props.to, originCity: props.originCity, destCity: props.city, pax: props.pax ?? 1 }),
    rentalcars:   buildRentalcarsUrl({ city: props.city, from: props.from, to: props.to }),
    kayakCars:    buildKayakCarsUrl({ city: props.city, from: props.from, to: props.to }),
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
            {tab === "tours"     && <ToursList     items={data.tours} />}
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
};

// Validamos las URLs que vienen del backend: si están vacías o son la home
// de Skyscanner/Rentalcars, las reemplazamos por el deep-link calculado.
function isUsefulUrl(u: string | undefined, host: string): boolean {
  if (!u) return false;
  try {
    const url = new URL(u);
    if (!url.hostname.includes(host)) return false;
    // Si no tiene path significativo ni params, lo consideramos roto (home)
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

function ToursList({ items }: { items: any[] }) {
  if (!items.length) return <Empty />;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {items.map((t, i) => (
        <Card key={i}>
          <div className="flex items-center justify-between">
            <div className="font-semibold">{t.title}</div>
            <Price p={t.price} />
          </div>
          <div className="mt-1 text-xs text-gray-500">{t.category} · {t.durationHrs}h {t.bestTimeOfDay ? `· ${t.bestTimeOfDay}` : ""}</div>
          {t.whyIconic && <div className="mt-2 text-sm text-gray-700">{t.whyIconic}</div>}
          <div className="mt-3 flex gap-2">
            <a className="rounded-lg bg-black px-3 py-1.5 text-xs text-white" href={t.bookUrl} target="_blank" rel="noreferrer">GetYourGuide</a>
            <a className="rounded-lg border px-3 py-1.5 text-xs" href={t.bookUrlAlt} target="_blank" rel="noreferrer">Viator</a>
          </div>
        </Card>
      ))}
    </div>
  );
}

function Empty() {
  return <div className="py-8 text-center text-sm text-gray-500">Sin resultados para esta categoría.</div>;
}
