import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { IoCloudUploadOutline } from "react-icons/io5";
import { AiOutlineDownload } from "react-icons/ai";
import { HiOutlineMenu } from "react-icons/hi";
import { languageDisplayNames, languageOptions, translations, type Language } from "./i18n";

// --- Fix Leaflet's default marker icons in bundlers ---
delete (L.Icon.Default as any).prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

type LatLng = { lat: number; lng: number };
type GeocodeResult = {
  display_name: string;
  lat: string;
  lon: string;
  type?: string;
};
type SavedLocation = LatLng & { id: string; label: string; visible: boolean; color: string };

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

const CIRCLE_COLORS = [
  "#2563eb",
  "#f97316",
  "#22c55e",
  "#d946ef",
  "#ef4444",
  "#14b8a6",
  "#a855f7",
  "#eab308",
];
const DEFAULT_CIRCLE_COLOR = CIRCLE_COLORS[0];
const CLICKED_CIRCLE_COLOR = "#6b7280";
const getPaletteColor = (index: number) => CIRCLE_COLORS[index % CIRCLE_COLORS.length];

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

function RecenterOn({ center }: { center: LatLng }) {
  const map = useMap();
  useEffect(() => {
    map.setView([center.lat, center.lng]);
  }, [center, map]);
  return null;
}

