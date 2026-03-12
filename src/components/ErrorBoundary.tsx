import { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, Copy, ChevronDown, ChevronUp } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  showDetails: boolean;
  copied: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, showDetails: false, copied: false };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary] Uncaught error:", error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null, showDetails: false, copied: false });
  };

  handleCopyDetails = () => {
    const details = `Error: ${this.state.error?.message}\n\nStack:\n${this.state.error?.stack || 'N/A'}`;
    navigator.clipboard.writeText(details).then(() => {
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    }).catch(() => {});
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="max-w-lg w-full text-center space-y-6">
            <div className="flex justify-center">
              <div className="p-4 rounded-full bg-destructive/10">
                <AlertTriangle className="h-10 w-10 text-destructive" />
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-foreground">
                Etwas ist schiefgelaufen
              </h2>
              <p className="text-muted-foreground text-sm">
                Die Anwendung ist auf einen Fehler gestoßen. Bitte versuche es erneut.
              </p>
              {this.state.error?.message && (
                <p className="text-xs font-mono text-destructive bg-destructive/5 rounded p-2 mt-2 break-all">
                  {this.state.error.message}
                </p>
              )}
            </div>
            <div className="flex gap-3 justify-center flex-wrap">
              <Button variant="outline" onClick={this.handleReset}>
                Erneut versuchen
              </Button>
              <Button onClick={this.handleReload} className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Seite neu laden
              </Button>
              <Button variant="ghost" size="sm" onClick={this.handleCopyDetails} className="gap-1.5">
                <Copy className="h-3.5 w-3.5" />
                {this.state.copied ? 'Kopiert!' : 'Details kopieren'}
              </Button>
            </div>
            {this.state.error?.stack && (
              <div className="text-left">
                <button
                  onClick={() => this.setState(s => ({ showDetails: !s.showDetails }))}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mx-auto"
                >
                  {this.state.showDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  Technische Details
                </button>
                {this.state.showDetails && (
                  <pre className="mt-2 text-[10px] font-mono text-muted-foreground bg-muted rounded p-3 overflow-auto max-h-48 whitespace-pre-wrap break-all">
                    {this.state.error.stack}
                  </pre>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
