import { ReactNode, useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate, Link } from "@/lib/router-compat";
import { LayoutDashboard, FileText, Clock, CheckCircle2, Users, Settings, Search, Bell, LogOut, Menu, Inbox, ShoppingBag, Pill, ListChecks, Plus, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import logo from "@/assets/logo.png";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { fetchTestForms } from "@/lib/supabaseQueries";
import { formatDistanceToNow } from "date-fns";
import { useRealtime } from "@/lib/useRealtime";

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; end?: boolean };

const buildGroups = (isSenior: boolean, isLabAdmin: boolean) => {
  const groups: { title: string; items: NavItem[] }[] = [
    { title: "Workbench", items: [
      { to: "/dashboard", label: "Overview", icon: LayoutDashboard, end: true },
      { to: "/dashboard/pending", label: "Queue", icon: Clock },
      { to: "/dashboard/forms", label: "Test Forms", icon: FileText },
      { to: "/dashboard/completed", label: "Completed", icon: CheckCircle2 },
    ]},
    { title: "Records", items: [
      { to: "/dashboard/results", label: "Results Search", icon: Search },
      { to: "/scan-dashboard", label: "Imaging & Scans", icon: ScanLine },
    ]},
  ];
  const manage: NavItem[] = [{ to: "/dashboard/scientists", label: "Scientists", icon: Users }];
  if (isLabAdmin) manage.push({ to: "/dashboard/manage-tests", label: "Test Catalog", icon: ListChecks });
  if (isSenior) manage.push(
    { to: "/dashboard/shop", label: "Shop", icon: ShoppingBag },
    { to: "/dashboard/pharmacy", label: "Pharmacy", icon: Pill },
    { to: "/dashboard/settings", label: "Settings", icon: Settings },
  );
  groups.push({ title: "Lab Management", items: manage });
  return groups;
};

