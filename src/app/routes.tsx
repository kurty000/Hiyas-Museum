import { createBrowserRouter } from "react-router";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Sensors from "./pages/Sensors";
import Alerts from "./pages/Alerts";
import Settings from "./pages/Settings";
import Reports from "./pages/Reports";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Landing,
  },
  {
    path: "/login",
    Component: Login,
  },
  {
    path: "/dashboard",
    Component: Layout,
    children: [
      { index: true, Component: Dashboard },
      { path: "sensors", Component: Sensors },
      { path: "alerts", Component: Alerts },
      { path: "settings", Component: Settings },
      { path: "reports", Component: Reports },
    ],
  },
]);