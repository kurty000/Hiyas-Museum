import { LayoutDashboard, Wifi, Bell, Settings, BarChart3, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import logoImage from 'figma:asset/d83767957783007976f4c71d1b997e4eb7d271d2.png';

interface SidebarProps {
  activePage: string;
  onPageChange: (page: string) => void;
}

export function Sidebar({ activePage, onPageChange }: SidebarProps) {
  const { user, logout, isAdmin } = useAuth();

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, show: true },
    { id: 'sensors', label: 'Sensors', icon: Wifi, show: true },
    { id: 'alerts', label: 'Alerts', icon: Bell, show: true },
    { id: 'settings', label: 'Settings', icon: Settings, show: isAdmin },
    { id: 'reports', label: 'Reports', icon: BarChart3, show: true },
  ];

  return (
    <div className="w-56 bg-gradient-to-b from-blue-900 to-blue-950 text-white h-screen flex flex-col">
      <div className="p-4 border-b border-blue-800">
        <div className="mb-3 rounded-lg overflow-hidden">
          <img src={logoImage} alt="Museum Building" className="w-full h-auto" />
        </div>
        <h2 className="text-sm font-semibold text-blue-200 mb-1">Hiyas Museum</h2>
        <p className="text-xs text-blue-300">Monitoring System</p>
        <div className="mt-3 px-2 py-1.5 bg-blue-800 rounded text-xs font-medium">
          {user?.role === 'admin' ? '👑 Admin' : '👤 Curator'}
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {menuItems.filter(item => item.show).map((item) => {
          const Icon = item.icon;
          const isActive = activePage === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onPageChange(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                isActive
                  ? 'bg-blue-700 text-white shadow-lg'
                  : 'text-blue-200 hover:bg-blue-800 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="text-sm font-medium">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-3 border-t border-blue-800">
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-red-300 hover:bg-red-900 hover:text-white transition-all"
        >
          <LogOut className="w-4 h-4" />
          <span className="text-sm font-medium">Logout</span>
        </button>
      </div>
    </div>
  );
}