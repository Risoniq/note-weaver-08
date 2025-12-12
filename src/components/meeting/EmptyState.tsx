import { FileText } from 'lucide-react';

interface EmptyStateProps {
  hasSearchTerm: boolean;
}

export const EmptyState = ({ hasSearchTerm }: EmptyStateProps) => {
  return (
    <div className="text-center py-16 sm:py-20 bg-card rounded-2xl border border-border animate-fade-in">
      <div className="inline-flex p-4 bg-secondary rounded-2xl mb-4">
        <FileText size={48} className="text-muted-foreground" />
      </div>
      <h3 className="text-xl font-semibold text-foreground mb-2">
        {hasSearchTerm ? 'Keine Meetings gefunden' : 'Noch keine Meetings'}
      </h3>
      <p className="text-muted-foreground max-w-sm mx-auto">
        {hasSearchTerm 
          ? 'Versuche einen anderen Suchbegriff' 
          : 'Starte dein erstes Meeting mit "Neues Meeting"'}
      </p>
    </div>
  );
};
