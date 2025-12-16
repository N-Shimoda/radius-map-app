import React, { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

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
type SavedLocation = LatLng & { id: string; label: string };
type Language = "en" | "ja";

// Interface for uploaded JSON location items
interface UploadedLocationItem {
  id?: string | number | null;
  label?: string | number | null;
  lat: string | number;
  lng: string | number;
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

type Translation = {
  headerTitle: string;
  headerDescription: string;
  toggleSidebarShow: string;
  toggleSidebarHide: string;
  radiusLabel: string;
  unitLabel: string;
  unitKmOption: string;
  unitMiOption: string;
  searchLabel: string;
  searchPlaceholder: string;
  searchStatusSearching: string;
  formatResultsCount: (count: number) => string;
  currentLocationTitle: string;
  radiusTerm: string;
  centerCoordinatesTerm: string;
  mapClickHint: string;
  saveCurrentButton: string;
  alreadySavedButton: string;
  savedLocationsTitle: string;
  downloadLocationsButton: string;
  uploadLocationsButton: string;
  noSavedLocations: string;
  editLabelHeading: string;
  saveLabelButton: string;
  cancelButton: string;
  editLabelButton: string;
  deleteSavedLabel: (label: string) => string;
  mapPopupTitle: string;
  footerNote: React.ReactNode;
  confirmDelete: string;
  formatDefaultSavedLabel: (lat: number, lng: number) => string;
  languageButtonLabel: string;
};

const languageDisplayNames: Record<Language, string> = {
  en: "English",
  ja: "日本語",
};

const LINK_CLASS = "text-sky-600 hover:underline";
const NOMINATIM_URL = "https://nominatim.org/";
const OSM_URL = "https://www.openstreetmap.org/";

const NOMINATIM_LINK = (
  <a href={NOMINATIM_URL} className={LINK_CLASS} target="_blank" rel="noreferrer">
    Nominatim
  </a>
);

const OSM_LINK = (
  <a href={OSM_URL} className={LINK_CLASS} target="_blank" rel="noreferrer">
    OpenStreetMap
  </a>
);

const translations: Record<Language, Translation> = {
  en: {
    headerTitle: "Radius Visualization Map",
    headerDescription: "Visualize circles from any map point and search by postal code or place.",
    toggleSidebarShow: "Show sidebar",
    toggleSidebarHide: "Hide sidebar",
    radiusLabel: "Radius",
    unitLabel: "Unit",
    unitKmOption: "km",
    unitMiOption: "mile",
    searchLabel: "Place search (postal code, facility, etc.)",
    searchPlaceholder: "e.g., 606-8501 / Kyoto University Yoshida Campus / Tokyo Station",
    searchStatusSearching: "Searching...",
    formatResultsCount: (count: number) => `${count} results`,
    currentLocationTitle: "Current Location",
    radiusTerm: "Radius",
    centerCoordinatesTerm: "Center coordinates",
    mapClickHint: "Click the map to change the center point.",
    saveCurrentButton: "Save this location",
    alreadySavedButton: "Location saved",
    savedLocationsTitle: "Saved Locations",
    downloadLocationsButton: "Download",
    uploadLocationsButton: "Upload",
    noSavedLocations: "No locations saved yet.",
    editLabelHeading: "Edit label",
    saveLabelButton: "Save",
    cancelButton: "Cancel",
    editLabelButton: "Edit label",
    deleteSavedLabel: (label: string) => `Delete ${label}`,
    mapPopupTitle: "Center",
    footerNote: (
      <>
        * Search uses {NOMINATIM_LINK} ({OSM_LINK}). Review the usage policy for high-frequency or commercial use.
      </>
    ),
    confirmDelete: "Delete this location?",
    formatDefaultSavedLabel: (lat: number, lng: number) => `Point ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
    languageButtonLabel: "Language",
  },
  ja: {
    headerTitle: "半径可視化マップ",
    headerDescription: "地図上の地点から半径を図示。郵便番号や施設名で検索できます。",
    toggleSidebarShow: "サイドバーを表示",
    toggleSidebarHide: "サイドバーを隠す",
    radiusLabel: "半径",
    unitLabel: "単位",
    unitKmOption: "km",
    unitMiOption: "mile",
    searchLabel: "場所検索（郵便番号・施設名など）",
    searchPlaceholder: "例：606-8501 / 京都大学 吉田キャンパス / Tokyo Station",
    searchStatusSearching: "検索中…",
    formatResultsCount: (count: number) => `${count}件`,
    currentLocationTitle: "現在の地点",
    radiusTerm: "半径",
    centerCoordinatesTerm: "中心座標",
    mapClickHint: "地図をクリックして中心点を変更できます。",
    saveCurrentButton: "この地点を保存",
    alreadySavedButton: "保存済みの地点",
    savedLocationsTitle: "保存した地点",
    downloadLocationsButton: "ダウンロード",
    uploadLocationsButton: "アップロード",
    noSavedLocations: "まだ保存された地点はありません。",
    editLabelHeading: "ラベルを編集",
    saveLabelButton: "保存",
    cancelButton: "キャンセル",
    editLabelButton: "ラベルを編集",
    deleteSavedLabel: (label: string) => `${label} を削除`,
    mapPopupTitle: "中心点",
    footerNote: (
      <>
        * 検索は {NOMINATIM_LINK} ({OSM_LINK}) を使用しています。高頻度利用や商用利用時は各種ポリシーの遵守をご確認ください。
      </>
    ),
    confirmDelete: "この地点を削除しますか？",
    formatDefaultSavedLabel: (lat: number, lng: number) => `地点 ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
    languageButtonLabel: "表示言語",
  },
};

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

// Added: re-layout when the container size changes so map bounds stay correct
function InvalidateSizeOnResize() {
  const map = useMap();
  useEffect(() => {
    const invalidate = () => map.invalidateSize();
    map.whenReady(() => {
      // Recalculate right after the initial layout settles
      requestAnimationFrame(invalidate);
      setTimeout(invalidate, 0);
    });
    window.addEventListener("resize", invalidate);
    return () => window.removeEventListener("resize", invalidate);
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
  const [radiusInput, setRadiusInput] = useState<string>("5");
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [language, setLanguage] = useState<Language>("ja");
  const [isSearchLocked, setIsSearchLocked] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const debSearch = useDebounced(search, 400);
  const t = translations[language];
  const languageOptions: Language[] = ["en", "ja"];

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
        setCenter({ lat: e.latlng.lat, lng: e.latlng.lng });
      }
      map.on("click", onClick);
      return () => {
        map.off("click", onClick);
      };
    }, [map]);
    return null;
  }

  const handleSelectPlace = (g: GeocodeResult) => {
    setCenter({ lat: parseFloat(g.lat), lng: parseFloat(g.lon) });
    setSearch(g.display_name);
    setIsSearchLocked(true);
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
              .map((item) => ({
                id: typeof item.id === "string" ? item.id : generateId(),
                label: typeof item.label === "string" ? item.label : "",
                lat: Number(item.lat),
                lng: Number(item.lng),
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
      { id: generateId(), label, lat: center.lat, lng: center.lng },
    ]);
  };

  const handleDownloadLocations = () => {
    if (savedLocations.length === 0 || typeof window === "undefined") return;
    const payload = JSON.stringify(
      savedLocations.map(({ id, label, lat, lng }) => ({ id, label, lat, lng })),
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
        .map((item) => {
          if (!isValidUploadedItem(item)) return null;
          const lat = Number(item.lat);
          const lng = Number(item.lng);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
          const rawLabel = typeof item.label === "string" ? item.label : "";
          const label = rawLabel.trim() || t.formatDefaultSavedLabel(lat, lng);
          const id = typeof item.id === "string" ? item.id : generateId();
          return { id, label, lat, lng };
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
      setCenter({ lat: normalized[0].lat, lng: normalized[0].lng });
    } catch (err) {
      if (typeof window !== "undefined" && window.alert) {
        window.alert("Failed to read locations file.");
      }
    }
  };

  const handleSelectSaved = (location: SavedLocation) => {
    setCenter({ lat: location.lat, lng: location.lng });
    setSearch(location.label);
    setIsSearchLocked(true);
    setSelectedLocationId(location.id);
    setResults([]);
    setIsSearching(false);
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

  return (
    <>
      {/* Ensure full-height layout for header + main, footer sits outside */}
      <div className="min-h-screen h-screen bg-slate-50 text-slate-900 flex flex-col">
      <header className="sticky top-0 z-[1000] bg-white/80 backdrop-blur border-b border-slate-200">
        <div className="w-full px-6 py-3 flex items-center gap-3 justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsSidebarOpen((prev) => !prev)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-600 hover:border-slate-400"
              aria-pressed={isSidebarOpen}
              aria-label={isSidebarOpen ? t.toggleSidebarHide : t.toggleSidebarShow}
            >
              <svg
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="4" y1="6" x2="20" y2="6" />
                <line x1="4" y1="12" x2="20" y2="12" />
                <line x1="4" y1="18" x2="20" y2="18" />
              </svg>
            </button>
            <div>
              <h1 className="text-2xl font-semibold">{t.headerTitle}</h1>
              <p className="text-sm text-slate-600">{t.headerDescription}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="inline-flex rounded-full border border-slate-300 bg-white shadow-sm overflow-hidden"
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
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
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
      <main className="flex-1 w-full px-6 py-4 pb-4 flex flex-col gap-4 md:flex-row">
        {/* sidebar */}
        {isSidebarOpen && (
          <aside className="text-sm text-slate-700 shrink-0 md:w-72 lg:w-80 space-y-4 order-2 md:order-1">
            <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-sm space-y-4">
              <div className="flex gap-3">
                <div className="flex flex-col gap-2 flex-1">
                  <label className="text-xs text-slate-600">{t.radiusLabel}</label>
                  <input
                    type="number"
                    step="0.1"
                    min={0}
                    value={radiusInput}
                    onChange={(e) => setRadiusInput(e.target.value)}
                    className="h-10 rounded-xl border border-slate-300 px-3 focus:outline-none focus:ring-2 focus:ring-sky-400"
                  />
                </div>
                <div className="flex flex-col gap-2 flex-1">
                  <label className="text-xs text-slate-600">{t.unitLabel}</label>
                  <select
                    className="h-10 rounded-xl border border-slate-300 px-3 bg-white"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value as any)}
                  >
                    <option value="km">{t.unitKmOption}</option>
                    <option value="mi">{t.unitMiOption}</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-600">{t.searchLabel}</label>
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
                    className="h-10 w-full rounded-xl border border-slate-300 px-3 pr-10 focus:outline-none focus:ring-2 focus:ring-sky-400"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-500">
                    {isSearching
                      ? t.searchStatusSearching
                      : results.length
                        ? t.formatResultsCount(results.length)
                        : ""}
                  </div>
                  {results.length > 0 && (
                    <div className="absolute z-[1100] mt-1 w-full rounded-xl border border-slate-200 bg-white shadow">
                      {results.map((g, i) => (
                        <button
                          key={i}
                          onClick={() => handleSelectPlace(g)}
                          className="block w-full text-left px-3 py-2 hover:bg-slate-50"
                        >
                          <div className="text-sm line-clamp-1" title={g.display_name}>{g.display_name}</div>
                          <div className="text-xs text-slate-500">{g.type}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-sm">
              <div className="font-semibold text-slate-900 mb-2">{t.currentLocationTitle}</div>
              <dl className="text-xs space-y-2">
                <div>
                  <dt className="text-slate-500">{t.radiusTerm}</dt>
                  <dd className="font-mono text-base">{metersToReadable(radiusMeters)}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">{t.centerCoordinatesTerm}</dt>
                  <dd className="font-mono text-base">
                    {center.lat.toFixed(5)}, {center.lng.toFixed(5)}
                  </dd>
                </div>
              </dl>
              <p className="text-xs text-slate-500 mt-3">{t.mapClickHint}</p>
              <button
                onClick={handleSaveLocation}
                disabled={isCurrentLocationSaved}
                className="mt-4 w-full rounded-lg bg-sky-600 text-white px-4 py-2 text-sm font-semibold disabled:bg-slate-300"
              >
                {isCurrentLocationSaved ? t.alreadySavedButton : t.saveCurrentButton}
              </button>
            </div>
            <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-sm flex-1 min-h-[180px]">
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="font-semibold text-slate-900">{t.savedLocationsTitle}</div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadLocations}
                    disabled={savedLocations.length === 0}
                    className="text-xs font-semibold px-3 py-1.5 rounded border border-slate-200 text-slate-600 hover:border-sky-400 hover:text-sky-700 disabled:text-slate-400 disabled:border-slate-200"
                  >
                    {t.downloadLocationsButton}
                  </button>
                  <button
                    type="button"
                    onClick={handleTriggerUpload}
                    className="text-xs font-semibold px-3 py-1.5 rounded border border-slate-200 text-slate-600 hover:border-sky-400 hover:text-sky-700"
                  >
                    {t.uploadLocationsButton}
                  </button>
                  <input
                    ref={uploadInputRef}
                    type="file"
                    accept="application/json"
                    className="hidden"
                    onChange={handleUploadLocations}
                  />
                </div>
              </div>
              {savedLocations.length === 0 ? (
                <div className="text-xs text-slate-500">{t.noSavedLocations}</div>
              ) : (
                <ul className="space-y-2 max-h-80 overflow-auto pr-1">
                  {savedLocations.map((location) => {
                    const isEditing = editingId === location.id;
                    return (
                      <li key={location.id} className="text-xs">
                        {isEditing ? (
                          <div className="border border-sky-400 rounded-lg px-3 py-2 bg-sky-50">
                            <label className="block text-[10px] text-slate-500 mb-1">{t.editLabelHeading}</label>
                            <input
                              value={editingLabel}
                              onChange={(e) => setEditingLabel(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && editingLabel.trim()) handleCommitEditing();
                                if (e.key === "Escape") handleCancelEditing();
                              }}
                              autoFocus
                              className="w-full rounded border border-slate-300 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-sky-400"
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
                                className="flex-1 rounded border border-slate-200 text-slate-600 py-1"
                              >
                                {t.cancelButton}
                              </button>
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
                            className={`w-full border rounded-lg px-3 py-2 transition ${
                              selectedLocationId === location.id
                                ? "border-sky-500 text-sky-700 shadow-inner"
                                : "border-slate-200 hover:border-sky-400 hover:text-sky-600"
                            }`}
                          >
                            <div className="font-medium">{location.label}</div>
                            <div className="font-mono text-slate-500">
                              {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
                            </div>
                            {selectedLocationId === location.id && (
                              <div className="mt-2 flex gap-2">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStartEditing(location);
                                  }}
                                  className="flex-1 rounded border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-sky-400 hover:text-sky-700"
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
          </aside>
        )}

        {/* map area */}
        <div className="rounded-lg overflow-hidden border border-slate-200 flex-1 min-h-[320px] order-1 md:order-2">
          <MapContainer
            center={[center.lat, center.lng]}
            zoom={13}
            className="h-full w-full"
            scrollWheelZoom
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {/* Added: force size recalculation */}
            <InvalidateSizeOnResize />
            <RecenterOn center={center} />
            <ClickSetter />
            <Marker position={[center.lat, center.lng]}>
              <Popup>
                {t.mapPopupTitle}
                <br />
                {center.lat.toFixed(6)}, {center.lng.toFixed(6)}
              </Popup>
            </Marker>
            {radiusMeters > 0 && (
              <Circle center={[center.lat, center.lng]} radius={radiusMeters} pathOptions={{ fillOpacity: 0.1 }} />
            )}
          </MapContainer>
        </div>
      </main>

      </div>
      <footer className="w-full p-4 text-xs text-slate-500 bg-slate-50 border-t border-slate-200">
        {t.footerNote}
      </footer>
    </>
  );
}