const SidebarBody = ({
  onNavigate, isSenior, isLabAdmin, counts, onOpenPalette,
}: {
  onNavigate?: () => void; isSenior: boolean; isLabAdmin: boolean;
  counts: Record<string, number>; onOpenPalette: () => void;
}) => {
  const groups = buildGroups(isSenior, isLabAdmin);
  return (
  <>
    <div className="h-16 flex items-center gap-2.5 px-4">
      <img src={logo} alt="Green Medical Diagnostics" className="h-10 w-auto" />
      <span className="ml-auto rounded-md border border-border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">LIS</span>
    </div>
    <div className="px-3 pb-2">
      <Button asChild className="w-full justify-start gap-2 h-9 rounded-lg shadow-soft">
        <Link to="/dashboard/forms/new" onClick={onNavigate}><Plus className="h-4 w-4" /> New test form</Link>
      </Button>
      <button onClick={onOpenPalette}
        className="mt-2 w-full flex items-center gap-2 h-9 px-3 rounded-lg border border-border bg-background text-sm text-muted-foreground hover:text-foreground transition-smooth">
        <Search className="h-4 w-4" /> <span className="flex-1 text-left">Jump to…</span>
        <kbd className="text-[10px] font-mono rounded border border-border px-1.5 py-0.5">⌘K</kbd>
      </button>
    </div>
    <nav className="flex-1 px-3 py-2 overflow-y-auto space-y-5">
      {groups.map((g) => (
        <div key={g.title}>
          <p className="px-2.5 mb-1 text-[10.5px] font-medium uppercase tracking-[0.08em] text-muted-foreground/80">{g.title}</p>
          <div className="space-y-0.5">
            {g.items.map((item) => {
              const count = counts[item.to];
              return (
                <NavLink key={item.to} to={item.to} end={item.end} onClick={onNavigate}
                  className={({ isActive }) => cn(
                    "group flex items-center gap-2.5 px-2.5 h-8 rounded-md text-[13px] font-medium transition-smooth",
                    isActive ? "bg-primary-soft text-primary" : "text-foreground/70 hover:bg-muted hover:text-foreground",
                  )}>
                  <item.icon className="h-4 w-4" strokeWidth={2} />
                  <span className="flex-1">{item.label}</span>
                  {count ? (
                    <span className="h-5 min-w-5 px-1.5 rounded-full bg-warning/15 text-warning text-[10px] font-semibold flex items-center justify-center tabular-nums">
                      {count > 99 ? "99+" : count}
                    </span>
                  ) : null}
                </NavLink>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
    <div className="p-3 border-t border-border">
      <div className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-[11px] text-muted-foreground">
        <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-60 animate-ping" /><span className="relative inline-flex h-2 w-2 rounded-full bg-success" /></span>
        Live sync · verify against reference ranges
      </div>
    </div>
  </>
  );
};

const CommandPalette = ({ open, onOpenChange, isSenior, isLabAdmin }: { open: boolean; onOpenChange: (v: boolean) => void; isSenior: boolean; isLabAdmin: boolean }) => {
  const navigate = useNavigate();
  const { data: forms = [] } = useQuery({ queryKey: ["test_forms"], queryFn: fetchTestForms });
  const go = (to: string) => { onOpenChange(false); navigate(to); };
  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search patients, serials, or pages…" />
      <CommandList>
        <CommandEmpty>No matches.</CommandEmpty>
        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => go("/dashboard/forms/new")}><Plus className="h-4 w-4 mr-2" /> New test form</CommandItem>
        </CommandGroup>
        <CommandGroup heading="Patients">
          {forms.slice(0, 50).map((f) => (
            <CommandItem key={f.serial} value={`${f.serial} ${f.patient_name}`} onSelect={() => go(`/dashboard/forms/${f.serial}`)}>
              <FileText className="h-4 w-4 mr-2" />
              <span className="flex-1 truncate">{f.patient_name}</span>
              <span className="font-mono text-[11px] text-muted-foreground">{f.serial}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        {buildGroups(isSenior, isLabAdmin).map((g) => (
          <CommandGroup key={g.title} heading={g.title}>
            {g.items.map((i) => (
              <CommandItem key={i.to} onSelect={() => go(i.to)}><i.icon className="h-4 w-4 mr-2" /> {i.label}</CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
};

const MobileTabBar = ({ onMore, pendingCount }: { onMore: () => void; pendingCount: number }) => {
  const tabs = [
    { to: "/dashboard", label: "Home", icon: LayoutDashboard, end: true },
    { to: "/dashboard/pending", label: "Queue", icon: Clock, badge: pendingCount },
    { to: "/dashboard/forms/new", label: "New", icon: Plus, primary: true },
    { to: "/dashboard/results", label: "Search", icon: Search },
  ];
  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-card/90 backdrop-blur-xl pb-safe">
      <div className="grid grid-cols-5 h-14">
        {tabs.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end}
            className={({ isActive }) => cn("relative flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium",
              isActive ? "text-primary" : "text-muted-foreground")}>
            {t.primary ? (
              <span className="h-10 w-10 -mt-1 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-elegant"><t.icon className="h-5 w-5" /></span>
            ) : (<><t.icon className="h-5 w-5" />{t.label}</>)}
            {t.badge ? <span className="absolute top-1.5 left-1/2 ml-2 h-4 min-w-4 px-1 rounded-full bg-warning text-primary-foreground text-[9px] font-semibold flex items-center justify-center">{t.badge}</span> : null}
          </NavLink>
        ))}
        <button onClick={onMore} className="flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-muted-foreground">
          <Menu className="h-5 w-5" /> More
        </button>
      </div>
    </nav>
  );
};

const NotificationsBell = () => {
  const { data: forms = [] } = useQuery({
    queryKey: ["test_forms"],
    queryFn: fetchTestForms,
  });

  const items = forms
    .filter((f) => f.status === "Pending" || f.status === "Processing")
    .slice(0, 8);
  const count = items.length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="relative p-2 rounded-full hover:bg-muted transition-smooth"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5 text-foreground/70" />
          {count > 0 && (
            <Badge className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 text-[10px]">
              {count > 9 ? "9+" : count}
            </Badge>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <p className="text-sm font-semibold">Notifications</p>
          <span className="text-[11px] text-muted-foreground">
            {count} pending
          </span>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {items.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground text-sm flex flex-col items-center gap-2">
              <Inbox className="h-6 w-6 opacity-60" />
              You're all caught up
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((f) => (
                <li key={f.serial}>
                  <Link
                    to={`/dashboard/forms/${f.serial}`}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-muted transition-smooth"
                  >
                    <div
                      className={cn(
                        "mt-1 h-2 w-2 rounded-full shrink-0",
                        f.status === "Pending" ? "bg-amber-500" : "bg-sky-500",
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {f.patient_name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {f.serial} · {f.status}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {formatDistanceToNow(new Date(f.created_at), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="px-4 py-2 border-t border-border">
          <Link
            to="/dashboard/pending"
            className="text-xs font-medium text-primary hover:underline"
          >
            View all pending tests →
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export const DashboardLayout = ({ children }: { children: ReactNode }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, signOut } = useAuth();
  const isSenior = (profile?.role ?? "").toLowerCase().includes("senior");
  const { isLabAdmin } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPaletteOpen((v) => !v); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const { data: forms = [] } = useQuery({ queryKey: ["test_forms"], queryFn: fetchTestForms });
  useRealtime("test_forms", [["test_forms"]]);
  const counts: Record<string, number> = {
    "/dashboard/pending": forms.filter((f) => f.status === "Pending").length,
  };

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const q = String(data.get("q") ?? "").trim();
    if (q) navigate(`/dashboard/forms?q=${encodeURIComponent(q)}`);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const initials = profile?.display_name
    ? profile.display_name.split(" ").slice(0, 2).map((n) => n[0]?.toUpperCase()).join("")
    : "U";

  return (
    <div className="app-shell min-h-screen flex bg-background text-foreground">
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} isSenior={isSenior} isLabAdmin={isLabAdmin} />
      <aside className="hidden lg:flex w-60 flex-col border-r border-border bg-card sticky top-0 h-screen">
        <SidebarBody isSenior={isSenior} isLabAdmin={isLabAdmin} counts={counts} onOpenPalette={() => setPaletteOpen(true)} />
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 flex items-center gap-2 px-3 sm:px-4 lg:px-6 bg-background/80 backdrop-blur-xl border-b border-border sticky top-0 z-30">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <button className="lg:hidden -ml-1 p-1" aria-label="Open menu">
                <img src={logo} alt="" className="h-8 w-auto" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-72 bg-card flex flex-col">
              <SidebarBody onNavigate={() => setMobileOpen(false)} isSenior={isSenior} isLabAdmin={isLabAdmin} counts={counts} onOpenPalette={() => setPaletteOpen(true)} />
            </SheetContent>
          </Sheet>

          <form onSubmit={handleSearch} className="flex-1 max-w-md relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input name="q" placeholder="Search serial or patient…" onFocus={(e) => { if (window.innerWidth < 1024) { e.currentTarget.blur(); setPaletteOpen(true); } }}
              className="h-9 pl-9 pr-12 rounded-lg bg-muted/60 border-transparent shadow-none focus-visible:bg-background" />
            <kbd className="hidden sm:inline absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-mono rounded border border-border bg-background px-1.5 py-0.5 text-muted-foreground">⌘K</kbd>
          </form>
          <div className="flex-1" />
          <NotificationsBell />
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 pl-1.5 sm:pl-2 sm:pr-3 py-1.5 rounded-full hover:bg-muted transition-smooth">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">{initials}</AvatarFallback>
              </Avatar>
              <div className="hidden sm:block text-left leading-tight">
                <p className="text-xs font-semibold">{profile?.display_name ?? "User"}</p>
                <p className="text-[10px] text-muted-foreground">{profile?.role ?? "Scientist"}</p>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Profile</DropdownMenuItem>
              <DropdownMenuItem>Activity Log</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-2" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <main className="flex-1 w-full max-w-[1400px] mx-auto px-4 pt-5 pb-24 lg:px-8 lg:py-8 animate-fade-in">{children}</main>
        <MobileTabBar onMore={() => setMobileOpen(true)} pendingCount={counts["/dashboard/pending"] ?? 0} />
      </div>
    </div>
  );
};

export default DashboardLayout;
