import { RouterProvider, createBrowserRouter, Outlet } from "react-router";
import { Toaster } from "sonner";
import { AuthProvider } from "./context/AuthContext";
import { MuseumProvider } from "./context/MuseumContext";
import Login from "./pages/Login";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Sensors from "./pages/Sensors";
import Alerts from "./pages/Alerts";
import Settings from "./pages/Settings";
import Reports from "./pages/Reports";

// Root wrapper with AuthProvider
function RootLayout() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  );
}

// Wrapper component for authenticated routes with providers
function AuthenticatedApp() {
  return (
    <MuseumProvider>
      <Toaster position="top-right" richColors />
      <Layout />
    </MuseumProvider>
  );
}

function App() {
  const router = createBrowserRouter([
    {
      path: "/",
      element: <RootLayout />,
      children: [
        {
          index: true,
          element: <Login />,
        },
        {
          path: "dashboard",
          element: <AuthenticatedApp />,
          children: [
            { index: true, Component: Dashboard },
            { path: "sensors", Component: Sensors },
            { path: "alerts", Component: Alerts },
            { path: "settings", Component: Settings },
            { path: "reports", Component: Reports },
          ],
        },
      ],
    },
  ]);

  return <RouterProvider router={router} />;
}

export default App;