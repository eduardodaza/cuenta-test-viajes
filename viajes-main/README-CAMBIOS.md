# Rediseño TripCraft AI — Manifesto expresivo

Cambios visuales basados en la dirección elegida (serif italic + naranja + fondo crema + tipografía mono para detalles editoriales).

## Archivos a reemplazar

Copiá estos archivos sobre los existentes en tu repo `eduardodaza/viajes`:

```
tailwind.config.js
src/styles/globals.css
src/pages/_app.tsx          (sin cambios funcionales, lo incluyo por completitud)
src/pages/index.tsx         ← landing con hero + form + sección "Recent blueprints"
src/components/TripForm.tsx ← reescrito en Tailwind, mismo contrato de props + nueva prop opcional locale/onLocaleChange
src/components/Loader.tsx   ← loader minimalista con timeline
```

**No tocado:** `src/components/ItineraryView.tsx`, `src/lib/*`, `src/pages/api/*`. Toda la lógica de IA, i18n y tipos sigue intacta.

> `ItineraryView` aún usa inline styles del diseño viejo. Funciona y se ve OK con el nuevo wrapper, pero si querés un pase visual también, decímelo y lo reescribo en una segunda iteración.

## Cambios principales

1. **Tailwind tokens nuevos** (`tailwind.config.js`): paleta `background / foreground / primary (naranja) / accent (índigo profundo) / muted`, fuentes `display: Cormorant Garamond`, `sans: Inter`, `mono: JetBrains Mono`, sombra `shadow-manifest`, animación `animate-reveal`.
2. **`globals.css`** importa Google Fonts y conserva las clases legacy (`.card`, `.chip`, `.tl-item`) que usa `ItineraryView` para no romperlo.
3. **`pages/index.tsx`** — antes era solo `<TripForm />` sobre fondo plano. Ahora es: nav sticky con switch ES/EN, hero a la izquierda con título serif italic, formulario tipo "manifest" a la derecha en card flotante, sección de itinerarios de ejemplo abajo, footer mono editorial.
4. **`TripForm.tsx`** — mismo `onSubmit(TripFormData)`, mismas validaciones y campos. Visual completamente nuevo: barra de acento superior, inputs con underline + serif italic para ciudad/país, presupuesto como grilla `$ $$ $$$ ELITE`, chips de intereses con estado activo en color `accent`.
5. **`Loader.tsx`** — ahora una card "Sequencing" con dot pulsante, lista de pasos numerados estilo terminal en lugar del spinner emoji original.

## Deploy a Vercel

Una vez commiteado y pusheado a `main`, Vercel rebuilea solo. No necesitás cambiar ninguna env var (`ANTHROPIC_API_KEY` etc. siguen igual).

```bash
git checkout -b redesign/manifesto
# copiar los archivos sobre el repo
git add .
git commit -m "feat(ui): manifesto redesign — hero + form + blueprints"
git push origin redesign/manifesto
# abrir PR o mergear directo a main
```