function InvalidateSizeOnResize() {
  const map = useMap();
  useEffect(() => {
    const invalidate = () => map.invalidateSize();
    map.whenReady(() => {
      requestAnimationFrame(invalidate);
      setTimeout(invalidate, 0);
    });
    window.addEventListener("resize", invalidate);

    const container = map.getContainer();
    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => requestAnimationFrame(invalidate))
        : null;
    observer?.observe(container);

    return () => {
      window.removeEventListener("resize", invalidate);
      observer?.disconnect();
    };
  }, [map]);
  return null;
}

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
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const isPopupOpenRef = useRef(false);
  const reopenPopupRef = useRef(false);
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

  const radiusMeters = useMemo(() => {
    const r = Number(radiusInput);
    if (!isFinite(r) || r < 0) return 0;
    return unit === "km" ? r * 1000 : r * 1609.344;
  }, [radiusInput, unit]);

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

  // Click on map to set center
  function ClickSetter() {
    const map = useMap();
    useEffect(() => {
      function onClick(e: any) {
        closeMarkerPopup();
        setCenter({ lat: e.latlng.lat, lng: e.latlng.lng });
        setSelectedLocationId(null);
        setPinLabelOverride(null);
      }
      map.on("click", onClick);
      return () => {
        map.off("click", onClick);
      };
    }, [map, closeMarkerPopup]);
    return null;
  }

  const handleSelectPlace = (g: GeocodeResult) => {
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
    [closeMarkerPopup],
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
  const selectedLocationColor = selectedLocation?.color ?? null;
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

  const formatPopupLabel = (label: string | null) => {
    if (!label) return null;
    const [head] = label.split(",");
    const trimmed = head.trim();
    return trimmed || label;
  };

  const popupLabel = selectedLocation
    ? formatPopupLabel(selectedLocation.label)
    : formatPopupLabel(pinLabelOverride) ?? t.mapPopupTitle;
  const centerPinColor = selectedLocationColor ?? CLICKED_CIRCLE_COLOR;

  return (
    <>
      {/* Ensure full-height layout for header + main, footer sits outside */}
      <div className="min-h-screen h-screen bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-100 flex flex-col">
      <header className="sticky top-0 z-[1200] bg-white/50 dark:bg-slate-900/60 backdrop-blur border-b border-slate-200 dark:border-slate-800">
        <div className="w-full px-6 py-3 flex items-center gap-3 justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsSidebarOpen((prev) => !prev)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-600 hover:border-slate-400 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-500"
              aria-pressed={isSidebarOpen}
              aria-label={isSidebarOpen ? t.toggleSidebarHide : t.toggleSidebarShow}
            >
              <HiOutlineMenu className="h-5 w-5" aria-hidden="true" />
            </button>
            <div>
              <h1 className="text-2xl font-semibold">{t.headerTitle}</h1>
              <p className="text-sm text-slate-600 dark:text-slate-300">{t.headerDescription}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="inline-flex rounded-full border border-slate-300 bg-white shadow-sm overflow-hidden dark:border-slate-700 dark:bg-slate-800"
              role="group"
              aria-label={t.languageButtonLabel}
            >
              {languageOptions.map((option, index) => {
                const isActive = language === option;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setLanguage(option)}
                    className={`px-4 py-1.5 text-sm font-semibold transition ${
                      isActive
                        ? "bg-sky-600 text-white"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-700"
                    } ${index === 0 ? "rounded-l-full" : ""} ${
                      index === languageOptions.length - 1 ? "rounded-r-full" : ""
                    }`}
                    aria-pressed={isActive}
                  >
                    {languageDisplayNames[option]}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </header>

      {/* map + sidebar layout */}
      <main className="flex-1 min-h-0 w-full px-6 py-4 pb-4 flex flex-col gap-4 md:flex-row md:overflow-hidden">
        {/* sidebar */}
        {isSidebarOpen && (
          <aside className="text-sm text-slate-700 dark:text-slate-200 shrink-0 md:w-72 lg:w-80 flex flex-col gap-4 order-2 md:order-1 md:max-h-full md:min-h-0 overflow-y-auto overflow-x-hidden">
            <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 bg-white dark:bg-slate-800 shadow-sm space-y-4">
              <div>
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">{language === "ja" ? "地点検索" : "Location Search"}</div>
                <label className="text-xs text-slate-600 dark:text-slate-300">{t.searchLabel}</label>
                <div className="relative mt-1">
                  <input
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setIsSearchLocked(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && results[0]) handleSelectPlace(results[0]);
                    }}
                    placeholder={t.searchPlaceholder}
                    className="h-10 w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900/50 text-slate-900 dark:text-slate-100 px-3 pr-10 focus:outline-none focus:ring-2 focus:ring-sky-400"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-500 dark:text-slate-300">
                    {isSearching
                      ? t.searchStatusSearching
                      : results.length
                        ? t.formatResultsCount(results.length)
                        : ""}
                  </div>
                  {results.length > 0 && (
                    <div className="absolute z-[1100] mt-1 w-full rounded-xl border border-slate-200 bg-white shadow dark:border-slate-700 dark:bg-slate-800">
                      {results.map((g, i) => (
                        <button
                          key={i}
                          onClick={() => handleSelectPlace(g)}
                          className="block w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700"
                        >
                          <div className="text-sm line-clamp-1" title={g.display_name}>{g.display_name}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">{g.type}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex flex-col gap-2 flex-1">
                  <label className="text-xs text-slate-600 dark:text-slate-300">{t.radiusLabel}</label>
                  <input
                    type="number"
                    step="0.1"
                    min={0}
                    value={radiusInput}
                    onChange={(e) => handleRadiusInputChange(e.target.value)}
                    className={`h-10 rounded-xl border px-3 bg-white text-slate-900 dark:bg-slate-900/50 dark:text-slate-100 focus:outline-none focus:ring-2 ${
                      radiusWarning
                        ? "border-rose-400 focus:ring-rose-300"
                        : "border-slate-300 focus:ring-sky-400 dark:border-slate-600"
                    }`}
                  />
                </div>
                <div className="flex flex-col gap-2 flex-1">
                  <label className="text-xs text-slate-600 dark:text-slate-300">{t.unitLabel}</label>
                  <select
                    className="h-10 rounded-xl border border-slate-300 dark:border-slate-600 px-3 bg-white dark:bg-slate-900/50 dark:text-slate-100"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value as any)}
                  >
                    <option value="km">{t.unitKmOption}</option>
                    <option value="mi">{t.unitMiOption}</option>
                  </select>
                </div>
              </div>
              <div className="pt-4 border-t border-slate-100 dark:border-slate-700 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs text-slate-500 dark:text-slate-300">{t.currentLocationTitle}</div>
                  <span
                    className="inline-flex h-4 w-4 rounded-full border border-slate-200 dark:border-slate-600"
                    style={{ backgroundColor: centerPinColor }}
                    role="img"
                    aria-label={t.circleColorLabel}
                  />
                </div>
                <div className="font-mono text-base">
                  {center.lat.toFixed(2)}, {center.lng.toFixed(2)}
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setIsCircleVisible((prev) => !prev)}
                    className={`rounded-full border px-2 py-1 text-[11px] font-semibold transition ${
                      isCircleVisible
                        ? "border-sky-200 text-sky-700 hover:border-sky-400 dark:border-sky-500 dark:text-sky-300"
                        : "border-slate-200 text-slate-500 hover:border-slate-400 dark:border-slate-600 dark:text-slate-300"
                    }`}
                  >
                    {isCircleVisible ? t.hideCircleButton : t.showCircleButton}
                  </button>
                </div>
                <button
                  onClick={handleSaveLocation}
                  disabled={isCurrentLocationSaved}
                  className="w-full rounded-lg bg-sky-600 text-white px-4 py-2 text-sm font-semibold disabled:bg-slate-300 dark:disabled:bg-slate-600"
                >
                  {isCurrentLocationSaved ? t.alreadySavedButton : t.saveCurrentButton}
                </button>
              </div>
            </div>

            <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 bg-white dark:bg-slate-800 shadow-sm flex-1 min-h-[240px] flex flex-col">
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="font-semibold text-slate-900 dark:text-slate-100">{t.savedLocationsTitle}</div>
                <div className="flex items-center gap-2">
                  <div className="relative group z-[1200]">
                    <button
                      type="button"
                      onClick={handleTriggerUpload}
                      aria-label={t.uploadLocationsButton}
                      className="flex h-9 w-9 items-center justify-center rounded border border-slate-200 text-slate-600 hover:border-sky-400 hover:text-sky-700 dark:border-slate-600 dark:text-slate-200 dark:hover:border-sky-500 dark:hover:text-sky-300"
                    >
                      <IoCloudUploadOutline className="h-5 w-5" aria-hidden="true" />
                    </button>
                    <div
                      className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 rounded bg-white text-slate-900 text-[10px] px-2 py-1 whitespace-nowrap opacity-0 group-hover:opacity-100 group-hover:-translate-y-1 transition shadow dark:bg-slate-800 dark:text-slate-100 dark:shadow-lg z-[1300]"
                    >
                      {t.uploadTooltip}
                    </div>
                  </div>
                  <div className="relative group z-[1200]">
                    <button
                      type="button"
                      onClick={handleDownloadLocations}
                      disabled={savedLocations.length === 0}
                      aria-label={t.downloadLocationsButton}
                      className="flex h-9 w-9 items-center justify-center rounded border border-slate-200 text-slate-600 hover:border-sky-400 hover:text-sky-700 disabled:text-slate-400 disabled:border-slate-200 dark:border-slate-600 dark:text-slate-200 dark:hover:border-sky-500 dark:hover:text-sky-300 dark:disabled:text-slate-500"
                    >
                      <AiOutlineDownload className="h-5 w-5" aria-hidden="true" />
                    </button>
                    <div
                      className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 rounded bg-white text-slate-900 text-[10px] px-2 py-1 whitespace-nowrap opacity-0 group-hover:opacity-100 group-hover:-translate-y-1 transition shadow dark:bg-slate-800 dark:text-slate-100 dark:shadow-lg z-[1300]"
                    >
                      {t.downloadTooltip}
                    </div>
                  </div>
                  <input
                    ref={uploadInputRef}
                    type="file"
                    accept="application/json"
                    className="hidden"
                    onChange={handleUploadLocations}
                  />
                </div>
              </div>
              <div className="flex-1 min-h-0">
                {savedLocations.length === 0 ? (
                  <div className="text-xs text-slate-500 dark:text-slate-400">{t.noSavedLocations}</div>
                ) : (
                  <ul className="space-y-2 h-full overflow-auto pr-1">
                    {savedLocations.map((location) => {
                      const isEditing = editingId === location.id;
                      const isSelected = selectedLocationId === location.id;
                      const locationColor = location.color || DEFAULT_CIRCLE_COLOR;
                      const colorBadge = (
                        <span
                          className="inline-flex h-4 w-4 rounded-full border border-slate-200 dark:border-slate-700"
                          style={{ backgroundColor: locationColor }}
                          aria-hidden="true"
                        />
                      );
                      const renderVisibilityButton = (stopPropagation = false) => (
                        <button
                          type="button"
                          onClick={(e) => {
                            if (stopPropagation) e.stopPropagation();
                            handleToggleLocationVisibility(location.id);
                          }}
                          className={`rounded-full border px-2 py-1 text-[11px] font-semibold transition ${
                            location.visible
                              ? "border-sky-200 text-sky-700 hover:border-sky-400 dark:border-sky-500 dark:text-sky-300"
                              : "border-slate-200 text-slate-500 hover:border-slate-400 dark:border-slate-600 dark:text-slate-300"
                          }`}
                        >
                          {location.visible ? t.hideCircleButton : t.showCircleButton}
                        </button>
                      );
                      return (
                        <li key={location.id} className="text-xs">
                          {isEditing ? (
                            <div
                              className="border rounded-lg px-3 py-2 bg-white/70 dark:bg-slate-900/40 border-slate-200 dark:border-slate-600"
                            >
                              <div className="flex items-center justify-between mb-1">
                                <label className="block text-[10px] text-slate-500 dark:text-slate-400">{t.editLabelHeading}</label>
                                {colorBadge}
                              </div>
                              <input
                                value={editingLabel}
                                onChange={(e) => setEditingLabel(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" && editingLabel.trim()) handleCommitEditing();
                                  if (e.key === "Escape") handleCancelEditing();
                                }}
                                autoFocus
                                className="w-full rounded border border-slate-300 dark:border-slate-600 px-2 py-1 text-xs bg-white dark:bg-slate-900/50 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-400"
                              />
                              <div className="flex gap-2 mt-2">
                                <button
                                  type="button"
                                  onClick={handleCommitEditing}
                                  disabled={!editingLabel.trim()}
                                  className="flex-1 rounded bg-sky-600 text-white py-1 font-semibold disabled:bg-slate-300"
                                >
                                  {t.saveLabelButton}
                                </button>
                                <button
                                  type="button"
                                  onClick={handleCancelEditing}
                                  className="flex-1 rounded border border-slate-200 text-slate-600 py-1 dark:border-slate-600 dark:text-slate-200"
                                >
                                  {t.cancelButton}
                                </button>
                              </div>
                              <div className="mt-3 flex justify-end">
                                {renderVisibilityButton()}
                              </div>
                            </div>
                          ) : (
                              <div
                              role="button"
                              tabIndex={0}
                              onClick={() => handleSelectSaved(location)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  handleSelectSaved(location);
                                }
                              }}
                              className={`w-full border rounded-lg px-3 py-2 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
                                isSelected
                                  ? "shadow-inner ring-1 ring-sky-300 dark:ring-sky-500 bg-white/70 dark:bg-slate-900/40 border-slate-300 dark:border-slate-600"
                                  : "border-slate-200 hover:border-sky-400 dark:border-slate-600 dark:hover:border-sky-500 bg-white/60 dark:bg-slate-900/30"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <div className="font-medium">{location.label}</div>
                                  <div className="font-mono text-slate-500 dark:text-slate-300">
                                    {location.lat.toFixed(2)}, {location.lng.toFixed(2)}
                                  </div>
                                </div>
                                <div className="pt-0.5">{colorBadge}</div>
                              </div>
                              <div className="mt-2 flex justify-end">
                                {renderVisibilityButton(true)}
                              </div>
                              {isSelected && (
                                <div className="mt-2 flex gap-2">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleStartEditing(location);
                                    }}
                                    className="flex-1 rounded border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-sky-400 hover:text-sky-700 dark:border-slate-600 dark:text-slate-200 dark:hover:border-sky-500 dark:hover:text-sky-300"
                                  >
                                    {t.editLabelButton}
                                  </button>
                                  <button
                                    type="button"
                                    aria-label={t.deleteSavedLabel(location.label)}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteLocation(location.id);
                                    }}
                                    className="flex-1 flex items-center justify-center gap-1 rounded border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:border-rose-400 hover:text-rose-700"
                                  >
                                    <svg
                                      className="h-4 w-4"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="2"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      aria-hidden="true"
                                    >
                                      <polyline points="3 6 5 6 21 6" />
                                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                                      <path d="M10 11v6" />
                                      <path d="M14 11v6" />
                                      <path d="M15 6V4a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v2" />
                                    </svg>
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>

          </aside>
        )}

        {/* map area */}
        <div className="rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 flex-1 min-h-[320px] order-1 md:order-2 bg-slate-100 dark:bg-slate-800 md:min-h-0">
          <MapContainer
            center={[center.lat, center.lng]}
            zoom={13}
            className="h-full w-full"
            scrollWheelZoom
            ref={mapRef}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {/* Added: force size recalculation */}
            <InvalidateSizeOnResize />
            <RecenterOn center={center} />
            <ClickSetter />
            <Marker
              position={[center.lat, center.lng]}
              ref={markerRef}
              icon={getPinIcon(centerPinColor)}
              eventHandlers={{
                popupopen: () => {
                  isPopupOpenRef.current = true;
                },
                popupclose: () => {
                  isPopupOpenRef.current = false;
                },
              }}
            >
              <Popup autoPan={false}>
                {popupLabel}
                <br />
                {center.lat.toFixed(2)}, {center.lng.toFixed(2)}
              </Popup>
            </Marker>
            {radiusMeters > 0 && (
              <>
                {isCircleVisible && (
                  <Circle
                    center={[center.lat, center.lng]}
                    radius={radiusMeters}
                    pathOptions={{
                      color: selectedLocationColor ?? CLICKED_CIRCLE_COLOR,
                      fillColor: selectedLocationColor ?? CLICKED_CIRCLE_COLOR,
                      fillOpacity: 0.1,
                    }}
                  />
                )}
                {savedLocations.map((location) => {
                  if (!location.visible) return null;
                  const color = location.color || DEFAULT_CIRCLE_COLOR;
                  return (
                    <React.Fragment key={`saved-location-${location.id}`}>
                      <Circle
                        center={[location.lat, location.lng]}
                        radius={radiusMeters}
                        bubblingMouseEvents={false}
                        eventHandlers={{
                          click: () => focusSavedLocation(location),
                        }}
                        pathOptions={{
                          color,
                          fillColor: color,
                          fillOpacity: 0.08,
                          weight: 1.5,
                        }}
                      />
                      <Marker
                        position={[location.lat, location.lng]}
                        icon={getPinIcon(color)}
                        eventHandlers={{
                          popupopen: () => {
                            isPopupOpenRef.current = true;
                            focusSavedLocation(location, { keepPopupOpen: true });
                          },
                          popupclose: () => {
                            isPopupOpenRef.current = false;
                          },
                        }}
                      >
                        <Popup autoPan={false}>
                          {location.label ?? `Saved location ${location.id}`}
                          <br />
                          {location.lat.toFixed(2)}, {location.lng.toFixed(2)}
                        </Popup>
                      </Marker>
                    </React.Fragment>
                  );
                })}
              </>
            )}
          </MapContainer>
        </div>
      </main>

      </div>
      <footer className="w-full p-4 text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
        {t.footerNote}
      </footer>
    </>
  );
}
