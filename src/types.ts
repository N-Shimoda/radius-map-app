export type LatLng = {
  lat: number;
  lng: number;
};

export type GeocodeResult = {
  display_name: string;
  lat: string;
  lon: string;
  type?: string;
};

export type SavedLocation = LatLng & {
  id: string;
  label: string;
  fullAddress?: string | null;
  visible: boolean;
  color: string;
};
