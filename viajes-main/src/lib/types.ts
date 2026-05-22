// ─── Core itinerary types ──────────────────────────────────────

export interface ItineraryItem {
  id: string;
  time: string;
  type: "sight" | "food" | "transport" | "event" | "alert" | "beach" | "night";
  name: string;
  description: string;
  duration?: string;
  transport?: string;
  transportTime?: string;
  price?: string;
  rating?: string;
  tip?: string;
  bookingUrl?: string;
  wikidataDescription?: string;
  viatorUrl?: string;
  links?: {
    googleMaps?: string;
    tripAdvisor?: string;
    wikipedia?: string;
    viator?: string;
  };
}

export interface ItineraryDay {
  dayNum: number;
  theme: string;
  date: string;
  zone: string;
  items: ItineraryItem[];
}

export interface Restaurant {
  name: string;
  type: string;
  priceRange: "$" | "$$" | "$$$" | "$$$$";
  rating: string;
  specialty: string;
  zone: string;
  source: string;
  bookingUrl?: string;
  address?: string;
  links?: {
    googleMaps?: string;
    tripAdvisor?: string;
    yelp?: string;
    theFork?: string;
  };
}

export interface Event {
  name: string;
  type: "festival" | "concert" | "permanent" | "sport" | "market" | "cinema";
  when: string;
  description: string;
  price: string;
  venue?: string;
  ticketUrl?: string;
  source?: string;
}

export interface SecurityAlert {
  level: "alto" | "medio" | "bajo";
  zone: string;
  description: string;
  tip: string;
}

export interface Hotel {
  name: string;
  stars: number;
  reviewScore: number;
  reviewCount: number;
  pricePerNight: string;
  currency: string;
  address: string;
  url: string;
  photoUrl?: string;
  distanceFromCenter?: string;
}

export interface ItineraryData {
  city: string;
  country: string;
  tagline: string;
  summary: string;
  weather?: {
    maxTemp: number;
    minTemp: number;
    seaTemp?: number;
    description: string;
  };
  estimatedBudgetPerDay: string;
  days: ItineraryDay[];
  restaurants: Restaurant[];
  events: Event[];
  alerts: SecurityAlert[];
  hotels?: Hotel[];
  generatedBy?: string;
  cityWikipediaExtract?: string;
}

// ─── Form / Input types ────────────────────────────────────────

export type Budget = "economico" | "moderado" | "premium" | "lujo";
export type TravelerType = "pareja" | "familia" | "amigos" | "solo" | "negocios";
export type Locale = "es" | "en" | "fr" | "de" | "pt" | "it";

export interface TripFormData {
  city: string;
  country: string;
  startDate: string;
  endDate: string;
  travelers: number;
  travelerType: TravelerType;
  budget: Budget;
  interests: string[];
  locale: Locale;
}

// ─── User edits (personalization) ─────────────────────────────

export interface UserEdit {
  name?: string;
  note?: string;
  removed?: boolean;
}

export type UserEdits = Record<string, UserEdit>;
