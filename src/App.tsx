import React, { useEffect, useMemo, useState } from "react";
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

const DEFAULT_CENTER: LatLng = { lat: 35.681236, lng: 139.767125 }; // 東京駅
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

// ★ 追加: コンテナサイズ変化時に再レイアウト（地図範囲が広がらない対策）
function InvalidateSizeOnResize() {
  const map = useMap();
  useEffect(() => {
    const invalidate = () => map.invalidateSize();
    map.whenReady(() => {
      // 初期レイアウト確定後に再計算
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
  const debSearch = useDebounced(search, 400);

  const radiusMeters = useMemo(() => {
    const r = Number(radiusInput);
    if (!isFinite(r) || r < 0) return 0;
    return unit === "km" ? r * 1000 : r * 1609.344;
  }, [radiusInput, unit]);

  // Live search with Nominatim (OpenStreetMap)
  useEffect(() => {
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
        url.searchParams.set("accept-language", "ja");
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
  }, [debSearch]);

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
    const label =
      search.trim() ||
      `地点 ${center.lat.toFixed(4)}, ${center.lng.toFixed(4)}`;
    setSavedLocations((prev) => [
      ...prev,
      { id: generateId(), label, lat: center.lat, lng: center.lng },
    ]);
  };

  const handleSelectSaved = (location: SavedLocation) => {
    setCenter({ lat: location.lat, lng: location.lng });
    setSearch(location.label);
    setSelectedLocationId(location.id);
  };

  const handleStartEditing = (location: SavedLocation) => {
    setSelectedLocationId(location.id);
    setEditingId(location.id);
    setEditingLabel(location.label);
  };

  const handleDeleteLocation = (id: string) => {
    if (typeof window !== "undefined") {
      const ok = window.confirm("この地点を削除しますか？");
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
    // 画面全高 + 縦方向レイアウト
    <div className="min-h-screen h-screen bg-slate-50 text-slate-900 flex flex-col">
      <header className="sticky top-0 z-[1000] bg-white/80 backdrop-blur border-b border-slate-200">
        <div className="w-full px-6 py-3 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsSidebarOpen((prev) => !prev)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-600 hover:border-slate-400"
            aria-pressed={isSidebarOpen}
            aria-label={isSidebarOpen ? "サイドバーを隠す" : "サイドバーを表示"}
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
            <h1 className="text-2xl font-semibold">半径可視化マップ</h1>
            <p className="text-sm text-slate-600">地図上の地点から半径を図示。郵便番号や施設名で検索できます。</p>
          </div>
        </div>
      </header>

      {/* map + sidebar layout */}
      <main className="flex-1 w-full px-6 py-4 pb-4 flex flex-col gap-4 md:flex-row">
        {/* sidebar */}
        {isSidebarOpen && (
          <aside className="text-sm text-slate-700 shrink-0 md:w-80 lg:w-96 space-y-4 order-2 md:order-1">
            <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-sm space-y-4">
              <div className="flex gap-3">
                <div className="flex flex-col gap-2 flex-1">
                  <label className="text-xs text-slate-600">半径</label>
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
                  <label className="text-xs text-slate-600">単位</label>
                  <select
                    className="h-10 rounded-xl border border-slate-300 px-3 bg-white"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value as any)}
                  >
                    <option value="km">km</option>
                    <option value="mi">mile</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-600">場所検索（郵便番号・施設名など）</label>
                <div className="relative mt-1">
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && results[0]) handleSelectPlace(results[0]);
                    }}
                    placeholder="例：606-8501 / 京都大学 吉田キャンパス / Tokyo Station"
                    className="h-10 w-full rounded-xl border border-slate-300 px-3 pr-10 focus:outline-none focus:ring-2 focus:ring-sky-400"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-500">
                    {isSearching ? "検索中…" : results.length ? `${results.length}件` : ""}
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
              <div className="font-semibold text-slate-900 mb-2">現在の地点</div>
              <dl className="text-xs space-y-2">
                <div>
                  <dt className="text-slate-500">半径</dt>
                  <dd className="font-mono text-base">{metersToReadable(radiusMeters)}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">中心座標</dt>
                  <dd className="font-mono text-base">
                    {center.lat.toFixed(5)}, {center.lng.toFixed(5)}
                  </dd>
                </div>
              </dl>
              <p className="text-xs text-slate-500 mt-3">地図をクリックして中心点を変更できます。</p>
              <button
                onClick={handleSaveLocation}
                disabled={isCurrentLocationSaved}
                className="mt-4 w-full rounded-lg bg-sky-600 text-white px-4 py-2 text-sm font-semibold disabled:bg-slate-300"
              >
                {isCurrentLocationSaved ? "保存済みの地点" : "この地点を保存"}
              </button>
            </div>
            <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-sm flex-1 min-h-[180px]">
              <div className="font-semibold text-slate-900 mb-2">保存した地点</div>
              {savedLocations.length === 0 ? (
                <div className="text-xs text-slate-500">まだ保存された地点はありません。</div>
              ) : (
                <ul className="space-y-2 max-h-80 overflow-auto pr-1">
                  {savedLocations.map((location) => {
                    const isEditing = editingId === location.id;
                    return (
                      <li key={location.id} className="text-xs">
                        {isEditing ? (
                          <div className="border border-sky-400 rounded-lg px-3 py-2 bg-sky-50">
                            <label className="block text-[10px] text-slate-500 mb-1">ラベルを編集</label>
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
                                保存
                              </button>
                              <button
                                type="button"
                                onClick={handleCancelEditing}
                                className="flex-1 rounded border border-slate-200 text-slate-600 py-1"
                              >
                                キャンセル
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
                                  ラベルを編集
                                </button>
                                <button
                                  type="button"
                                  aria-label={`${location.label} を削除`}
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
            {/* ★ 追加: サイズ再計算 */}
            <InvalidateSizeOnResize />
            <RecenterOn center={center} />
            <ClickSetter />
            <Marker position={[center.lat, center.lng]}>
              <Popup>
                中心点<br />
                {center.lat.toFixed(6)}, {center.lng.toFixed(6)}
              </Popup>
            </Marker>
            {radiusMeters > 0 && (
              <Circle center={[center.lat, center.lng]} radius={radiusMeters} pathOptions={{ fillOpacity: 0.1 }} />
            )}
          </MapContainer>
        </div>
      </main>

      <footer className="w-full p-4 text-xs text-slate-500">
        * 検索は Nominatim (OpenStreetMap) を使用しています。高頻度利用や商用利用時は各種ポリシーの遵守をご確認ください。
      </footer>
    </div>
  );
}
