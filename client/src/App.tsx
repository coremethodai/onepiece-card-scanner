import { Switch, Route, Link, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Scan from "@/pages/scan";
import { LayoutDashboard, ScanLine } from "lucide-react";

const NAV_ITEMS = [
  { title: "Dashboard", href: "/", icon: LayoutDashboard },
  { title: "Scan", href: "/scan", icon: ScanLine },
];

function Sidebar() {
  const [location] = useLocation();

  return (
    <aside className="hidden md:flex flex-col w-60 border-r bg-sidebar text-sidebar-foreground shrink-0">
      <div className="flex items-center gap-2 px-5 h-14 border-b border-sidebar-border">
        <ScanLine className="h-6 w-6 text-primary" />
        <span className="font-bold text-base tracking-tight">OP Scanner</span>
      </div>
      <nav className="flex flex-col gap-1 p-3">
        {NAV_ITEMS.map((item) => {
          const isActive = location === item.href;
          return (
            <Link key={item.href} href={item.href}>
              <div
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium cursor-pointer transition-colors ${
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50"
                }`}
                data-testid={`link-nav-${item.title.toLowerCase()}`}
              >
                <item.icon className="h-4 w-4" />
                {item.title}
              </div>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

function MobileNav() {
  const [location] = useLocation();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t bg-background py-2">
      {NAV_ITEMS.map((item) => {
        const isActive = location === item.href;
        return (
          <Link key={item.href} href={item.href}>
            <div
              className={`flex flex-col items-center gap-1 px-4 py-1 rounded-md cursor-pointer ${
                isActive ? "text-primary" : "text-muted-foreground"
              }`}
              data-testid={`link-mobile-${item.title.toLowerCase()}`}
            >
              <item.icon className="h-5 w-5" />
              <span className="text-xs font-medium">{item.title}</span>
            </div>
          </Link>
        );
      })}
    </nav>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/scan" component={Scan} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="flex h-screen w-full bg-background">
          <Sidebar />
          <main className="flex-1 overflow-auto pb-16 md:pb-0">
            <div className="md:hidden flex items-center gap-2 px-4 h-14 border-b">
              <ScanLine className="h-5 w-5 text-primary" />
              <span className="font-bold text-base tracking-tight">
                OP Scanner
              </span>
            </div>
            <Router />
          </main>
          <MobileNav />
        </div>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
