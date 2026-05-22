# 🗺️ TripCraft AI

Generador automático de itinerarios turísticos con inteligencia artificial.
Multidioma · Multidestino · Listo para Vercel.

---

## 🚀 Stack técnico

| Capa | Tecnología |
|------|-----------|
| Framework | Next.js 14 (Pages Router) |
| Lenguaje | TypeScript |
| Estilos | Tailwind CSS + CSS-in-JS inline |
| IA principal | Anthropic Claude Sonnet (API) |
| Deploy | Vercel (gratuito en Hobby plan) |
| Idiomas | ES · EN · FR · DE · PT · IT |

---

## 📦 Instalación local

```bash
# 1. Clona el repositorio
git clone https://github.com/TU_USUARIO/tripcraft-ai.git
cd tripcraft-ai

# 2. Instala dependencias
npm install

# 3. Copia el archivo de variables de entorno
cp .env.example .env.local
# → Edita .env.local y añade tu ANTHROPIC_API_KEY

# 4. Inicia el servidor de desarrollo
npm run dev
# → Abre http://localhost:3000
```

---

## 🔑 Variables de entorno — Guía completa de APIs gratuitas

### ✅ OBLIGATORIA — Sin esta, la app no funciona

#### `ANTHROPIC_API_KEY`
**Motor de IA principal.** Genera el itinerario completo, textos, tiempos, rutas y alertas.
- **Registro:** https://console.anthropic.com/
- **Plan gratuito:** $5 USD de crédito al registrarse (~50–100 itinerarios)
- **Modelo usado:** `claude-sonnet-4-20250514`
- **Coste por itinerario:** ~$0.05–0.10 USD

---

### 🌤️ OPCIONAL GRATUITA — OpenWeather

#### `OPENWEATHER_API_KEY`
**Clima real para las fechas del viaje.**
- **Registro:** https://openweathermap.org/api → "Get API key"
- **Plan gratuito:** 1,000 llamadas/día, sin tarjeta de crédito
- **APIs usadas:**
  - `api.openweathermap.org/geo/1.0/direct` — geocodificación de ciudad
  - `api.openweathermap.org/data/2.5/forecast` — pronóstico 5 días
- **Sin esta key:** La app usa datos de clima generados por la IA (estimados)

---

### 🎫 OPCIONAL GRATUITA — Ticketmaster Discovery API

#### `TICKETMASTER_API_KEY`
**Conciertos, festivales y eventos reales en las fechas exactas.**
- **Registro:** https://developer.ticketmaster.com/ → "Get your API key"
- **Plan gratuito:** 5,000 llamadas/día, sin tarjeta de crédito
- **API usada:** `app.ticketmaster.com/discovery/v2/events.json`
- **Sin esta key:** La IA genera eventos basados en temporadas conocidas

---

### 📍 OPCIONAL (requiere tarjeta) — Google Places

#### `GOOGLE_PLACES_API_KEY`
**Ratings actualizados y direcciones reales de restaurantes.**
- **Registro:** https://console.cloud.google.com/ → APIs & Services → Credentials
- **Plan gratuito:** $200 USD de crédito mensual (suficiente para beta)
- **APIs a activar en Google Cloud Console:**
  - Places API (New)
  - Maps JavaScript API
  - Geocoding API
- **Sin esta key:** La app usa ratings generados por IA

> ⚠️ **Nota:** Google requiere tarjeta de crédito para verificación,
> pero el plan gratuito de $200/mes es suficiente para miles de búsquedas.

---

### ✈️ OPCIONAL GRATUITA — Amadeus Travel

#### `AMADEUS_CLIENT_ID` + `AMADEUS_CLIENT_SECRET`
**Precios de vuelos y hoteles (fase Alpha).**
- **Registro:** https://developers.amadeus.com/ → "Get started for free"
- **Plan gratuito (test):** Acceso a datos de prueba sin tarjeta
- **Plan production:** Gratuito hasta cierto volumen, luego pay-per-call
- **APIs útiles:**
  - `Flight Offers Search` — precios de vuelos
  - `Hotel List` — hoteles disponibles
  - `Points of Interest` — atracciones turísticas verificadas
- **Documentación:** https://developers.amadeus.com/self-service

---

