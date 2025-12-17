import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { translations, type Language } from "./i18n";
import { AppHeader } from "./components/AppHeader";
import Sidebar from "./components/Sidebar";
import MapViewport from "./components/MapViewport";
import type { GeocodeResult, LatLng, SavedLocation } from "./types";
import {
  CLICKED_CIRCLE_COLOR,
  DEFAULT_CIRCLE_COLOR,
  getPaletteColor,
} from "./constants/mapColors";

// --- Fix Leaflet's default marker icons in bundlers ---
delete (L.Icon.Default as any).prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Interface for uploaded JSON location items
interface UploadedLocationItem {
  id?: string | number | null;
  label?: string | number | null;
  lat: string | number;
  lng: string | number;
  visible?: boolean;
  color?: string | null;
}

// Type guard to validate uploaded location data
function isValidUploadedItem(item: unknown): item is UploadedLocationItem {
  return (
    item !== null &&
    typeof item === "object" &&
    "lat" in item &&
    "lng" in item
  );
}

const createColoredPinIcon = (color: string) =>
  L.divIcon({
    className: "",
    html: `<svg width="32" height="48" viewBox="0 0 32 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 1.5C8.11116 1.5 1.5 8.11116 1.5 16C1.5 27.5174 16 46.5 16 46.5C16 46.5 30.5 27.5174 30.5 16C30.5 8.11116 23.8888 1.5 16 1.5Z" fill="${color}" stroke="white" stroke-width="3"/>
      <circle cx="16" cy="16" r="5.25" fill="white"/>
    </svg>`,
    iconSize: [32, 48],
    iconAnchor: [16, 46],
    popupAnchor: [0, -36],
  });

const DEFAULT_CENTER: LatLng = { lat: 35.681236, lng: 139.767125 }; // Tokyo Station
const SAVED_LOCATIONS_KEY = "radius-map-app:saved-locations";
const generateId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

