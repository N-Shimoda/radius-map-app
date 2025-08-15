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

const DEFAULT_CENTER: LatLng = { lat: 35.681236, lng: 139.767125 }; // 東京駅

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

  return (
    // 画面全高 + 縦方向レイアウト
    <div className="min-h-screen h-screen bg-slate-50 text-slate-900 flex flex-col">
      <header className="sticky top-0 z-[1000] bg-white/80 backdrop-blur border-b border-slate-200">
        <div className="w-full px-6 py-3 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="flex-1 min-w-[200px]">
            <h1 className="text-2xl font-semibold">半径可視化マップ</h1>
            <p className="text-sm text-slate-600">地図上の地点から半径を図示。郵便番号や施設名で検索できます。</p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col">
              <label className="text-xs text-slate-600">半径</label>
              <input
                type="number"
                step="0.1"
                min={0}
                value={radiusInput}
                onChange={(e) => setRadiusInput(e.target.value)}
                className="h-10 w-28 rounded-xl border border-slate-300 px-3 focus:outline-none focus:ring-2 focus:ring-sky-400"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-xs text-slate-600">単位</label>
              <select
                className="h-10 w-28 rounded-xl border border-slate-300 px-3 bg-white"
                value={unit}
                onChange={(e) => setUnit(e.target.value as any)}
              >
                <option value="km">km</option>
                <option value="mi">mile</option>
              </select>
            </div>
            <div className="flex-1 min-w-[280px]">
              <label className="text-xs text-slate-600">場所検索（郵便番号・施設名など）</label>
              <div className="relative">
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
        </div>
      </header>

      {/* 縦方向のflexカラム。gapで下テキストとの重なりを回避 */}
      <main className="flex-1 w-full px-6 py-4 pb-4 flex flex-col gap-3">
        {/* 地図ラッパはflex-1で残り高さを全て使う */}
        <div className="rounded-lg overflow-hidden border border-slate-200 flex-1">
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

        {/* 情報列（mapの下）。shrink-0 なので高さが確保され、footerと重ならない */}
        <div className="mt-0 text-sm text-slate-600 shrink-0">
          現在の半径: <span className="font-mono">{metersToReadable(radiusMeters)}</span>{" "}
          | 中心: <span className="font-mono">{center.lat.toFixed(5)}, {center.lng.toFixed(5)}</span>
          <div className="mt-1">地図をクリックして中心点を変更できます。</div>
        </div>
      </main>

      <footer className="w-full p-4 text-xs text-slate-500">
        * 検索は Nominatim (OpenStreetMap) を使用しています。高頻度利用や商用利用時は各種ポリシーの遵守をご確認ください。
      </footer>
    </div>
  );
}