### 🏨 OPCIONAL — Booking.com Affiliate

#### `BOOKING_AFFILIATE_ID` + `BOOKING_API_KEY`
**Disponibilidad y precios de hoteles con comisión (monetización).**
- **Registro:** https://www.booking.com/affiliate-program/v2/
- **Requisito:** Tráfico mínimo para ser aprobado como afiliado
- **Comisión:** 25–40% del ingreso de Booking por reserva
- **Alternativa gratuita:** Usar links de afiliado sin API

---

### 💳 FASE ALPHA — Stripe (pagos)

#### `STRIPE_SECRET_KEY` + `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
**Cobro por itinerarios premium, suscripciones, etc.**
- **Registro:** https://dashboard.stripe.com/register
- **Plan gratuito:** Sin cuota mensual, solo comisión por transacción (1.4% + 0.25€ en Europa)
- **Modo test:** Usa `sk_test_...` para pruebas sin dinero real
- **Documentación:** https://stripe.com/docs

---

## 🌐 Deploy en Vercel

### Método 1 — Desde GitHub (recomendado)

```bash
# 1. Sube el código a GitHub
git init
git add .
git commit -m "feat: initial TripCraft AI"
git remote add origin https://github.com/TU_USUARIO/tripcraft-ai.git
git push -u origin main
```

```
2. Ve a https://vercel.com/new
3. Importa tu repositorio de GitHub
4. En "Environment Variables", añade todas las keys del .env.example
5. Haz clic en "Deploy"
→ Tu app estará en https://tripcraft-ai.vercel.app en ~2 minutos
```

### Método 2 — Vercel CLI

```bash
npm i -g vercel
vercel login
vercel
# Sigue las instrucciones
# Para producción:
vercel --prod
```

### Variables de entorno en Vercel

```
Vercel Dashboard → Tu proyecto → Settings → Environment Variables
→ Añade cada variable del .env.example con su valor real
→ Aplica a: Production + Preview + Development
```

---

## 📁 Estructura del proyecto

```
tripcraft-ai/
├── src/
│   ├── components/
│   │   ├── TripForm.tsx         # Formulario de búsqueda
│   │   ├── Loader.tsx           # Pantalla de carga
│   │   └── ItineraryView.tsx    # Visualización del itinerario
│   ├── lib/
│   │   ├── types.ts             # Tipos TypeScript
│   │   ├── i18n.ts              # Traducciones (ES/EN/FR/DE/PT/IT)
│   │   └── prompt.ts            # Builder de prompts para Claude
│   ├── pages/
│   │   ├── api/
│   │   │   └── generate.ts      # API Route principal (server-side)
│   │   ├── _app.tsx
│   │   └── index.tsx            # Página principal
│   └── styles/
│       └── globals.css          # Estilos globales + Tailwind
├── public/
├── .env.example                 # Template de variables de entorno
├── .gitignore
├── next.config.js
├── package.json
├── tailwind.config.js
└── tsconfig.json
```

---

## 🗺️ Roadmap — Fase Alpha

### Funcionalidades pendientes
- [ ] Exportar itinerario a PDF
- [ ] Compartir itinerario por link
- [ ] Integración con Google Maps (mapa interactivo por día)
- [ ] Reservas de hotel via Amadeus / Booking
- [ ] Reservas de restaurante via TheFork API
- [ ] Compra de tickets de atracciones (GetYourGuide API)
- [ ] Suscripción premium con Stripe
- [ ] Login con Google (NextAuth.js)
- [ ] Guardado de itinerarios (base de datos)
- [ ] PWA / App móvil (Capacitor o React Native)

### APIs de monetización (fase Alpha)
| Servicio | API | Modelo |
|----------|-----|--------|
| GetYourGuide | https://partner.getyourguide.com/ | Comisión 8% |
| Viator | https://www.viator.com/partner/ | Comisión 8% |
| TheFork | https://partner.thefork.com/ | CPA por reserva |
| Rentalcars | https://www.rentalcars.com/affiliates/ | Comisión 5% |
| Airbnb | https://www.airbnb.com/affiliates | Comisión variable |

---

## 📄 Licencia

MIT — Libre para uso comercial y modificación.

---

Desarrollado con ❤️ · Powered by Claude AI
