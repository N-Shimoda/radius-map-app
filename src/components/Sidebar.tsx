import type { ChangeEventHandler, RefObject } from "react";
import { IoCloudUploadOutline, IoTrashOutline } from "react-icons/io5";
import { AiOutlineDownload, AiOutlineEye, AiOutlineEyeInvisible } from "react-icons/ai";
import { type Language, type Translation } from "../i18n";
import { DEFAULT_CIRCLE_COLOR } from "../constants/mapColors";
import { type GeocodeResult, type LatLng, type SavedLocation } from "../types";
import { LocationSummary } from "./LocationSummary";

type SidebarProps = {
  language: Language;
  t: Translation;
  search: string;
  results: GeocodeResult[];
  searchStatusText: string;
  onSearchChange: (value: string) => void;
  onSelectResult: (result: GeocodeResult) => void;
  radiusInput: string;
  radiusWarning: string | null;
  onRadiusChange: (value: string) => void;
  unit: "km" | "mi";
  onUnitChange: (value: "km" | "mi") => void;
  center: LatLng;
  sidebarLocationName: string;
  sidebarDetailedAddress?: string | null;
  centerPinColor: string;
  isSidebarPlaceholderLabel: boolean;
  isCircleVisible: boolean;
  onToggleCircleVisibility: () => void;
  onSaveLocation: () => void;
  isCurrentLocationSaved: boolean;
  savedLocations: SavedLocation[];
  selectedLocationId: string | null;
  editingId: string | null;
  editingLabel: string;
  onEditingLabelChange: (value: string) => void;
  onStartEditing: (location: SavedLocation) => void;
  onCommitEditing: () => void;
  onCancelEditing: () => void;
  onDeleteLocation: (id: string) => void;
  onToggleLocationVisibility: (id: string) => void;
  onSelectSaved: (location: SavedLocation) => void;
  onTriggerUpload: () => void;
  onDownload: () => void;
  uploadInputRef: RefObject<HTMLInputElement>;
  onUploadLocations: ChangeEventHandler<HTMLInputElement>;
};

