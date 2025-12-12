import { AlertCircle, X } from 'lucide-react';

interface ErrorAlertProps {
  error: string;
  onClose: () => void;
}

export const ErrorAlert = ({ error, onClose }: ErrorAlertProps) => {
  if (!error) return null;

  return (
    <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 mb-6 flex items-start gap-3 animate-scale-in">
      <AlertCircle className="text-destructive flex-shrink-0 mt-0.5" size={20} />
      <div className="flex-1">
        <p className="text-destructive font-semibold">Fehler</p>
        <p className="text-destructive/80 text-sm">{error}</p>
      </div>
      <button 
        onClick={onClose} 
        className="text-destructive/60 hover:text-destructive transition-colors p-1 hover:bg-destructive/10 rounded-lg"
      >
        <X size={18} />
      </button>
    </div>
  );
};
