# Radius Visualization Map

This web app uses React and Leaflet to draw a circle with an arbitrary radius from any location on the map. It supports search by postal code or facility name, switching between kilometers and miles, and recentering by clicking on the map.

## Features

- **Radius input**: Enter a number (0.1 increments) to change the radius of the circle.
- **Unit toggle**: Switch between kilometers and miles.
- **Place search**: Search by postal code or facility name and jump to a suggested result.
- **Map click**: Click anywhere on the map to move the center point.
- **Radius display**: Shows the converted radius in meters and renders it as a circle.

## Usage

1. Enter a value in the radius field (e.g., 5).
2. Choose either km or mi as the unit.
3. Enter a postal code or facility name in the search box and pick a suggestion.
4. Click on the map to move the center point.
5. The circle will update to show the selected radius on the map.

## Local Development

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd <folder-name>
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
4. Open the displayed URL (e.g., http://localhost:5173) in your browser.

## Tech Stack

- React 18
- TypeScript
- Vite
- Tailwind CSS
- Leaflet / React-Leaflet
- Nominatim API (OpenStreetMap)

## Notes

- Place search uses the Nominatim API. Review its usage policy for high-frequency or commercial use.
- Search reliability depends on the API response. Requests may fail when the network or API is congested.

---

© 2025
