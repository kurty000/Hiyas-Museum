# Hiyas Museum - IoT Museum Dashboard

An interactive and real-time IoT dashboard designed for the Hiyas Museum. This system provides a comprehensive interface to monitor and manage museum environments, track visitor engagement, and oversee IoT-enabled exhibits.

## What the System Does
- **Real-Time Monitoring:** Tracks environmental metrics (temperature, humidity, etc.) critical for artifact preservation using IoT sensors.
- **Visitor Analytics:** Displays visitor counts, engagement statistics, and foot traffic.
- **Exhibit Management:** Allows staff to manage and monitor the status of various interactive and connected exhibits.
- **Data Visualization:** Presents complex sensor data through intuitive charts and graphs for quick decision-making.

## Who Uses It
- **Museum Administrators:** To oversee daily operations, visitor statistics, and general facility status.
- **Curators & Conservators:** To ensure environmental conditions remain optimal for the safe preservation of artifacts.
- **Facility Managers:** To monitor the health and operational status of IoT devices, sensors, and exhibits across the museum.

## My Role
**Developer:** Responsible for building the frontend architecture, implementing the UI/UX design, and integrating real-time backend services (Firebase) to ensure a seamless, responsive, and dynamic user experience.

## Tools and Languages Used
- **Languages:** TypeScript, HTML, CSS
- **Frameworks & Libraries:** React 18, Vite
- **Styling & UI:** Tailwind CSS, Radix UI (shadcn/ui)
- **Backend & Real-time Data:** Firebase
- **Data Visualization:** Recharts
- **Animations:** Framer Motion
- **Icons:** Lucide React, Material UI Icons

## Running the Project Local Environment

1. Install the dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Build for production:
   ```bash
   npm run build
   ```


## Firebase security

Project: `hiyas-museum-da909`

Deploy rules after login:

```bash
npx firebase login
npm run firebase:deploy-rules
```

Also add `hiyas-museum.vercel.app` under Firebase Console → Authentication → Settings → Authorized domains.

### Environment variables (Vercel `/api/sensors`)

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `SENSOR_API_KEY`
