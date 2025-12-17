import React from "react";

export type Language = "en" | "ja";

export type Translation = {
  headerTitle: string;
  headerDescription: string;
  toggleSidebarShow: string;
  toggleSidebarHide: string;
  radiusLabel: string;
  radiusInvalidMessage: string;
  unitLabel: string;
  unitKmOption: string;
  unitMiOption: string;
  searchLabel: string;
  searchPlaceholder: string;
  searchStatusSearching: string;
  formatResultsCount: (count: number) => string;
  currentLocationTitle: string;
  centerCoordinatesTerm: string;
  saveCurrentButton: string;
  alreadySavedButton: string;
  savedLocationsTitle: string;
  downloadLocationsButton: string;
  uploadLocationsButton: string;
  uploadTooltip: string;
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
  downloadTooltip: string;
  showCircleButton: string;
  hideCircleButton: string;
  circleColorLabel: string;
  reverseLookupStatus: string;
  reverseLookupError: string;
  selectedLocationPlaceholder: string;
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

export const translations: Record<Language, Translation> = {
  ja: {
    headerTitle: "半径可視化マップ",
    headerDescription: "地図上の地点から半径を図示。郵便番号や施設名で検索できます。",
    toggleSidebarShow: "サイドバーを表示",
    toggleSidebarHide: "サイドバーを隠す",
    radiusLabel: "半径",
    radiusInvalidMessage: "半径は数字のみで入力してください。",
    unitLabel: "単位",
    unitKmOption: "km",
    unitMiOption: "mile",
    searchLabel: "名称を入力",
    searchPlaceholder: "例：606-8501 / 京都大学 吉田キャンパス / Tokyo Station",
    searchStatusSearching: "検索中…",
    formatResultsCount: (count: number) => `${count}件`,
    currentLocationTitle: "現在の地点",
    centerCoordinatesTerm: "中心座標",
    saveCurrentButton: "この地点を保存",
    alreadySavedButton: "保存済みの地点",
    savedLocationsTitle: "保存した地点",
    downloadLocationsButton: "ダウンロード",
    uploadLocationsButton: "アップロード",
    uploadTooltip: "JSONファイルをアップロード",
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
    formatDefaultSavedLabel: (lat: number, lng: number) => `地点 ${lat.toFixed(2)}, ${lng.toFixed(2)}`,
    languageButtonLabel: "表示言語",
    downloadTooltip: "保存した地点をダウンロード",
    showCircleButton: "円を表示",
    hideCircleButton: "円を非表示",
    circleColorLabel: "円の色",
    reverseLookupStatus: "地点を取得中…",
    reverseLookupError: "地点情報を取得できませんでした",
    selectedLocationPlaceholder: "選択された地点",
  },
  en: {
    headerTitle: "Radius Visualization Map",
    headerDescription: "Visualize circles from any map point and search by postal code or place.",
    toggleSidebarShow: "Show sidebar",
    toggleSidebarHide: "Hide sidebar",
    radiusLabel: "Radius",
    radiusInvalidMessage: "Radius must contain digits only.",
    unitLabel: "Unit",
    unitKmOption: "km",
    unitMiOption: "mile",
    searchLabel: "Place search (postal code, facility, etc.)",
    searchPlaceholder: "e.g., 606-8501 / Kyoto University Yoshida Campus / Tokyo Station",
    searchStatusSearching: "Searching...",
    formatResultsCount: (count: number) => `${count} results`,
    currentLocationTitle: "Current Location",
    centerCoordinatesTerm: "Center coordinates",
    saveCurrentButton: "Save this location",
    alreadySavedButton: "Location saved",
    savedLocationsTitle: "Saved Locations",
    downloadLocationsButton: "Download",
    uploadLocationsButton: "Upload",
    uploadTooltip: "Upload JSON files.",
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
    formatDefaultSavedLabel: (lat: number, lng: number) => `Point ${lat.toFixed(2)}, ${lng.toFixed(2)}`,
    languageButtonLabel: "Language",
    downloadTooltip: "Download saved locations.",
    showCircleButton: "Show circle",
    hideCircleButton: "Hide circle",
    circleColorLabel: "Circle color",
    reverseLookupStatus: "Loading location…",
    reverseLookupError: "Unable to determine a name for that point",
    selectedLocationPlaceholder: "Selected location",
  },
};

export const languageDisplayNames: Record<Language, string> = {
  ja: "日本語",
  en: "English",
};

export const languageOptions: Language[] = ["ja", "en"];
