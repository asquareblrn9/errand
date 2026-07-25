"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin } from "lucide-react";

declare global {
  interface Window {
    google: any;
  }
}

// Module-level singleton to prevent duplicate Google Maps script loads.
let mapsLoadPromise: Promise<void> | null = null;
let mapsLoaded = false;

function ensureGoogleMaps(apiKey: string): Promise<void> {
  if (mapsLoaded || window.google?.maps) {
    mapsLoaded = true;
    return Promise.resolve();
  }

  if (mapsLoadPromise) return mapsLoadPromise;

  const existing = document.querySelector<HTMLScriptElement>(
    'script[src*="maps.googleapis.com/maps/api/js"]',
  );
  if (existing) {
    mapsLoadPromise = new Promise((resolve) => {
      existing.addEventListener("load", () => {
        mapsLoaded = true;
        resolve();
      });
      if (window.google?.maps) {
        mapsLoaded = true;
        resolve();
      }
    });
    return mapsLoadPromise;
  }

  mapsLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&v=weekly`;
    script.async = true;
    script.onload = () => {
      mapsLoaded = true;
      resolve();
    };
    script.onerror = () => {
      mapsLoadPromise = null;
      reject(new Error("Failed to load Google Maps"));
    };
    document.head.appendChild(script);
  });

  return mapsLoadPromise;
}

// Styles for the PlaceAutocompleteElement's internal input — mirrors the app's <Input> component.
const INPUT_STYLES = [
  "width: 100%",
  "height: 2.5rem",
  "padding: 0.5rem 0.75rem",
  "padding-left: 2.25rem",
  "font-size: 0.875rem",
  "line-height: 1.25rem",
  "color: hsl(var(--foreground))",
  "background: transparent",
  "border: 1px solid hsl(var(--input))",
  "border-radius: 0.75rem",
  "outline: none",
  "transition: border-color 0.2s, box-shadow 0.2s",
].join("; ");

interface LocationPickerProps {
  value: string;
  onChange: (data: { address: string; latitude: number; longitude: number }) => void;
  error?: string;
  label?: string;
  placeholder?: string;
}

export function LocationPicker({
  value,
  onChange,
  error,
  label = "Location",
  placeholder = "Search for a location...",
}: LocationPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const autocompleteElRef = useRef<any>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [autocompleteMounted, setAutocompleteMounted] = useState(false);

  // Keep latest prop values in refs so the autocomplete effect (which should
  // only run once) always calls the current onChange / placeholder.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const placeholderRef = useRef(placeholder);
  placeholderRef.current = placeholder;

  // Load the Google Maps script (singleton)
  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) return;

    let cancelled = false;
    ensureGoogleMaps(apiKey).then(() => {
      if (!cancelled) setScriptLoaded(true);
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Once script is loaded, flag that we want to swap the Input for the autocomplete.
  // This triggers a React re-render that unmounts the Input and mounts an empty <div>.
  useEffect(() => {
    if (scriptLoaded && !autocompleteMounted) {
      setAutocompleteMounted(true);
    }
  }, [scriptLoaded, autocompleteMounted]);

  // Once the empty container <div> exists (from the re-render above), create and
  // append the PlaceAutocompleteElement into it. React no longer owns children of
  // this div, so there's no DOM conflict.
  // Dependencies are intentionally [autocompleteMounted] only — onChange and
  // placeholder are read from refs so this effect runs exactly once.
  useEffect(() => {
    if (!autocompleteMounted || !containerRef.current || autocompleteElRef.current) return;

    const { google } = window;
    if (!google?.maps?.places?.PlaceAutocompleteElement) return;

    const autocompleteEl = new google.maps.places.PlaceAutocompleteElement();
    autocompleteEl.includedRegionCodes = ["NG"];
    autocompleteEl.placeholder = placeholderRef.current;
    autocompleteEl.setAttribute("style", "width: 100%;");

    containerRef.current.appendChild(autocompleteEl);
    autocompleteElRef.current = autocompleteEl;

    // Handle place selection
    const handleSelect = async ({ placePrediction }: any) => {
      if (!placePrediction) return;
      try {
        const place = placePrediction.toPlace();
        await place.fetchFields({ fields: ["formattedAddress", "location"] });
        if (place?.formattedAddress && place?.location) {
          onChangeRef.current({
            address: place.formattedAddress,
            latitude: place.location.lat(),
            longitude: place.location.lng(),
          });
        }
      } catch {
        // fetchFields or toPlace failed — silently ignore
      }
    };
    autocompleteEl.addEventListener("gmp-select", handleSelect);

    // Style the internal <input> to match the app's design system
    const inputEl = autocompleteEl.querySelector("input");
    if (inputEl) {
      inputEl.setAttribute("style", INPUT_STYLES);
      inputEl.addEventListener("focus", () => {
        inputEl.style.borderColor = "hsl(var(--primary))";
        inputEl.style.boxShadow = "0 0 0 4px hsl(var(--primary) / 0.15)";
      });
      inputEl.addEventListener("blur", () => {
        inputEl.style.borderColor = "hsl(var(--input))";
        inputEl.style.boxShadow = "none";
      });
    }

    // Propagate manual typing so the form's hidden "location" field stays in sync
    const handleInput = () => {
      if (inputEl) {
        onChangeRef.current({ address: inputEl.value, latitude: 0, longitude: 0 });
      }
    };
    if (inputEl) {
      inputEl.addEventListener("input", handleInput);
    }

    return () => {
      autocompleteEl.removeEventListener("gmp-select", handleSelect);
      if (inputEl) {
        inputEl.removeEventListener("input", handleInput);
      }
      google.maps.event.clearInstanceListeners(autocompleteEl);
      // Remove the element from the DOM so it doesn't accumulate
      if (autocompleteEl.parentNode) {
        autocompleteEl.parentNode.removeChild(autocompleteEl);
      }
      autocompleteElRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autocompleteMounted]);

  return (
    <div className="space-y-2">
      {label && <Label>{label}</Label>}
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10 pointer-events-none" />
        {autocompleteMounted ? (
          <div ref={containerRef} />
        ) : (
          <Input
            type="text"
            value={value}
            onChange={(e) => onChange({ address: e.target.value, latitude: 0, longitude: 0 })}
            placeholder={placeholder}
            className="pl-9"
          />
        )}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