export function Sidebar({
  language,
  t,
  search,
  results,
  searchStatusText,
  onSearchChange,
  onSelectResult,
  radiusInput,
  radiusWarning,
  onRadiusChange,
  unit,
  onUnitChange,
  center,
  sidebarLocationName,
  sidebarDetailedAddress,
  centerPinColor,
  isSidebarPlaceholderLabel,
  isCircleVisible,
  onToggleCircleVisibility,
  onSaveLocation,
  isCurrentLocationSaved,
  savedLocations,
  selectedLocationId,
  editingId,
  editingLabel,
  onEditingLabelChange,
  onStartEditing,
  onCommitEditing,
  onCancelEditing,
  onDeleteLocation,
  onToggleLocationVisibility,
  onSelectSaved,
  onTriggerUpload,
  onDownload,
  uploadInputRef,
  onUploadLocations,
}: SidebarProps) {
  const searchCardTitle = language === "ja" ? "地点検索" : "Location Search";

  return (
    <aside className="relative z-[1000] text-sm text-slate-700 dark:text-slate-200 shrink-0 md:w-72 lg:w-80 flex flex-col gap-4 order-2 md:order-1 md:max-h-full md:min-h-0 overflow-hidden">
      <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 bg-white dark:bg-slate-800 shadow-sm space-y-4">
        <div>
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">
            {searchCardTitle}
          </div>
          <label className="text-xs text-slate-600 dark:text-slate-300">
            {t.searchLabel}
          </label>
          <div className="relative mt-1">
            <input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && results[0]) {
                  onSelectResult(results[0]);
                }
              }}
              placeholder={t.searchPlaceholder}
              className="h-10 w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900/50 text-slate-900 dark:text-slate-100 px-3 pr-10 focus:outline-none focus:ring-2 focus:ring-sky-400"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-500 dark:text-slate-300">
              {searchStatusText}
            </div>
            {results.length > 0 && (
              <div className="absolute z-[1100] mt-1 w-full rounded-xl border border-slate-200 bg-white/90 shadow dark:border-slate-700 dark:bg-slate-800/90">
                {results.map((g, i) => (
                  <button
                    key={`${g.display_name}-${i}`}
                    onClick={() => onSelectResult(g)}
                    className="block w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700"
                  >
                    <div className="text-sm line-clamp-1" title={g.display_name}>
                      {g.display_name}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {g.type}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-3">
          <div className="flex flex-col gap-2 flex-1">
            <label className="text-xs text-slate-600 dark:text-slate-300">
              {t.radiusLabel}
            </label>
            <input
              type="number"
              step="0.1"
              min={0}
              value={radiusInput}
              onChange={(e) => onRadiusChange(e.target.value)}
              className={`h-10 rounded-xl border px-3 bg-white text-slate-900 dark:bg-slate-900/50 dark:text-slate-100 focus:outline-none focus:ring-2 ${
                radiusWarning
                  ? "border-rose-400 focus:ring-rose-300"
                  : "border-slate-300 focus:ring-sky-400 dark:border-slate-600"
              }`}
            />
          </div>
          <div className="flex flex-col gap-2 flex-1">
            <label className="text-xs text-slate-600 dark:text-slate-300">
              {t.unitLabel}
            </label>
            <select
              className="h-10 rounded-xl border border-slate-300 dark:border-slate-600 px-3 bg-white dark:bg-slate-900/50 dark:text-slate-100"
              value={unit}
              onChange={(e) => onUnitChange(e.target.value as "km" | "mi")}
            >
              <option value="km">{t.unitKmOption}</option>
              <option value="mi">{t.unitMiOption}</option>
            </select>
          </div>
        </div>
        <div className="pt-4 border-t border-slate-100 dark:border-slate-700 space-y-3">
          <div className="text-xs text-slate-500 dark:text-slate-300">
            {t.currentLocationTitle}
          </div>
          <div className="w-full border rounded-lg px-3 py-2 bg-white/70 dark:bg-slate-900/40 border-slate-200 dark:border-slate-600">
            <LocationSummary
              label={sidebarLocationName}
              lat={center.lat}
              lng={center.lng}
              color={centerPinColor}
              colorLabel={t.circleColorLabel}
              fullAddress={sidebarDetailedAddress}
              labelVariant={isSidebarPlaceholderLabel ? "placeholder" : "default"}
              actionSlot={
                <button
                  type="button"
                  onClick={onToggleCircleVisibility}
                  className={`rounded-full border px-2 py-1 text-[11px] font-semibold transition flex items-center justify-center ${
                    isCircleVisible
                      ? "border-sky-200 text-sky-700 hover:border-sky-400 dark:border-sky-500 dark:text-sky-300"
                      : "border-slate-200 text-slate-500 hover:border-slate-400 dark:border-slate-600 dark:text-slate-300"
                  }`}
                  aria-label={isCircleVisible ? t.hideCircleButton : t.showCircleButton}
                >
                  {isCircleVisible ? (
                    <AiOutlineEye aria-hidden="true" size={18} />
                  ) : (
                    <AiOutlineEyeInvisible aria-hidden="true" size={18} />
                  )}
                </button>
              }
            />
          </div>
          <button
            onClick={onSaveLocation}
            disabled={isCurrentLocationSaved}
            className="w-full rounded-lg bg-sky-600 text-white px-4 py-2 text-sm font-semibold disabled:bg-slate-300 dark:disabled:bg-slate-600"
          >
            {isCurrentLocationSaved ? t.alreadySavedButton : t.saveCurrentButton}
          </button>
        </div>
      </div>

      <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 bg-white dark:bg-slate-800 shadow-sm flex-1 min-h-[240px] flex flex-col">
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="font-semibold text-slate-900 dark:text-slate-100">
            {t.savedLocationsTitle}
          </div>
          <div className="flex items-center gap-2">
            <div className="relative group z-[1000]">
              <button
                type="button"
                onClick={onTriggerUpload}
                aria-label={t.uploadLocationsButton}
                className="flex h-9 w-9 items-center justify-center rounded border border-slate-200 text-slate-600 hover:border-sky-400 hover:text-sky-700 dark:border-slate-600 dark:text-slate-200 dark:hover:border-sky-500 dark:hover:text-sky-300"
              >
                <IoCloudUploadOutline className="h-5 w-5" aria-hidden="true" />
              </button>
              <div className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 rounded bg-white text-slate-900 text-[10px] px-2 py-1 whitespace-nowrap opacity-0 group-hover:opacity-100 group-hover:-translate-y-1 transition shadow dark:bg-slate-800 dark:text-slate-100 dark:shadow-lg z-[1200]">
                {t.uploadTooltip}
              </div>
            </div>
            <div className="relative group z-[1000]">
              <button
                type="button"
                onClick={onDownload}
                disabled={savedLocations.length === 0}
                aria-label={t.downloadLocationsButton}
                className="flex h-9 w-9 items-center justify-center rounded border border-slate-200 text-slate-600 hover:border-sky-400 hover:text-sky-700 disabled:text-slate-400 disabled:border-slate-200 dark:border-slate-600 dark:text-slate-200 dark:hover:border-sky-500 dark:hover:text-sky-300 dark:disabled:text-slate-500"
              >
                <AiOutlineDownload className="h-5 w-5" aria-hidden="true" />
              </button>
              <div className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 rounded bg-white text-slate-900 text-[10px] px-2 py-1 whitespace-nowrap opacity-0 group-hover:opacity-100 group-hover:-translate-y-1 transition shadow dark:bg-slate-800 dark:text-slate-100 dark:shadow-lg z-[1200]">
                {t.downloadTooltip}
              </div>
            </div>
            <input
              ref={uploadInputRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={onUploadLocations}
            />
          </div>
        </div>
        <div className="flex-1 min-h-0">
          {savedLocations.length === 0 ? (
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {t.noSavedLocations}
            </div>
          ) : (
            <ul className="space-y-2 h-full overflow-auto pr-1">
              {savedLocations.map((location) => {
                const isEditing = editingId === location.id;
                const isSelected = selectedLocationId === location.id;
                const locationColor = location.color || DEFAULT_CIRCLE_COLOR;
                const colorBadge = (
                  <span
                    className="inline-flex h-4 w-4 shrink-0 rounded-full border border-slate-200 dark:border-slate-700"
                    style={{ backgroundColor: locationColor }}
                    aria-hidden="true"
                  />
                );

                const renderVisibilityButton = (stopPropagation = false) => (
                  <button
                    type="button"
                    onClick={(e) => {
                      if (stopPropagation) e.stopPropagation();
                      onToggleLocationVisibility(location.id);
                    }}
                    className={`rounded-full border px-2 py-1 text-[11px] font-semibold transition flex items-center justify-center ${
                      location.visible
                        ? "border-sky-200 text-sky-700 hover:border-sky-400 dark:border-sky-500 dark:text-sky-300"
                        : "border-slate-200 text-slate-500 hover:border-slate-400 dark:border-slate-600 dark:text-slate-300"
                    }`}
                    aria-label={
                      location.visible ? t.hideCircleButton : t.showCircleButton
                    }
                  >
                    {location.visible ? (
                      <AiOutlineEye aria-hidden="true" size={18} />
                    ) : (
                      <AiOutlineEyeInvisible aria-hidden="true" size={18} />
                    )}
                    <span className="sr-only">
                      {location.visible ? t.hideCircleButton : t.showCircleButton}
                    </span>
                  </button>
                );

                return (
                  <li key={location.id} className="text-xs">
                    {isEditing ? (
                      <div className="border rounded-lg px-3 py-2 bg-white/70 dark:bg-slate-900/40 border-slate-200 dark:border-slate-600">
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-[10px] text-slate-500 dark:text-slate-400">
                            {t.editLabelHeading}
                          </label>
                          {colorBadge}
                        </div>
                        <input
                          value={editingLabel}
                          onChange={(e) => onEditingLabelChange(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && editingLabel.trim()) {
                              onCommitEditing();
                            }
                            if (e.key === "Escape") {
                              onCancelEditing();
                            }
                          }}
                          autoFocus
                          className="w-full rounded border border-slate-300 dark:border-slate-600 px-2 py-1 text-xs bg-white dark:bg-slate-900/50 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-400"
                        />
                        <div className="flex gap-2 mt-2">
                          <button
                            type="button"
                            onClick={onCommitEditing}
                            disabled={!editingLabel.trim()}
                            className="flex-1 rounded bg-sky-600 text-white py-1 font-semibold disabled:bg-slate-300"
                          >
                            {t.saveLabelButton}
                          </button>
                          <button
                            type="button"
                            onClick={onCancelEditing}
                            className="flex-1 rounded border border-slate-200 text-slate-600 py-1 dark:border-slate-600 dark:text-slate-200"
                          >
                            {t.cancelButton}
                          </button>
                        </div>
                        <div className="mt-3 flex justify-end">{renderVisibilityButton()}</div>
                      </div>
                    ) : (
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => onSelectSaved(location)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onSelectSaved(location);
                          }
                        }}
                        className={`w-full border rounded-lg px-3 py-2 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
                          isSelected
                            ? "shadow-inner ring-1 ring-sky-300 dark:ring-sky-500 bg-white/70 dark:bg-slate-900/40 border-slate-300 dark:border-slate-600"
                            : "border-slate-200 hover:border-sky-400 dark:border-slate-600 dark:hover:border-sky-500 bg-white/60 dark:bg-slate-900/30"
                        }`}
                      >
                        <LocationSummary
                          label={location.label}
                          fullAddress={location.fullAddress}
                          lat={location.lat}
                          lng={location.lng}
                          color={locationColor}
                          colorLabel={t.circleColorLabel}
                          actionSlot={renderVisibilityButton(true)}
                        />
                        {isSelected && (
                          <div className="mt-2 flex gap-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onStartEditing(location);
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
                                onDeleteLocation(location.id);
                              }}
                              className="flex-1 flex items-center justify-center gap-1 rounded border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:border-rose-400 hover:text-rose-700"
                            >
                              <IoTrashOutline className="h-4 w-4" aria-hidden="true" />
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
  );
}

export default Sidebar;