function useDebounced<T>(value: T, delay = 400) {
  const [deb, setDeb] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDeb(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return deb;
}

export default function App() {
  const [center, setCenter] = useState<LatLng>(DEFAULT_CENTER);
  const [unit, setUnit] = useState<"km" | "mi">("km");
  const [radiusInput, setRadiusInput] = useState<string>("2.5");
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [pinLabelOverride, setPinLabelOverride] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [language, setLanguage] = useState<Language>("ja");
  const [isSearchLocked, setIsSearchLocked] = useState(false);
  const [isCircleVisible, setIsCircleVisible] = useState(true);
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);
  const [reverseGeocodeError, setReverseGeocodeError] = useState<string | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const isPopupOpenRef = useRef(false);
  const reopenPopupRef = useRef(false);
  const reverseLookupControllerRef = useRef<AbortController | null>(null);
  const [radiusWarning, setRadiusWarning] = useState<string | null>(null);
  const debSearch = useDebounced(search, 400);
  const t = translations[language];
  const radiusPattern = /^\d*(\.\d*)?$/;
  const closeMarkerPopup = useCallback((reopenAfterCenterChange = false) => {
    const marker = markerRef.current;
    const shouldReopen = reopenAfterCenterChange && isPopupOpenRef.current;
    marker?.closePopup();
    if (shouldReopen) {
      reopenPopupRef.current = true;
    }
  }, []);
  const cancelReverseLookup = useCallback(() => {
    reverseLookupControllerRef.current?.abort();
    reverseLookupControllerRef.current = null;
    setIsReverseGeocoding(false);
  }, []);

  const handleSearchChange = useCallback(
    (value: string) => {
      cancelReverseLookup();
      setReverseGeocodeError(null);
      setSearch(value);
      setIsSearchLocked(false);
    },
    [cancelReverseLookup],
  );

  const handleToggleSidebar = useCallback(() => {
    setIsSidebarOpen((prev) => !prev);
  }, []);

  const handleLanguageChange = useCallback((nextLanguage: Language) => {
    setLanguage(nextLanguage);
  }, []);

  const handleToggleCircleVisibility = useCallback(() => {
    setIsCircleVisible((prev) => !prev);
  }, []);

  const handleUnitChange = useCallback((value: "km" | "mi") => {
    setUnit(value);
  }, []);

  const handleEditingLabelChange = useCallback((value: string) => {
    setEditingLabel(value);
  }, []);

  const radiusMeters = useMemo(() => {
    const r = Number(radiusInput);
    if (!isFinite(r) || r < 0) return 0;
    return unit === "km" ? r * 1000 : r * 1609.344;
  }, [radiusInput, unit]);
  const reverseGeocodePoint = useCallback(
    async (lat: number, lng: number) => {
      if (typeof fetch === "undefined") return;
      reverseLookupControllerRef.current?.abort();
      const controller = new AbortController();
      reverseLookupControllerRef.current = controller;
      setIsReverseGeocoding(true);
      setReverseGeocodeError(null);
      try {
        const url = new URL("https://nominatim.openstreetmap.org/reverse");
        url.searchParams.set("format", "json");
        url.searchParams.set("lat", lat.toString());
        url.searchParams.set("lon", lng.toString());
        url.searchParams.set("zoom", "16");
        url.searchParams.set("addressdetails", "0");
        url.searchParams.set("accept-language", language);
        const res = await fetch(url.toString(), { signal: controller.signal });
        if (!res.ok) throw new Error("Reverse lookup failed");
        const data = await res.json();
        if (controller.signal.aborted) return;
        const hasDisplayName =
          data && typeof data.display_name === "string" && data.display_name.trim();
        const label = hasDisplayName ? data.display_name : t.formatDefaultSavedLabel(lat, lng);
        setSearch(label);
        setPinLabelOverride(label);
        setIsSearchLocked(true);
      } catch (error) {
        if (controller.signal.aborted) return;
        setReverseGeocodeError(t.reverseLookupError);
      } finally {
        if (controller.signal.aborted) return;
        setIsReverseGeocoding(false);
        reverseLookupControllerRef.current = null;
      }
    },
    [language, t],
  );

  const handleMapClick = useCallback(
    (coords: LatLng) => {
      const { lat, lng } = coords;
      reopenPopupRef.current = false;
      closeMarkerPopup(false);
      setCenter({ lat, lng });
      setSelectedLocationId(null);
      setPinLabelOverride(null);
      setResults([]);
      setIsSearching(false);
      setIsSearchLocked(true);
      reverseGeocodePoint(lat, lng);
    },
    [closeMarkerPopup, reverseGeocodePoint],
  );

  // Live search with Nominatim (OpenStreetMap)
  useEffect(() => {
    if (isSearchLocked) {
      setResults([]);
      setIsSearching(false);
      return;
    }
    const q = debSearch.trim();
    if (!q) {
      setResults([]);
      return;
    }
    let canceled = false;
    (async () => {
      try {
        setIsSearching(true);
        const url = new URL("https://nominatim.openstreetmap.org/search");
        url.searchParams.set("format", "json");
        url.searchParams.set("q", q);
        url.searchParams.set("addressdetails", "0");
        url.searchParams.set("limit", "8");
        url.searchParams.set("accept-language", language);
        const res = await fetch(url.toString());
        if (!res.ok) throw new Error("Search failed");
        const data: GeocodeResult[] = await res.json();
        if (!canceled) setResults(data);
      } catch (e) {
        if (!canceled) setResults([]);
      } finally {
        if (!canceled) setIsSearching(false);
      }
    })();
    return () => {
      canceled = true;
    };
  }, [debSearch, language, isSearchLocked]);

  const handleSelectPlace = (g: GeocodeResult) => {
    cancelReverseLookup();
    setReverseGeocodeError(null);
    closeMarkerPopup(true);
    setCenter({ lat: parseFloat(g.lat), lng: parseFloat(g.lon) });
    setSearch(g.display_name);
    setIsSearchLocked(true);
    setSelectedLocationId(null);
    setPinLabelOverride(g.display_name);
    setResults([]);
  };

  const metersToReadable = (m: number) => {
    if (unit === "km") return `${(m / 1000).toFixed(3)} km`;
    return `${(m / 1609.344).toFixed(3)} mi`;
  };

  // Load saved locations lazily from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(SAVED_LOCATIONS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setSavedLocations(
            parsed
              .map((item, index) => ({
                id: typeof item.id === "string" ? item.id : generateId(),
                label: typeof item.label === "string" ? item.label : "",
                lat: Number(item.lat),
                lng: Number(item.lng),
                visible: typeof item.visible === "boolean" ? item.visible : true,
                color:
                  typeof item.color === "string" && item.color.trim()
                    ? item.color
                    : getPaletteColor(index),
              }))
              .filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng)),
          );
        }
      }
    } catch {
      setSavedLocations([]);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(SAVED_LOCATIONS_KEY, JSON.stringify(savedLocations));
  }, [savedLocations]);

  const handleSaveLocation = () => {
    const label = search.trim() || t.formatDefaultSavedLabel(center.lat, center.lng);
    setSavedLocations((prev) => [
      ...prev,
      {
        id: generateId(),
        label,
        lat: center.lat,
        lng: center.lng,
        visible: true,
        color: getPaletteColor(prev.length),
      },
    ]);
  };

  const handleRadiusInputChange = (next: string) => {
    if (next === "" || radiusPattern.test(next)) {
      setRadiusWarning(null);
      setRadiusInput(next);
      return;
    }
    setRadiusWarning(t.radiusInvalidMessage);
  };

  const handleDownloadLocations = () => {
    if (savedLocations.length === 0 || typeof window === "undefined") return;
    const payload = JSON.stringify(
      savedLocations.map(({ id, label, lat, lng, visible, color }) => ({
        id,
        label,
        lat,
        lng,
        visible,
        color,
      })),
      null,
      2,
    );
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    const dateStamp = `${y}${m}${d}`;
    link.href = url;
    link.download = `locations-${dateStamp}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleTriggerUpload = () => {
    uploadInputRef.current?.click();
  };

  const handleUploadLocations: React.ChangeEventHandler<HTMLInputElement> = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) throw new Error("Invalid format");
      const normalized: SavedLocation[] = parsed
        .map((item, index) => {
          if (!isValidUploadedItem(item)) return null;
          const lat = Number(item.lat);
          const lng = Number(item.lng);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
          const rawLabel = typeof item.label === "string" ? item.label : "";
          const label = rawLabel.trim() || t.formatDefaultSavedLabel(lat, lng);
          const id = typeof item.id === "string" ? item.id : generateId();
          const visible =
            typeof item.visible === "boolean" ? item.visible : true;
          const color =
            typeof item.color === "string" && item.color.trim()
              ? item.color
              : getPaletteColor(index);
          return { id, label, lat, lng, visible, color };
        })
        .filter((entry): entry is SavedLocation => Boolean(entry));
      if (normalized.length === 0) {
        if (typeof window !== "undefined" && window.alert) {
          window.alert("No valid locations found in the file.");
        }
        return;
      }
      setSavedLocations(normalized);
      setSelectedLocationId(normalized[0].id);
      setPinLabelOverride(null);
      closeMarkerPopup(true);
      setCenter({ lat: normalized[0].lat, lng: normalized[0].lng });
    } catch (err) {
      if (typeof window !== "undefined" && window.alert) {
        window.alert("Failed to read locations file.");
      }
    }
  };

  const focusSavedLocation = useCallback(
    (
      location: SavedLocation,
      options?: { keepPopupOpen?: boolean; inheritPopupState?: boolean },
    ) => {
      cancelReverseLookup();
      setReverseGeocodeError(null);
      const keepPopupOpen = options?.keepPopupOpen ?? false;
      const inheritPopupState = options?.inheritPopupState ?? true;
      const isCenterPopupOpen = markerRef.current?.isPopupOpen() ?? false;
      const shouldCarryPopup =
        inheritPopupState && (isPopupOpenRef.current || isCenterPopupOpen);

      if (!keepPopupOpen) {
        reopenPopupRef.current = shouldCarryPopup;
        closeMarkerPopup(false);
        mapRef.current?.closePopup();
      } else {
        reopenPopupRef.current = false;
      }

      setCenter({ lat: location.lat, lng: location.lng });
      mapRef.current?.setView([location.lat, location.lng]);
      setSearch(location.label);
      setIsSearchLocked(true);
      setSelectedLocationId(location.id);
      setPinLabelOverride(null);
      setResults([]);
      setIsSearching(false);
    },
    [closeMarkerPopup, cancelReverseLookup],
  );

  const handleCenterPopupOpen = useCallback(() => {
    isPopupOpenRef.current = true;
  }, []);

  const handlePopupClose = useCallback(() => {
    isPopupOpenRef.current = false;
  }, []);

  const handleSavedMarkerPopupOpen = useCallback(
    (location: SavedLocation) => {
      isPopupOpenRef.current = true;
      focusSavedLocation(location, { keepPopupOpen: true });
    },
    [focusSavedLocation],
  );

  const handleSelectSaved = (location: SavedLocation) => {
    focusSavedLocation(location);
  };

  const handleStartEditing = (location: SavedLocation) => {
    setSelectedLocationId(location.id);
    setEditingId(location.id);
    setEditingLabel(location.label);
  };

  const handleDeleteLocation = (id: string) => {
    if (typeof window !== "undefined") {
      const ok = window.confirm(t.confirmDelete);
      if (!ok) return;
    }
    setSavedLocations((prev) => prev.filter((loc) => loc.id !== id));
    if (selectedLocationId === id) setSelectedLocationId(null);
    if (editingId === id) {
      setEditingId(null);
      setEditingLabel("");
    }
  };

  const handleToggleLocationVisibility = (id: string) => {
    setSavedLocations((prev) =>
      prev.map((loc) => (loc.id === id ? { ...loc, visible: !loc.visible } : loc)),
    );
  };

  const handleCancelEditing = () => {
    setEditingId(null);
    setEditingLabel("");
  };

  const handleCommitEditing = () => {
    if (!editingId) return;
    const trimmed = editingLabel.trim();
    if (!trimmed) return;
    setSavedLocations((prev) =>
      prev.map((loc) => (loc.id === editingId ? { ...loc, label: trimmed } : loc)),
    );
    setEditingId(null);
    setEditingLabel("");
  };

  const isCurrentLocationSaved = savedLocations.some(
    (loc) => Math.abs(loc.lat - center.lat) < 1e-6 && Math.abs(loc.lng - center.lng) < 1e-6,
  );

  const selectedLocation = selectedLocationId
    ? savedLocations.find((loc) => loc.id === selectedLocationId)
    : null;
  const pinIconCache = useMemo(() => new Map<string, L.DivIcon>(), []);
  const getPinIcon = useCallback(
    (color: string) => {
      const safeColor = color || DEFAULT_CIRCLE_COLOR;
      if (!pinIconCache.has(safeColor)) {
        pinIconCache.set(safeColor, createColoredPinIcon(safeColor));
      }
      return pinIconCache.get(safeColor)!;
    },
    [pinIconCache],
  );

  useEffect(() => {
    if (reopenPopupRef.current && markerRef.current) {
      markerRef.current.openPopup();
      reopenPopupRef.current = false;
    }
  }, [center]);
  useEffect(() => {
    return () => {
      cancelReverseLookup();
    };
  }, [cancelReverseLookup]);

  const formatPopupLabel = (label: string | null) => {
    if (!label) return null;
    const [head] = label.split(",");
    const trimmed = head.trim();
    return trimmed || label;
  };

  const computedLocationLabel = selectedLocation
    ? formatPopupLabel(selectedLocation.label)
    : formatPopupLabel(pinLabelOverride);
  const popupLabel = computedLocationLabel ?? t.mapPopupTitle;
  const centerPinColor = selectedLocation?.color ?? CLICKED_CIRCLE_COLOR;
  const sidebarFallbackLabel = `${center.lat.toFixed(2)}, ${center.lng.toFixed(2)}`;
  const sidebarLocationName = computedLocationLabel ?? sidebarFallbackLabel;
  const searchStatusText = isReverseGeocoding
    ? t.reverseLookupStatus
    : reverseGeocodeError
      ? reverseGeocodeError
      : isSearching
        ? t.searchStatusSearching
        : results.length
          ? t.formatResultsCount(results.length)
          : "";

  return (
    <>
      {/* Ensure full-height layout for header + main, footer sits outside */}
      <div className="min-h-screen h-screen bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-100 flex flex-col">
        <AppHeader
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={handleToggleSidebar}
          language={language}
          onLanguageChange={handleLanguageChange}
          t={t}
        />

        {/* map + sidebar layout */}
        <main className="flex-1 min-h-0 w-full px-6 py-4 pb-4 flex flex-col gap-4 md:flex-row md:overflow-hidden">
          {isSidebarOpen && (
            <Sidebar
              language={language}
              t={t}
              search={search}
              results={results}
              searchStatusText={searchStatusText}
              onSearchChange={handleSearchChange}
              onSelectResult={handleSelectPlace}
              radiusInput={radiusInput}
              radiusWarning={radiusWarning}
              onRadiusChange={handleRadiusInputChange}
              unit={unit}
              onUnitChange={handleUnitChange}
              center={center}
              sidebarLocationName={sidebarLocationName}
              centerPinColor={centerPinColor}
              isCircleVisible={isCircleVisible}
              onToggleCircleVisibility={handleToggleCircleVisibility}
              onSaveLocation={handleSaveLocation}
              isCurrentLocationSaved={isCurrentLocationSaved}
              savedLocations={savedLocations}
              selectedLocationId={selectedLocationId}
              editingId={editingId}
              editingLabel={editingLabel}
              onEditingLabelChange={handleEditingLabelChange}
              onStartEditing={handleStartEditing}
              onCommitEditing={handleCommitEditing}
              onCancelEditing={handleCancelEditing}
              onDeleteLocation={handleDeleteLocation}
              onToggleLocationVisibility={handleToggleLocationVisibility}
              onSelectSaved={handleSelectSaved}
              onTriggerUpload={handleTriggerUpload}
              onDownload={handleDownloadLocations}
              uploadInputRef={uploadInputRef}
              onUploadLocations={handleUploadLocations}
            />
          )}

          <MapViewport
            center={center}
            radiusMeters={radiusMeters}
            isCircleVisible={isCircleVisible}
            savedLocations={savedLocations}
            centerPinColor={centerPinColor}
            popupLabel={popupLabel}
            focusSavedLocation={focusSavedLocation}
            getPinIcon={getPinIcon}
            markerRef={markerRef}
            mapRef={mapRef}
            onCenterPopupOpen={handleCenterPopupOpen}
            onCenterPopupClose={handlePopupClose}
            onSavedMarkerPopupOpen={handleSavedMarkerPopupOpen}
            onSavedMarkerPopupClose={handlePopupClose}
            onMapClick={handleMapClick}
          />
        </main>
      </div>
      <footer className="w-full p-4 text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
        {t.footerNote}
      </footer>
    </>
  );
}
