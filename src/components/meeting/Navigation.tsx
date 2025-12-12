import { LayoutDashboard, Plus } from 'lucide-react';
import { ViewType } from '@/types/meeting';

interface NavigationProps {
  activeView: ViewType;
  onViewChange: (view: ViewType) => void;
}

export const Navigation = ({ activeView, onViewChange }: NavigationProps) => {
  return (
    <div className="flex gap-3 mb-6">
      <button
        onClick={() => onViewChange('dashboard')}
        className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-medium transition-all duration-200 ${
          activeView === 'dashboard'
            ? 'gradient-hero text-primary-foreground shadow-primary'
            : 'bg-card text-foreground hover:bg-secondary border border-border shadow-sm'
        }`}
      >
        <LayoutDashboard size={18} />
        Dashboard
      </button>
      <button
        onClick={() => onViewChange('record')}
        className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-medium transition-all duration-200 ${
          activeView === 'record'
            ? 'gradient-hero text-primary-foreground shadow-primary'
            : 'bg-card text-foreground hover:bg-secondary border border-border shadow-sm'
        }`}
      >
        <Plus size={18} />
        Neues Meeting
      </button>
    </div>
  );
};
