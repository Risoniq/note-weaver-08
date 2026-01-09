import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TranscriptCard } from "@/components/transcripts/TranscriptCard";
import { TranscriptSearch, TranscriptFilters } from "@/components/transcripts/TranscriptSearch";
import { Recording, RecordingParticipant } from "@/types/recording";
import { ArrowLeft, FileText, Download, FolderOpen } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination";

const ITEMS_PER_PAGE = 10;

const Transcripts = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState<TranscriptFilters>({
    searchQuery: "",
    dateRange: undefined,
    sortBy: "newest",
    hasTranscript: "all",
  });

  useEffect(() => {
    if (!user) return;

    const fetchRecordings = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from("recordings")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (error) throw error;

        // Map database results to Recording type
        const mappedRecordings: Recording[] = (data || []).map((r) => ({
          ...r,
          participants: (r.participants as unknown as RecordingParticipant[] | null) ?? null,
        }));

        setRecordings(mappedRecordings);
      } catch (error) {
        console.error("Error fetching recordings:", error);
        toast.error("Fehler beim Laden der Transkripte");
      } finally {
        setIsLoading(false);
      }
    };

    fetchRecordings();

    // Set up realtime subscription
    const channel = supabase
      .channel("transcripts-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "recordings",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchRecordings();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Filter and sort recordings
  const filteredRecordings = useMemo(() => {
    let result = [...recordings];

    // Filter by transcript presence
    if (filters.hasTranscript === "yes") {
      result = result.filter((r) => r.transcript_text);
    } else if (filters.hasTranscript === "no") {
      result = result.filter((r) => !r.transcript_text);
    }

    // Filter by date range
    if (filters.dateRange?.from) {
      const fromDate = new Date(filters.dateRange.from);
      fromDate.setHours(0, 0, 0, 0);
      result = result.filter((r) => new Date(r.created_at) >= fromDate);
    }
    if (filters.dateRange?.to) {
      const toDate = new Date(filters.dateRange.to);
      toDate.setHours(23, 59, 59, 999);
      result = result.filter((r) => new Date(r.created_at) <= toDate);
    }

    // Filter by search query (client-side for now, could use PostgreSQL FTS)
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      result = result.filter(
        (r) =>
          r.title?.toLowerCase().includes(query) ||
          r.transcript_text?.toLowerCase().includes(query) ||
          r.summary?.toLowerCase().includes(query)
      );
    }

    // Sort
    switch (filters.sortBy) {
      case "oldest":
        result.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        break;
      case "title":
        result.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
        break;
      case "duration":
        result.sort((a, b) => (b.duration || 0) - (a.duration || 0));
        break;
      case "newest":
      default:
        result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    return result;
  }, [recordings, filters]);

  // Pagination
  const totalPages = Math.ceil(filteredRecordings.length / ITEMS_PER_PAGE);
  const paginatedRecordings = filteredRecordings.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  const handleExportAll = () => {
    const recordingsWithTranscripts = recordings.filter((r) => r.transcript_text);
    if (recordingsWithTranscripts.length === 0) {
      toast.error("Keine Transkripte zum Exportieren vorhanden");
      return;
    }

    // Create combined text file
    const content = recordingsWithTranscripts
      .map((r) => {
        const header = `=== ${r.title || "Unbenanntes Meeting"} ===\nDatum: ${format(
          new Date(r.created_at),
          "dd.MM.yyyy HH:mm"
        )}\n\n`;
        return header + (r.transcript_text || "") + "\n\n";
      })
      .join("\n" + "=".repeat(50) + "\n\n");

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `alle_transkripte_${format(new Date(), "yyyy-MM-dd")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${recordingsWithTranscripts.length} Transkripte exportiert`);
  };

  const renderPagination = () => {
    if (totalPages <= 1) return null;

    const pages: (number | "ellipsis")[] = [];
    
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push("ellipsis");
      
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      
      for (let i = start; i <= end; i++) pages.push(i);
      
      if (currentPage < totalPages - 2) pages.push("ellipsis");
      pages.push(totalPages);
    }

    return (
      <Pagination className="mt-6">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
            />
          </PaginationItem>
          {pages.map((page, idx) =>
            page === "ellipsis" ? (
              <PaginationItem key={`ellipsis-${idx}`}>
                <PaginationEllipsis />
              </PaginationItem>
            ) : (
              <PaginationItem key={page}>
                <PaginationLink
                  isActive={currentPage === page}
                  onClick={() => setCurrentPage(page)}
                  className="cursor-pointer"
                >
                  {page}
                </PaginationLink>
              </PaginationItem>
            )
          )}
          <PaginationItem>
            <PaginationNext
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <FileText className="h-6 w-6" />
                Transkript-Datenbank
              </h1>
              <p className="text-muted-foreground text-sm">
                Alle Meeting-Transkripte durchsuchen und verwalten
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={handleExportAll}>
            <Download className="h-4 w-4 mr-2" />
            Alle exportieren
          </Button>
        </div>

        {/* Search and Filters */}
        <div className="mb-6">
          <TranscriptSearch
            filters={filters}
            onFiltersChange={setFilters}
            totalCount={recordings.length}
            filteredCount={filteredRecordings.length}
          />
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-48 w-full" />
            ))}
          </div>
        ) : paginatedRecordings.length === 0 ? (
          <div className="text-center py-16">
            <FolderOpen className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">
              {filters.searchQuery || filters.hasTranscript !== "all" || filters.dateRange?.from
                ? "Keine Ergebnisse gefunden"
                : "Noch keine Transkripte vorhanden"}
            </h3>
            <p className="text-muted-foreground mb-4">
              {filters.searchQuery
                ? "Versuche andere Suchbegriffe oder entferne Filter"
                : "Starte ein Meeting mit dem Bot, um Transkripte zu erstellen"}
            </p>
            {(filters.searchQuery || filters.hasTranscript !== "all" || filters.dateRange?.from) && (
              <Button
                variant="outline"
                onClick={() =>
                  setFilters({
                    searchQuery: "",
                    dateRange: undefined,
                    sortBy: "newest",
                    hasTranscript: "all",
                  })
                }
              >
                Filter zurücksetzen
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {paginatedRecordings.map((recording) => (
                <TranscriptCard
                  key={recording.id}
                  recording={recording}
                  searchQuery={filters.searchQuery}
                />
              ))}
            </div>
            {renderPagination()}
          </>
        )}
      </div>
    </div>
  );
};

export default Transcripts;
