import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from "react-leaflet";
import type L from "leaflet";
import type { MutableRefObject } from "react";
import type { LatLng, SavedLocation } from "../types";
import { DEFAULT_CIRCLE_COLOR } from "../constants/mapColors";

type MapViewportProps = {
  center: LatLng;
  radiusMeters: number;
  isCircleVisible: boolean;
  savedLocations: SavedLocation[];
  centerPinColor: string;
  popupLabel: string;
  focusSavedLocation: (
    location: SavedLocation,
    options?: { keepPopupOpen?: boolean; inheritPopupState?: boolean },
  ) => void;
  getPinIcon: (color: string) => L.DivIcon;
  markerRef: MutableRefObject<L.Marker | null>;
  mapRef: MutableRefObject<L.Map | null>;
  onCenterPopupOpen: () => void;
  onCenterPopupClose: () => void;
  onSavedMarkerPopupOpen: (location: SavedLocation) => void;
  onSavedMarkerPopupClose: () => void;
  onMapClick: (coords: LatLng) => void;
};

export function MapViewport({
  center,
  radiusMeters,
  isCircleVisible,
  savedLocations,
  centerPinColor,
  popupLabel,
  focusSavedLocation,
  getPinIcon,
  markerRef,
  mapRef,
  onCenterPopupOpen,
  onCenterPopupClose,
  onSavedMarkerPopupOpen,
  onSavedMarkerPopupClose,
  onMapClick,
}: MapViewportProps) {
  const shouldShowCircles = radiusMeters > 0;

  return (
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
        <InvalidateSizeOnResize />
        <RecenterOn center={center} />
        <ClickSetter onMapClick={onMapClick} />
        <Marker
          position={[center.lat, center.lng]}
          ref={markerRef}
          icon={getPinIcon(centerPinColor)}
          eventHandlers={{
            popupopen: onCenterPopupOpen,
            popupclose: onCenterPopupClose,
          }}
        >
          <Popup autoPan={false}>
            {popupLabel}
            <br />
            {center.lat.toFixed(2)}, {center.lng.toFixed(2)}
          </Popup>
        </Marker>
        {shouldShowCircles && (
          <>
            {isCircleVisible && (
              <Circle
                center={[center.lat, center.lng]}
                radius={radiusMeters}
                pathOptions={{
                  color: centerPinColor,
                  fillColor: centerPinColor,
                  fillOpacity: 0.1,
                }}
              />
            )}
            {savedLocations.map((location) => {
              if (!location.visible) return null;
              const color = location.color || DEFAULT_CIRCLE_COLOR;
              return (
                <CircleMarkerGroup
                  key={location.id}
                  location={location}
                  radiusMeters={radiusMeters}
                  color={color}
                  focusSavedLocation={focusSavedLocation}
                  getPinIcon={getPinIcon}
                  onSavedMarkerPopupOpen={onSavedMarkerPopupOpen}
                  onSavedMarkerPopupClose={onSavedMarkerPopupClose}
                />
              );
            })}
          </>
        )}
      </MapContainer>
    </div>
  );
}

function ClickSetter({ onMapClick }: { onMapClick: (coords: LatLng) => void }) {
  const map = useMap();
  useEffect(() => {
    function handleClick(e: any) {
      onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng });
    }
    map.on("click", handleClick);
    return () => {
      map.off("click", handleClick);
    };
  }, [map, onMapClick]);
  return null;
}

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

type CircleMarkerGroupProps = {
  location: SavedLocation;
  radiusMeters: number;
  color: string;
  focusSavedLocation: (
    location: SavedLocation,
    options?: { keepPopupOpen?: boolean; inheritPopupState?: boolean },
  ) => void;
  getPinIcon: (color: string) => L.DivIcon;
  onSavedMarkerPopupOpen: (location: SavedLocation) => void;
  onSavedMarkerPopupClose: () => void;
};

function CircleMarkerGroup({
  location,
  radiusMeters,
  color,
  focusSavedLocation,
  getPinIcon,
  onSavedMarkerPopupOpen,
  onSavedMarkerPopupClose,
}: CircleMarkerGroupProps) {
  return (
    <>
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
          popupopen: () => onSavedMarkerPopupOpen(location),
          popupclose: onSavedMarkerPopupClose,
        }}
      >
        <Popup autoPan={false}>
          {location.label ?? `Saved location ${location.id}`}
          <br />
          {location.lat.toFixed(2)}, {location.lng.toFixed(2)}
        </Popup>
      </Marker>
    </>
  );
}

export default MapViewport;
