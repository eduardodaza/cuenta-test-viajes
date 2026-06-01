// src/components/ItineraryView.tsx
import React, { useState } from "react";
import type { ItineraryData, ItineraryDay, ItineraryItem, UserEdits, Locale, TripFormData } from "@/lib/types";
import { t } from "@/lib/i18n";
import TravelExtrasTabs from "@/components/TravelExtrasTabs";

const BADGE: Record<string, { label: string; bg: string; color: string }> = {
  sight:     { label: "sight",  bg: "#e8f5ef", color: "#0f6e56" },
  food:      { label: "food",   bg: "#faeeda", color: "#633806" },
  transport: { label: "move",   bg: "#f4f4f2", color: "#666" },
  event:     { label: "event",  bg: "#eeedfe", color: "#3c3489" },
  alert:     { label: "alert",  bg: "#fcebeb", color: "#a32d2d" },
  beach:     { label: "beach",  bg: "#e6f1fb", color: "#0c447c" },
  night:     { label: "night",  bg: "#1a1a30", color: "#bbb7ff" },
};

interface Props {
  data: ItineraryData;
  locale: Locale;
  onReset: () => void;
  form?: TripFormData | null;
}

export default function ItineraryView({ data, locale, onReset, form }: Props) {
  const [tab, setTab] = useState<"days" | "restaurants" | "events" | "hotels" | "extras" | "security">("days");
  const [openDays, setOpenDays] = useState<Set<number>>(new Set([0]));
  const [edits, setEdits] = useState<UserEdits>({});
  const [editModal, setEditModal] = useState<ItineraryItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editAltIdx, setEditAltIdx] = useState<number>(-1);

  function toggleDay(i: number) {
    setOpenDays(prev => {
      const s = new Set(prev);
      s.has(i) ? s.delete(i) : s.add(i);
      return s;
    });
  }

  function openEdit(item: ItineraryItem) {
    setEditModal(item);
    setEditName(edits[item.id]?.name ?? item.name);
    setEditNote(edits[item.id]?.note ?? "");
    setEditAltIdx(-1);
  }

  function saveEdit() {
    if (!editModal) return;
    const alt = editAltIdx >= 0 ? editModal.alternatives?.[editAltIdx] : undefined;
    setEdits(prev => ({
      ...prev,
      [editModal.id]: {
        name: alt ? alt.name : editName,
        note: editNote,
        replacement: alt,
      },
    }));
    setEditModal(null);
  }

  const tabs: { key: typeof tab; label: string }[] = [
    { key: "days",        label: `📅 ${t("days", locale)}` },
    { key: "restaurants", label: `🍽️ ${t("restaurants", locale)}` },
    { key: "events",      label: `🎭 ${t("events", locale)}` },
    { key: "hotels",      label: `🏨 Hotels` },
    { key: "extras",      label: `✈️ Vuelos · Autos · Tours` },
    { key: "security",    label: `🛡️ ${t("security", locale)}` },
  ];

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "0 16px 40px" }}>
      {/* Header */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div>
            <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, fontWeight: 500, color: "#1a1a18", margin: 0 }}>
              {data.city}, {data.country}
            </h2>
            {data.tagline && <p style={{ fontSize: 13, color: "#888", margin: "4px 0 0" }}>{data.tagline}</p>}
          </div>
          <button onClick={onReset} style={{ fontSize: 12, padding: "6px 12px", border: "1px solid #ede9e2", borderRadius: 8, background: "white", cursor: "pointer", color: "#666", whiteSpace: "nowrap" }}>
            ← {t("newSearch", locale)}
          </button>
        </div>

        {data.summary && (
          <p style={{ fontSize: 13, color: "#555", lineHeight: 1.6, margin: "12px 0 0", paddingTop: 12, borderTop: "1px solid #f0efea" }}>
            {data.summary}
          </p>
        )}
        {data.cityWikipediaExtract && (
          <p style={{ fontSize: 12, color: "#888", lineHeight: 1.6, margin: "8px 0 0", fontStyle: "italic" }}>
            {data.cityWikipediaExtract}
          </p>
        )}

        <div style={{ display: "flex", gap: 16, marginTop: 12, paddingTop: 12, borderTop: "1px solid #f0efea", flexWrap: "wrap" }}>
          {data.weather && (
            <div style={{ fontSize: 12, color: "#555" }}>
              🌤 {data.weather.maxTemp}° / {data.weather.minTemp}° · {data.weather.description}
            </div>
          )}
          {data.estimatedBudgetPerDay && (
            <div style={{ fontSize: 12, color: "#1a6b4a", fontWeight: 500 }}>
              💰 {data.estimatedBudgetPerDay} {t("perDayPerson", locale)}
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12, overflowX: "auto", paddingBottom: 4 }}>
        {tabs.map(tb => (
          <button key={tb.key} onClick={() => setTab(tb.key)}
            style={{
              padding: "7px 14px", fontSize: 12, borderRadius: 20, cursor: "pointer", whiteSpace: "nowrap",
              border: `1px solid ${tab === tb.key ? "#1a6b4a" : "#ede9e2"}`,
              background: tab === tb.key ? "#1a6b4a" : "white",
              color: tab === tb.key ? "white" : "#555",
              transition: "all 0.15s",
            }}>
            {tb.label}
          </button>
        ))}
      </div>

      {/* ── DAYS ── */}
      {tab === "days" && data.days?.map((day, di) => (
        <DayCard key={di} day={day} index={di} open={openDays.has(di)}
          onToggle={() => toggleDay(di)} edits={edits} onEdit={openEdit} locale={locale} />
      ))}

      {/* ── RESTAURANTS ── */}
      {tab === "restaurants" && (
        <RestaurantsPanel restaurants={data.restaurants} locale={locale} city={data.city} />
      )}

      {/* ── EVENTS ── */}
      {tab === "events" && (
        <div className="card">
          <h3 style={{ fontSize: 15, fontWeight: 500, marginBottom: 12 }}>🎭 {t("events", locale)}</h3>
          {data.events?.length ? data.events.map((ev, i) => (
            <div key={i} style={{ padding: "10px 0", borderBottom: i < data.events.length - 1 ? "1px solid #f0efea" : "none", display: "flex", gap: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: ev.type === "concert" ? "#e85d26" : ev.type === "permanent" ? "#1a6b4a" : "#7f77dd", marginTop: 5, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: "#1a1a18" }}>{ev.name}</div>
                <div style={{ fontSize: 12, color: "#3c3489", marginTop: 2 }}>📅 {ev.when} {ev.venue ? `· ${ev.venue}` : ""}</div>
                {ev.source && <div style={{ fontSize: 10, color: "#aaa", marginTop: 1 }}>via {ev.source}</div>}
                <div style={{ fontSize: 12, color: "#666", marginTop: 2, lineHeight: 1.5 }}>{ev.description}</div>
                <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap", alignItems: "center" }}>
                  <span style={{ fontSize: 11, background: "#eeedfe", color: "#3c3489", padding: "2px 8px", borderRadius: 8 }}>{ev.price}</span>
                  {ev.ticketUrl && (
                    <a href={ev.ticketUrl} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: 11, padding: "2px 10px", background: "#e85d26", color: "white", borderRadius: 8, textDecoration: "none" }}>
                      🎟 {t("bookNow", locale)} ↗
                    </a>
                  )}
                </div>
              </div>
            </div>
          )) : (
            <div style={{ textAlign: "center", color: "#888", padding: "1.5rem 0", fontSize: 13 }}>
              No se encontraron eventos publicados para estas fechas.
            </div>
          )}
        </div>
      )}

      {/* ── HOTELS ── */}
      {tab === "hotels" && (
        <div>
          <div className="card" style={{ marginBottom: 12, background: "#f8f7f4", border: "1px solid #ede9e2" }}>
            <p style={{ fontSize: 13, color: "#555", margin: 0, lineHeight: 1.6 }}>
              🏨 Busca y compara hoteles en <strong>{data.city}</strong> en las mejores plataformas. Haz clic en cualquier opción para ver disponibilidad y precios reales.
            </p>
          </div>
          {data.hotels && data.hotels.length > 0 ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {data.hotels.map((hotel, i) => {
                const platformColors: Record<string, { bg: string; color: string; border: string }> = {
                  "Booking.com":  { bg: "#003580", color: "white", border: "#003580" },
                  "Hotels.com":   { bg: "#d32d20", color: "white", border: "#d32d20" },
                  "Expedia":      { bg: "#1a1aff", color: "white", border: "#1a1aff" },
                  "Airbnb":       { bg: "#ff385c", color: "white", border: "#ff385c" },
                  "Trivago":      { bg: "#c8102e", color: "white", border: "#c8102e" },
                  "Kayak":        { bg: "#ff690f", color: "white", border: "#ff690f" },
                };
                const pc = platformColors[hotel.platform ?? ""] ?? { bg: "#1a6b4a", color: "white", border: "#1a6b4a" };
                return (
                  <a key={i} href={hotel.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", display: "block" }}>
                    <div style={{ border: `2px solid ${pc.border}`, borderRadius: 12, padding: "14px 16px", background: "white", transition: "transform 0.15s", cursor: "pointer" }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: pc.bg, marginBottom: 4 }}>{hotel.platform ?? hotel.name}</div>
                      <div style={{ fontSize: 11, color: "#888", marginBottom: 10 }}>{data.city}, {data.country}</div>
                      <div style={{ background: pc.bg, color: pc.color, borderRadius: 8, padding: "7px 12px", fontSize: 12, fontWeight: 500, textAlign: "center" }}>Buscar hoteles ↗</div>
                    </div>
                  </a>
                );
              })}
            </div>
          ) : (
            <div className="card" style={{ textAlign: "center", color: "#888", padding: "2rem" }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🏨</div>
              <div style={{ fontSize: 14 }}>Generando links de hoteles...</div>
            </div>
          )}
        </div>
      )}

      {/* ── EXTRAS: Vuelos / Autos / Transporte / Tours ── */}
      {tab === "extras" && (
        <TravelExtrasTabs
          city={form?.city ?? data.city}
          country={form?.country ?? data.country}
          from={form?.startDate ?? ""}
          to={form?.endDate ?? ""}
          pax={form?.travelers ?? 1}
        />
      )}

      {/* ── SECURITY ── */}
      {tab === "security" && (
        <div className="card">
          <h3 style={{ fontSize: 15, fontWeight: 500, marginBottom: 12 }}>🛡️ {t("security", locale)}</h3>
          {data.alerts?.map((al, i) => {
            const colors = { alto: "#e24b4a", medio: "#ef9f27", bajo: "#1a6b4a" };
            const badges = {
              alto: { bg: "#fcebeb", c: "#a32d2d", label: t("riskHigh", locale) },
              medio: { bg: "#faeeda", c: "#854f0b", label: t("riskMed", locale) },
              bajo: { bg: "#e8f5ef", c: "#0f6e56", label: t("riskLow", locale) },
            };
            const b = badges[al.level];
            return (
              <div key={i} style={{ padding: "10px 0", borderBottom: i < data.alerts.length - 1 ? "1px solid #f0efea" : "none", display: "flex", gap: 10 }}>
                <div style={{ width: 4, borderRadius: 2, background: colors[al.level], flexShrink: 0, alignSelf: "stretch" }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}>
                    {al.zone}
                    <span style={{ fontSize: 10, background: b.bg, color: b.c, padding: "1px 7px", borderRadius: 8 }}>{b.label}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "#555", marginTop: 3, lineHeight: 1.5 }}>{al.description}</div>
                  <div style={{ fontSize: 12, color: "#1a6b4a", marginTop: 4 }}>💡 {al.tip}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit modal */}
      {editModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="card" style={{ width: 420, maxWidth: "92%", maxHeight: "85vh", overflowY: "auto" }}>
            <h3 style={{ fontSize: 16, fontWeight: 500, marginBottom: 12 }}>✏️ Editar itinerario: {editModal.name}</h3>

            {editModal.alternatives && editModal.alternatives.length > 0 && (
              <div style={{ marginBottom: 14, padding: 10, background: "#f8f7f4", borderRadius: 8, border: "1px solid #ede9e2" }}>
                <label style={{ fontSize: 12, color: "#1a6b4a", fontWeight: 600, display: "block", marginBottom: 6 }}>
                  🔄 Reemplazar por una alternativa sugerida
                </label>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label style={{ display: "flex", gap: 6, alignItems: "flex-start", fontSize: 12, cursor: "pointer" }}>
                    <input type="radio" name="alt" checked={editAltIdx === -1} onChange={() => setEditAltIdx(-1)} />
                    <span style={{ color: "#555" }}>Mantener: <strong>{editModal.name}</strong></span>
                  </label>
                  {editModal.alternatives.map((a, i) => (
                    <label key={i} style={{ display: "flex", gap: 6, alignItems: "flex-start", fontSize: 12, cursor: "pointer", padding: 6, borderRadius: 6, background: editAltIdx === i ? "#e8f5ef" : "transparent" }}>
                      <input type="radio" name="alt" checked={editAltIdx === i} onChange={() => setEditAltIdx(i)} />
                      <span>
                        <strong>{a.name}</strong> {a.price && <span style={{ color: "#1a6b4a" }}>· {a.price}</span>} {a.rating && <span style={{ color: "#854f0b" }}>· ★ {a.rating}</span>}
                        <div style={{ color: "#666", marginTop: 2 }}>{a.description}</div>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>{t("placeName", locale)}</label>
              <input type="text" value={editName} onChange={e => setEditName(e.target.value)} disabled={editAltIdx >= 0}
                style={{ width: "100%", padding: "8px 10px", border: "1px solid #ede9e2", borderRadius: 8, fontSize: 13, opacity: editAltIdx >= 0 ? 0.5 : 1 }} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>{t("personalNote", locale)}</label>
              <textarea value={editNote} onChange={e => setEditNote(e.target.value)}
                style={{ width: "100%", padding: "8px 10px", border: "1px solid #ede9e2", borderRadius: 8, fontSize: 13, height: 70, resize: "vertical", fontFamily: "inherit" }} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setEditModal(null)}
                style={{ flex: 1, padding: 9, border: "1px solid #ede9e2", borderRadius: 8, background: "white", cursor: "pointer", fontSize: 13, color: "#666" }}>
                {t("cancel", locale)}
              </button>
              <button onClick={saveEdit}
                style={{ flex: 2, padding: 9, background: "#1a6b4a", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 500 }}>
                {t("saveChanges", locale)}
              </button>
            </div>
          </div>
        </div>
      )}

      {data.generatedBy && (
        <div style={{ fontSize: 10, color: "#ccc", textAlign: "center", marginTop: 16 }}>
          {data.generatedBy}
        </div>
      )}
    </div>
  );
}

// ── DayCard ───────────────────────────────────────────────────
function DayCard({ day, index, open, onToggle, edits, onEdit, locale }: {
  day: ItineraryDay; index: number; open: boolean;
  onToggle: () => void; edits: UserEdits;
  onEdit: (item: ItineraryItem) => void; locale: Locale;
}) {
  // Ruta del día en Google Maps: encadena todos los stops visitables (sights, food, events, beach, night)
  const routeStops = day.items.filter(it =>
    ["sight", "food", "event", "beach", "night"].includes(it.type)
  );
  const q = (s: string) => encodeURIComponent(s.trim());
  const waypoints = routeStops
    .map(it => it.lat && it.lon ? `${it.lat},${it.lon}` : q(`${it.name} ${day.zone ?? ""}`))
    .join("/");
  const routeUrl = routeStops.length >= 2
    ? `https://www.google.com/maps/dir/${waypoints}`
    : routeStops.length === 1
      ? `https://www.google.com/maps/search/?api=1&query=${q(`${routeStops[0].name} ${day.zone ?? ""}`)}`
      : null;

  return (
    <div className="card" style={{ marginBottom: 10, padding: 0, overflow: "hidden" }}>
      <div style={{ padding: "12px 16px", borderBottom: open ? "1px solid #f0efea" : "none", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <div onClick={onToggle} style={{ cursor: "pointer", flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 500, color: "#1a6b4a", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            {t("day", locale)} {day.dayNum} · {day.date}
          </div>
          <div style={{ fontSize: 14, fontWeight: 500, color: "#1a1a18", marginTop: 1 }}>{day.theme}</div>
          {day.zone && <div style={{ fontSize: 11, color: "#888", marginTop: 1 }}>📍 {day.zone}</div>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {routeUrl && (
            <a href={routeUrl} target="_blank" rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              style={{ fontSize: 10, padding: "4px 10px", background: "#1a6b4a", color: "white", borderRadius: 12, textDecoration: "none", fontWeight: 500, whiteSpace: "nowrap" }}>
              🗺 Ruta en Maps ↗
            </a>
          )}
          <span onClick={onToggle} style={{ fontSize: 18, color: "#aaa", transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s", cursor: "pointer" }}>⌄</span>
        </div>
      </div>

      {open && day.items.map(item => {
        const edit = edits[item.id] ?? {};
        const rep = edit.replacement;
        const displayItem: ItineraryItem = rep
          ? { ...item, name: rep.name, description: rep.description, type: (rep.type ?? item.type) as ItineraryItem["type"],
              duration: rep.duration ?? item.duration, transport: rep.transport ?? item.transport,
              transportTime: rep.transportTime ?? item.transportTime, price: rep.price ?? item.price,
              rating: rep.rating ?? item.rating, tip: rep.tip ?? item.tip, links: undefined, wikidataDescription: undefined, viatorUrl: undefined }
          : item;
        const name = edit.name ?? displayItem.name;
        const bd = BADGE[displayItem.type] ?? BADGE.sight;
        const isSight = displayItem.type === "sight" || displayItem.type === "beach" || displayItem.type === "event";
        return (
          <div key={item.id} className="tl-item">
            <div className="tl-time">{item.time}</div>
            <div className="tl-body">
              <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10, padding: "2px 8px", borderRadius: 10, marginBottom: 4, background: bd.bg, color: bd.color, fontWeight: 500 }}>
                {displayItem.type}
              </span>
              <div style={{ fontSize: 13, fontWeight: 500, color: "#1a1a18", marginBottom: 2 }}>{name}</div>
              <div style={{ fontSize: 12, color: "#666", lineHeight: 1.5 }}>{displayItem.description}</div>

              {displayItem.wikidataDescription && (
                <div style={{ fontSize: 11, color: "#777", marginTop: 4, fontStyle: "italic", lineHeight: 1.5 }}>📖 {displayItem.wikidataDescription}</div>
              )}
              {edit.note && (<div style={{ fontSize: 11, color: "#1a6b4a", marginTop: 4, padding: "4px 8px", background: "#e8f5ef", borderRadius: 6 }}>📝 {edit.note}</div>)}
              {displayItem.tip && (<div style={{ fontSize: 11, color: "#3c3489", marginTop: 4, padding: "3px 8px", background: "#eeedfe", borderRadius: 6 }}>💡 {displayItem.tip}</div>)}

              <div style={{ display: "flex", gap: 10, marginTop: 6, flexWrap: "wrap" }}>
                {displayItem.duration && <span style={{ fontSize: 11, color: "#888" }}>⏱ {displayItem.duration}</span>}
                {displayItem.transport && displayItem.type !== "transport" && <span style={{ fontSize: 11, color: "#888" }}>🚶 {displayItem.transport} {displayItem.transportTime ?? ""}</span>}
                {displayItem.rating && <span style={{ fontSize: 11, color: "#854f0b" }}>★ {displayItem.rating}</span>}
                {displayItem.price && <span style={{ fontSize: 11, color: "#1a6b4a", fontWeight: 500 }}>{displayItem.price}</span>}
              </div>

              {isSight && displayItem.links && (
                <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                  {displayItem.links.googleMaps && (<a href={displayItem.links.googleMaps} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, padding: "2px 8px", border: "1px solid #ddd", borderRadius: 6, textDecoration: "none", color: "#444", background: "#f9f9f9" }}>🗺 Maps</a>)}
                  {displayItem.links.tripAdvisor && (<a href={displayItem.links.tripAdvisor} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, padding: "2px 8px", border: "1px solid #ddd", borderRadius: 6, textDecoration: "none", color: "#444", background: "#f9f9f9" }}>⭐ TripAdvisor</a>)}
                  {displayItem.links.wikipedia && (<a href={displayItem.links.wikipedia} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, padding: "2px 8px", border: "1px solid #ddd", borderRadius: 6, textDecoration: "none", color: "#444", background: "#f9f9f9" }}>📚 Wikipedia</a>)}
                  {displayItem.viatorUrl && (<a href={displayItem.viatorUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, padding: "2px 8px", border: "1px solid #e85d26", borderRadius: 6, textDecoration: "none", color: "#e85d26", background: "#fdf0eb" }}>🎫 Reservar tour</a>)}
                </div>
              )}

              <button onClick={() => onEdit(item)}
                style={{ fontSize: 10, padding: "2px 8px", border: "1px solid #ede9e2", borderRadius: 6, background: "transparent", color: "#888", cursor: "pointer", marginTop: 8 }}>
                ✏️ Editar itinerario
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── RestaurantsPanel ──────────────────────────────────────────
function RestaurantsPanel({ restaurants, locale, city }: { restaurants: ItineraryData["restaurants"]; locale: Locale; city: string }) {
  const tiers = ["$", "$$", "$$$", "$$$$"] as const;
  const tierLabels: Record<string, string> = {
    "$": t("economico", locale), "$$": t("moderado", locale),
    "$$$": t("premium", locale), "$$$$": t("lujo", locale),
  };

  const all = restaurants ?? [];
  const byTier: Record<string, typeof all> = { "$": [], "$$": [], "$$$": [], "$$$$": [], other: [] };
  for (const r of all) {
    const key = r.priceRange?.trim() as string;
    if (byTier[key]) byTier[key].push(r);
    else byTier["other"].push(r);
  }
  byTier["$"] = [...byTier["$"], ...byTier["other"]];

  if (!all.length) {
    return (
      <div className="card" style={{ textAlign: "center", color: "#888", padding: "2rem" }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>🍽️</div>
        <div style={{ fontSize: 14 }}>No restaurant data available</div>
      </div>
    );
  }

  // Helpers para deep-links que SIEMPRE caen en el restaurante correcto
  const q = (s: string) => encodeURIComponent(s.trim());
  // Para portales tipo TheFork/Yelp el truco más robusto es usar Google
  // con "I'm feeling lucky" simulado (site:dominio + nombre + ciudad).
  const luckySearch = (site: string, name: string) =>
    `https://www.google.com/search?q=${q(`site:${site} ${name} ${city}`)}`;

  return (
    <>
      {tiers.map(tier => {
        const list = byTier[tier] ?? [];
        if (!list.length) return null;

        // Ruta sugerida del día: encadena los restaurantes del tier en Google Maps
        const routeWaypoints = list
          .map(r => `${r.name} ${r.address ?? ""} ${city}`.trim())
          .map(q).join("/");
        const routeUrl = `https://www.google.com/maps/dir/${routeWaypoints}`;

        return (
          <div key={tier} className="card" style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <h3 style={{ fontSize: 14, fontWeight: 500, margin: 0 }}>{tier} · {tierLabels[tier]}</h3>
              {list.length >= 2 && (
                <a href={routeUrl} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: 10, padding: "3px 10px", background: "#1a6b4a", color: "white", borderRadius: 12, textDecoration: "none", fontWeight: 500 }}>
                  🛣 Ruta sugerida ↗
                </a>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {list.map((r, i) => {
                // r.website y r.googleMapsUrl llegan de Google Places cuando hay key
                const website = (r as { website?: string }).website;
                const gMapsUrl = (r as { googleMapsUrl?: string }).googleMapsUrl
                  ?? `https://www.google.com/maps/search/?api=1&query=${q(`${r.name} ${r.address ?? ""} ${city}`)}`;
                const reviewsCount = (r as { reviewsCount?: number }).reviewsCount;

                return (
                  <div key={i} style={{ border: "1px solid #f0efea", borderRadius: 10, padding: "10px 12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "#1a1a18" }}>{r.name}</div>
                      <span style={{ fontSize: 11, color: "#1a6b4a", fontWeight: 500 }}>{r.priceRange}</span>
                    </div>
                    <div style={{ fontSize: 11, color: "#888", marginTop: 1 }}>{r.type}</div>
                    <div style={{ display: "flex", gap: 10, marginTop: 4, flexWrap: "wrap" }}>
                      {r.rating && <span style={{ fontSize: 11, color: "#854f0b" }}>★ {r.rating}{reviewsCount ? ` (${reviewsCount})` : ""}</span>}
                      {r.zone && <span style={{ fontSize: 11, color: "#888" }}>📍 {r.zone}</span>}
                    </div>
                    {r.specialty && <div style={{ fontSize: 11, color: "#666", marginTop: 3 }}>✦ {r.specialty}</div>}
                    {r.address && <div style={{ fontSize: 11, color: "#999", marginTop: 2 }}>🏠 {r.address}</div>}

                    {/* Botones — todos llegan SIEMPRE al restaurante correcto */}
                    <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                      <a href={gMapsUrl} target="_blank" rel="noopener noreferrer"
                        style={{ fontSize: 10, padding: "2px 8px", border: "1px solid #ddd", borderRadius: 6, textDecoration: "none", color: "#444", background: "#f9f9f9" }}>
                        🗺 Maps
                      </a>
                      {website && (
                        <a href={website} target="_blank" rel="noopener noreferrer"
                          style={{ fontSize: 10, padding: "2px 8px", border: "1px solid #1a6b4a", borderRadius: 6, textDecoration: "none", color: "#1a6b4a", background: "#e8f5ef", fontWeight: 500 }}>
                          🌐 Web oficial
                        </a>
                      )}
                      <a href={luckySearch("tripadvisor.com", r.name)} target="_blank" rel="noopener noreferrer"
                        style={{ fontSize: 10, padding: "2px 8px", border: "1px solid #ddd", borderRadius: 6, textDecoration: "none", color: "#444", background: "#f9f9f9" }}>
                        ⭐ TripAdvisor
                      </a>
                      <a href={luckySearch("yelp.com", r.name)} target="_blank" rel="noopener noreferrer"
                        style={{ fontSize: 10, padding: "2px 8px", border: "1px solid #ddd", borderRadius: 6, textDecoration: "none", color: "#444", background: "#f9f9f9" }}>
                        🍴 Yelp
                      </a>
                      <a href={luckySearch("thefork.com", r.name)} target="_blank" rel="noopener noreferrer"
                        style={{ fontSize: 10, padding: "2px 8px", border: "1px solid #00848a", borderRadius: 6, textDecoration: "none", color: "#00848a", background: "#f0fafa" }}>
                        🍽 TheFork
                      </a>
                    </div>
                    {r.source && <div style={{ fontSize: 10, color: "#bbb", marginTop: 6 }}>via {r.source}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </>
  );
}
