// src/components/Loader.tsx
import React, { useEffect, useState } from "react";
import type { Locale } from "@/lib/types";
import { t } from "@/lib/i18n";

interface Props {
  city: string;
  locale: Locale;
}

const STEPS_KEYS = [
  "loadingStep1",
  "loadingStep2",
  "loadingStep3",
  "loadingStep4",
  "loadingStep5",
];

export default function Loader({ city, locale }: Props) {
  const [current, setCurrent] = useState(0);
  const steps = STEPS_KEYS.map((k) => t(k, locale));

  useEffect(() => {
    const id = setInterval(() => {
      setCurrent((prev) => (prev < steps.length - 1 ? prev + 1 : prev));
    }, 1400);
    return () => clearInterval(id);
  }, [steps.length]);

  return (
    <div className="max-w-xl mx-auto px-6 py-20 md:py-28 animate-reveal">
      <div className="bg-white border border-border shadow-manifest p-8 md:p-10 rounded-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-accent via-primary to-background" />

        <div className="flex items-center gap-4 mb-8">
          <div className="relative size-3">
            <div className="absolute inset-0 rounded-full bg-primary animate-ping" />
            <div className="relative size-3 rounded-full bg-primary" />
          </div>
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-primary">
            {locale === "es" ? "Diseñando" : "Sequencing"}
          </span>
        </div>

        <h2 className="text-3xl md:text-4xl font-display italic leading-tight mb-2">
          {city}
        </h2>
        <p className="text-sm text-muted mb-8">{steps[current]}</p>

        <div className="space-y-3">
          {steps.map((step, i) => (
            <div
              key={i}
              className="flex items-center gap-3 text-sm font-mono"
            >
              <span
                className={`inline-block size-2 rounded-full transition-colors ${
                  i < current
                    ? "bg-accent"
                    : i === current
                    ? "bg-primary animate-pulse"
                    : "bg-border"
                }`}
              />
              <span
                className={
                  i < current
                    ? "text-foreground"
                    : i === current
                    ? "text-foreground"
                    : "text-muted/60"
                }
              >
                {String(i + 1).padStart(2, "0")} · {step}
              </span>
            </div>
          ))}
        </div>

        <p className="mt-10 text-[10px] text-muted uppercase tracking-[0.15em] font-mono text-center">
          {locale === "es"
            ? "Esto suele tardar entre 8 y 15 segundos"
            : "Usually takes 8–15 seconds"}
        </p>
      </div>
    </div>
  );
}
