import { Outlet, NavLink, useNavigate } from "react-router";
import { useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useMuseum } from "../context/MuseumContext";
import {
  LayoutDashboard,
  Radio,
  AlertTriangle,
  Settings,
  User,
  LogOut,
  FileBarChart,
} from "lucide-react";
import { Button } from "./ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "./ui/alert-dialog";
import logoImage from "figma:asset/d83767957783007976f4c71d1b997e4eb7d271d2.png";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Sensors", href: "/dashboard/sensors", icon: Radio },
  { name: "Alerts", href: "/dashboard/alerts", icon: AlertTriangle },
  { name: "Manage Users", href: "/dashboard/settings", icon: Settings, adminOnly: true },
  { name: "Reports", href: "/dashboard/reports", icon: FileBarChart },
];

export default function Layout() {
  const navigate = useNavigate();
  const { user, logout, isAdmin } = useAuth();
  const { setNavigateToAlerts } = useMuseum();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!user) {
      navigate("/");
    }
  }, [user, navigate]);

  // Set up navigation callback for alerts
  useEffect(() => {
    setNavigateToAlerts(() => navigate("/dashboard/alerts"));
  }, [navigate, setNavigateToAlerts]);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 w-64 bg-white border-r border-gray-200 z-50">
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-gray-200">
            <div className="mb-4 rounded-lg overflow-hidden">
              <img src={logoImage} alt="Hiyas Museum" className="w-full h-auto" />
            </div>
            <h1 className="text-lg font-bold text-gray-900 text-center">Hiyas Museum</h1>
            <p className="text-xs text-gray-600 text-center">Monitoring System</p>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1">
            {navigation.map((item) => {
              // Hide admin-only pages for non-admin users
              if (item.adminOnly && !isAdmin) {
                return null;
              }
              
              return (
                <NavLink
                  key={item.name}
                  to={item.href}
                  end={item.href === "/dashboard"}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                      isActive
                        ? "bg-blue-50 text-blue-600"
                        : "text-gray-700 hover:bg-gray-50"
                    }`
                  }
                >
                  <item.icon className="w-5 h-5" />
                  <span className="font-medium">{item.name}</span>
                </NavLink>
              );
            })}
          </nav>

          {/* User profile */}
          <div className="p-4 border-t border-gray-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900 capitalize">{user.username}</p>
                <p className="text-sm text-gray-600 capitalize">{user.role}</p>
              </div>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirm Logout</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to logout? You will need to sign in again to access the system.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleLogout}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    Logout
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="pl-64">
        <main className="p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}