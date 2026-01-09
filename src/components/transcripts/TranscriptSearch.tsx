import { useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Search, X, CalendarIcon, Filter } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";

export interface TranscriptFilters {
  searchQuery: string;
  dateRange: DateRange | undefined;
  sortBy: "newest" | "oldest" | "title" | "duration";
  hasTranscript: "all" | "yes" | "no";
}

interface TranscriptSearchProps {
  filters: TranscriptFilters;
  onFiltersChange: (filters: TranscriptFilters) => void;
  totalCount: number;
  filteredCount: number;
}

export const TranscriptSearch = ({
  filters,
  onFiltersChange,
  totalCount,
  filteredCount,
}: TranscriptSearchProps) => {
  const [localSearch, setLocalSearch] = useState(filters.searchQuery);

  const handleSearchSubmit = useCallback(() => {
    onFiltersChange({ ...filters, searchQuery: localSearch });
  }, [filters, localSearch, onFiltersChange]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearchSubmit();
    }
  };

  const clearFilters = () => {
    setLocalSearch("");
    onFiltersChange({
      searchQuery: "",
      dateRange: undefined,
      sortBy: "newest",
      hasTranscript: "all",
    });
  };

  const hasActiveFilters =
    filters.searchQuery ||
    filters.dateRange?.from ||
    filters.sortBy !== "newest" ||
    filters.hasTranscript !== "all";

  return (
    <div className="space-y-4">
      {/* Main search bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Transkripte durchsuchen..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            className="pl-10"
          />
        </div>
        <Button onClick={handleSearchSubmit}>
          Suchen
        </Button>
      </div>

      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Date range picker */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "justify-start text-left font-normal min-w-[200px]",
                !filters.dateRange?.from && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {filters.dateRange?.from ? (
                filters.dateRange.to ? (
                  <>
                    {format(filters.dateRange.from, "dd.MM.yy", { locale: de })} -{" "}
                    {format(filters.dateRange.to, "dd.MM.yy", { locale: de })}
                  </>
                ) : (
                  format(filters.dateRange.from, "dd. MMM yyyy", { locale: de })
                )
              ) : (
                "Zeitraum wählen"
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={filters.dateRange?.from}
              selected={filters.dateRange}
              onSelect={(range) =>
                onFiltersChange({ ...filters, dateRange: range })
              }
              numberOfMonths={2}
              locale={de}
            />
          </PopoverContent>
        </Popover>

        {/* Sort selector */}
        <Select
          value={filters.sortBy}
          onValueChange={(value: TranscriptFilters["sortBy"]) =>
            onFiltersChange({ ...filters, sortBy: value })
          }
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Sortierung" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Neueste zuerst</SelectItem>
            <SelectItem value="oldest">Älteste zuerst</SelectItem>
            <SelectItem value="title">Nach Titel</SelectItem>
            <SelectItem value="duration">Nach Dauer</SelectItem>
          </SelectContent>
        </Select>

        {/* Transcript filter */}
        <Select
          value={filters.hasTranscript}
          onValueChange={(value: TranscriptFilters["hasTranscript"]) =>
            onFiltersChange({ ...filters, hasTranscript: value })
          }
        >
          <SelectTrigger className="w-[160px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Transkript" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Meetings</SelectItem>
            <SelectItem value="yes">Mit Transkript</SelectItem>
            <SelectItem value="no">Ohne Transkript</SelectItem>
          </SelectContent>
        </Select>

        {/* Clear filters */}
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="h-4 w-4 mr-1" />
            Filter zurücksetzen
          </Button>
        )}
      </div>

      {/* Results count */}
      <div className="text-sm text-muted-foreground">
        {filteredCount === totalCount ? (
          <span>{totalCount} Meetings gefunden</span>
        ) : (
          <span>
            {filteredCount} von {totalCount} Meetings
            {filters.searchQuery && ` für "${filters.searchQuery}"`}
          </span>
        )}
      </div>
    </div>
  );
};
