import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Activity, AlertTriangle, ArrowRight, CheckCircle2, Clock, FlaskConical, Loader2, Plus, ScanLine, Search, Timer, TrendingUp, Users } from "lucide-react";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { Link, useNavigate } from "@/lib/router-compat";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { fetchTestForms, fetchScientists } from "@/lib/supabaseQueries";
import { LAB_SECTIONS, TestStatus } from "@/lib/labCatalog";
import { medianTatHours, slaBreachCount, formatHours } from "@/lib/stats";
import { useRealtime } from "@/lib/useRealtime";

const SLA_HOURS = 24;
const HOUR = 3600000;

const Panel = ({ className = "", children }: { className?: string; children: React.ReactNode }) => (
  <section className={`relative overflow-hidden rounded-2xl border border-border/60 bg-card shadow-soft ${className}`}>{children}</section>
);

const PanelHead = ({ eyebrow, title, right }: { eyebrow: string; title: string; right?: React.ReactNode }) => (
  <div className="flex items-start justify-between gap-3 px-5 pt-5">
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{eyebrow}</p>
      <h2 className="mt-1 text-base font-bold tracking-tight text-foreground">{title}</h2>
    </div>
    {right}
  </div>
);

function useNow(ms = 30000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

const sectionCategory = (test: string) => {
  const t = test.toLowerCase();
  const s = LAB_SECTIONS.find((x) => x.id.toLowerCase() === t || x.title.toLowerCase() === t || t.includes(x.title.toLowerCase()));
  return s?.category ?? "Other";
};

const Dashboard = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const now = useNow();
  const [lookup, setLookup] = useState("");
  const { data: forms = [], isLoading } = useQuery({ queryKey: ["test_forms"], queryFn: fetchTestForms });
  const { data: scientists = [] } = useQuery({ queryKey: ["scientists"], queryFn: fetchScientists });
  useRealtime("test_forms", [["test_forms"]]);

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      </DashboardLayout>
    );
  }

  const displayName = profile?.display_name?.split("@")[0] ?? "Scientist";
  const today = new Date().toDateString();
  const todays = forms.filter((f) => new Date(f.date_collected).toDateString() === today);
  const pending = forms.filter((f) => f.status === "Pending");
  const processing = forms.filter((f) => f.status === "Processing");
  const completed = forms.filter((f) => f.status === "Completed");
  const open = [...pending, ...processing].sort((a, b) => +new Date(a.date_collected) - +new Date(b.date_collected));
  const oldest = open[0];
  const ageH = (f: { date_collected: string }) => (now - +new Date(f.date_collected)) / HOUR;
  const openBreached = open.filter((f) => ageH(f) > SLA_HOURS);
  const atRisk = open.filter((f) => ageH(f) > SLA_HOURS * 0.75 && ageH(f) <= SLA_HOURS);

  const tat = medianTatHours(forms.map((f) => ({ start: f.date_collected, end: f.completed_at })));
  const doneTats = completed.filter((f) => f.completed_at).map((f) => (+new Date(f.completed_at!) - +new Date(f.date_collected)) / HOUR).sort((a, b) => a - b);
  const p90 = doneTats.length ? doneTats[Math.min(doneTats.length - 1, Math.floor(doneTats.length * 0.9))] : null;
  const breaches = slaBreachCount(forms.filter((f) => f.status !== "Completed" || f.completed_at).map((f) => ({ start: f.date_collected, end: f.completed_at })), SLA_HOURS);
  const onTimePct = doneTats.length ? Math.round((doneTats.filter((h) => h <= SLA_HOURS).length / doneTats.length) * 100) : 100;

  // pipeline
  const stages = [
    { key: "Pending", label: "Received", count: pending.length, icon: Clock, tone: "text-warning", bar: "bg-warning" },
    { key: "Processing", label: "Processing", count: processing.length, icon: Activity, tone: "text-primary", bar: "bg-primary" },
    { key: "Completed", label: "Released", count: completed.length, icon: CheckCircle2, tone: "text-success", bar: "bg-success" },
  ];
  const totalPipe = Math.max(1, forms.length);
  const bottleneck = pending.length >= processing.length ? "Received" : "Processing";

  // bench distribution
  const bench = Object.entries(
    forms.flatMap((f) => f.tests_requested.map((t) => ({ cat: sectionCategory(t), open: f.status !== "Completed" })))
      .reduce<Record<string, { total: number; open: number }>>((acc, x) => {
        acc[x.cat] ??= { total: 0, open: 0 };
        acc[x.cat].total++;
        if (x.open) acc[x.cat].open++;
        return acc;
      }, {}),
  ).sort((a, b) => b[1].total - a[1].total).slice(0, 6);
  const benchMax = Math.max(1, ...bench.map(([, v]) => v.total));

  // throughput
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now - (6 - i) * 86400000);
    const key = d.toDateString();
    return {
      label: d.toLocaleDateString(undefined, { weekday: "short" }),
      received: forms.filter((f) => new Date(f.date_collected).toDateString() === key).length,
      completed: forms.filter((f) => f.completed_at && new Date(f.completed_at).toDateString() === key).length,
    };
  });
  const dayMax = Math.max(1, ...days.flatMap((d) => [d.received, d.completed]));
  const week = days.reduce((s, d) => s + d.completed, 0);
  const prevWeek = forms.filter((f) => f.completed_at && +new Date(f.completed_at) >= now - 14 * 86400000 && +new Date(f.completed_at) < now - 7 * 86400000).length;
  const delta = prevWeek === 0 ? (week > 0 ? 100 : 0) : Math.round(((week - prevWeek) / prevWeek) * 100);

  // workload
  const sciMap = Object.fromEntries((scientists as { id: string; name: string }[]).map((s) => [s.id, s.name]));
  const workload = Object.entries(
    forms.reduce<Record<string, { open: number; done: number }>>((acc, f) => {
      const k = f.scientist_id ?? "unassigned";
      acc[k] ??= { open: 0, done: 0 };
      f.status === "Completed" ? acc[k].done++ : acc[k].open++;
      return acc;
    }, {}),
  ).map(([id, v]) => ({ id, name: id === "unassigned" ? "Unassigned" : sciMap[id] ?? "Unknown", ...v }))
    .sort((a, b) => b.open - a.open).slice(0, 5);
  const workMax = Math.max(1, ...workload.map((w) => w.open + w.done));

  // TAT dial
  const dialPct = Math.min(1, (tat ?? 0) / SLA_HOURS);
  const R = 52, C = 2 * Math.PI * R;
  const dialTone = dialPct > 0.9 ? "text-destructive" : dialPct > 0.66 ? "text-warning" : "text-success";

  const oldestAge = oldest ? ageH(oldest) : 0;
  const remaining = SLA_HOURS - oldestAge;
  const radarTone = openBreached.length ? "destructive" : atRisk.length ? "warning" : "success";
  const radarRing = { destructive: "ring-destructive/30 bg-destructive/5", warning: "ring-warning/30 bg-warning/5", success: "ring-success/30 bg-success/5" }[radarTone];
  const radarText = { destructive: "text-destructive", warning: "text-warning", success: "text-success" }[radarTone];

  const onLookup = (e: React.FormEvent) => {
    e.preventDefault();
    const q = lookup.trim();
    if (!q) return;
    const hit = forms.find((f) => f.serial.toLowerCase() === q.toLowerCase() || f.patient_name.toLowerCase().includes(q.toLowerCase()));
    navigate(hit ? `/dashboard/forms/${hit.serial}` : "/dashboard/forms");
  };

  return (
    <DashboardLayout>
      {/* Status bar */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card px-4 py-3 shadow-soft">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          <span className="inline-flex items-center gap-2 font-semibold text-foreground">
            <span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" /></span>
            {displayName} on duty
          </span>
          <span className="text-muted-foreground">{new Date(now).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}</span>
          <span className="text-muted-foreground"><b className="tabular-nums text-foreground">{todays.length}</b> received today</span>
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <form onSubmit={onLookup} className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input value={lookup} onChange={(e) => setLookup(e.target.value)} placeholder="Serial or patient…"
              className="h-9 w-full rounded-lg border border-input bg-background pl-9 pr-9 font-mono text-sm outline-none focus:ring-2 focus:ring-ring" />
            <ScanLine className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          </form>
          <Button asChild size="sm" variant="hero"><Link to="/dashboard/forms/new"><Plus className="h-4 w-4" /> <span className="hidden sm:inline">New Form</span></Link></Button>
        </div>
      </div>

      {/* Row 1: SLA radar + pipeline */}
      <div className="grid gap-4 lg:grid-cols-5">
        <Panel className={`lg:col-span-2 ring-1 ${radarRing}`}>
          <PanelHead eyebrow="Urgency radar" title="SLA watch"
            right={<span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${radarRing} ${radarText}`}>
              <AlertTriangle className="h-3.5 w-3.5" />{openBreached.length ? `${openBreached.length} breached` : atRisk.length ? `${atRisk.length} at risk` : "All clear"}</span>} />
          <div className="px-5 pb-5 pt-4">
            {oldest ? (
              <>
                <p className="text-xs text-muted-foreground">Oldest open specimen</p>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="truncate text-lg font-bold text-foreground">{oldest.patient_name}</span>
                  <span className="font-mono text-xs text-muted-foreground">{oldest.serial}</span>
                </div>
                <div className="mt-3 flex items-end justify-between">
                  <div>
                    <p className={`text-4xl font-extrabold tabular-nums tracking-tight ${radarText}`}>{formatHours(oldestAge)}</p>
                    <p className="text-xs text-muted-foreground">{remaining > 0 ? `${formatHours(remaining)} left before breach` : `${formatHours(-remaining)} over the ${SLA_HOURS}h limit`}</p>
                  </div>
                  <Button asChild size="sm" variant="outline"><Link to={`/dashboard/forms/${oldest.serial}`}>Open <ArrowRight className="h-4 w-4" /></Link></Button>
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
                  <div className={`h-full rounded-full ${radarTone === "destructive" ? "bg-destructive" : radarTone === "warning" ? "bg-warning" : "bg-success"}`} style={{ width: `${Math.min(100, (oldestAge / SLA_HOURS) * 100)}%` }} />
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  {[["Open", open.length], ["At risk", atRisk.length], ["Breached", openBreached.length]].map(([l, v]) => (
                    <div key={l} className="rounded-xl bg-muted/60 py-2">
                      <p className="text-lg font-bold tabular-nums text-foreground">{v}</p>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{l}</p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center py-8 text-center">
                <CheckCircle2 className="h-10 w-10 text-success" />
                <p className="mt-2 font-semibold text-foreground">Queue is empty</p>
                <p className="text-xs text-muted-foreground">No specimens waiting.</p>
              </div>
            )}
          </div>
        </Panel>

        <Panel className="lg:col-span-3">
          <PanelHead eyebrow="Specimen pipeline" title="Where tests are right now"
            right={<span className="rounded-full bg-warning/10 px-2.5 py-1 text-xs font-semibold text-warning">Bottleneck: {bottleneck}</span>} />
          <div className="px-5 pb-5 pt-5">
            <div className="grid grid-cols-3 gap-2">
              {stages.map((s, i) => (
                <Link key={s.key} to={s.key === "Completed" ? "/dashboard/completed" : "/dashboard/pending"}
                  className="group relative rounded-xl border border-border/60 bg-background p-3 transition-smooth hover:border-primary/40 hover:shadow-soft">
                  <div className="flex items-center gap-2">
                    <s.icon className={`h-4 w-4 ${s.tone}`} />
                    <span className="text-xs font-medium text-muted-foreground">{s.label}</span>
                  </div>
                  <p className="mt-2 text-3xl font-extrabold tabular-nums text-foreground">{s.count}</p>
                  <p className="text-[11px] text-muted-foreground">{Math.round((s.count / totalPipe) * 100)}% of all</p>
                  {i < 2 && <ArrowRight className="absolute -right-3 top-1/2 z-10 hidden h-4 w-4 -translate-y-1/2 rounded-full bg-card text-muted-foreground sm:block" />}
                </Link>
              ))}
            </div>
            <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-muted">
              {stages.map((s) => <div key={s.key} className={s.bar} style={{ width: `${(s.count / totalPipe) * 100}%` }} />)}
            </div>
            <ul className="mt-5 divide-y divide-border">
              {forms.slice(0, 5).map((f) => (
                <li key={f.serial}>
                  <Link to={`/dashboard/forms/${f.serial}`} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 transition-smooth hover:bg-muted">
                    <span className="hidden w-24 shrink-0 font-mono text-xs text-muted-foreground sm:block">{f.serial}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">{f.patient_name}</p>
                      <p className="truncate text-xs text-muted-foreground">{f.tests_requested.slice(0, 2).join(", ")}{f.tests_requested.length > 2 && ` +${f.tests_requested.length - 2}`}</p>
                    </div>
                    {f.status !== "Completed" && <span className={`text-xs tabular-nums ${ageH(f) > SLA_HOURS ? "text-destructive" : "text-muted-foreground"}`}>{formatHours(ageH(f))}</span>}
                    <StatusBadge status={f.status as TestStatus} />
                  </Link>
                </li>
              ))}
              {forms.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">No test forms yet.</li>}
            </ul>
          </div>
        </Panel>
      </div>

      {/* Row 2: TAT dial + throughput + bench */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel>
          <PanelHead eyebrow="Turnaround" title="Median vs 24h target" />
          <div className="flex items-center gap-5 px-5 pb-5 pt-4">
            <div className={`relative h-32 w-32 shrink-0 ${dialTone}`}>
              <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
                <circle cx="60" cy="60" r={R} fill="none" strokeWidth="10" className="stroke-muted" />
                <circle cx="60" cy="60" r={R} fill="none" strokeWidth="10" strokeLinecap="round" stroke="currentColor" strokeDasharray={C} strokeDashoffset={C * (1 - dialPct)} />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-extrabold tabular-nums text-foreground">{formatHours(tat)}</span>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">median</span>
              </div>
            </div>
            <dl className="flex-1 space-y-3 text-sm">
              <div><dt className="text-xs text-muted-foreground">Slowest 10%</dt><dd className="font-bold tabular-nums text-foreground">{formatHours(p90)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">On time</dt><dd className="font-bold tabular-nums text-foreground">{onTimePct}%</dd></div>
              <div><dt className="text-xs text-muted-foreground">Total over limit</dt><dd className="font-bold tabular-nums text-foreground">{breaches}</dd></div>
            </dl>
          </div>
        </Panel>

        <Panel>
          <PanelHead eyebrow="Throughput" title="Last 7 days"
            right={<span className={`inline-flex items-center gap-1 text-xs font-semibold ${delta >= 0 ? "text-success" : "text-destructive"}`}><TrendingUp className={`h-3.5 w-3.5 ${delta >= 0 ? "" : "rotate-180"}`} />{delta >= 0 ? "+" : ""}{delta}%</span>} />
          <div className="px-5 pb-5 pt-4">
            <div className="flex h-28 items-end gap-2">
              {days.map((d, i) => (
                <div key={i} className="flex flex-1 flex-col items-center gap-1">
                  <div className="flex w-full flex-1 items-end gap-0.5">
                    <div className="flex-1 rounded-t bg-primary/30" style={{ height: `${(d.received / dayMax) * 100 || 4}%` }} title={`${d.received} received`} />
                    <div className="flex-1 rounded-t bg-gradient-primary" style={{ height: `${(d.completed / dayMax) * 100 || 4}%` }} title={`${d.completed} completed`} />
                  </div>
                  <span className="text-[10px] text-muted-foreground">{d.label.slice(0, 2)}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-sm bg-primary/30" />Received<i className="ml-2 h-2 w-2 rounded-sm bg-gradient-primary" />Completed</span>
              <span><b className="tabular-nums text-foreground">{week}</b> released</span>
            </div>
          </div>
        </Panel>

        <Panel>
          <PanelHead eyebrow="Lab benches" title="Volume by discipline" right={<FlaskConical className="h-4 w-4 text-muted-foreground" />} />
          <div className="px-5 pb-5 pt-4">
            {bench.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">No data yet.</p> : (
              <ul className="space-y-3">
                {bench.map(([cat, v]) => (
                  <li key={cat}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="font-medium text-foreground">{cat}</span>
                      <span className="tabular-nums text-muted-foreground">{v.open} open · {v.total}</span>
                    </div>
                    <div className="relative h-2 overflow-hidden rounded-full bg-muted">
                      <div className="absolute inset-y-0 left-0 rounded-full bg-primary/30" style={{ width: `${(v.total / benchMax) * 100}%` }} />
                      <div className="absolute inset-y-0 left-0 rounded-full bg-warning" style={{ width: `${(v.open / benchMax) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Panel>
      </div>

      {/* Row 3: team */}
      <Panel className="mt-4">
        <PanelHead eyebrow="Team" title="Scientist load" right={<Users className="h-4 w-4 text-muted-foreground" />} />
        <div className="grid gap-3 px-5 pb-5 pt-4 sm:grid-cols-2 lg:grid-cols-5">
          {workload.length === 0 && <p className="text-sm text-muted-foreground">No assignments yet.</p>}
          {workload.map((w) => (
            <div key={w.id} className="rounded-xl border border-border/60 bg-background p-3">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary">{w.name.slice(0, 2).toUpperCase()}</span>
                <span className="truncate text-sm font-semibold text-foreground">{w.name}</span>
              </div>
              <div className="mt-3 flex items-baseline gap-1"><span className="text-2xl font-extrabold tabular-nums text-foreground">{w.open}</span><span className="text-xs text-muted-foreground">open · {w.done} done</span></div>
              <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="bg-warning" style={{ width: `${(w.open / workMax) * 100}%` }} />
                <div className="bg-success" style={{ width: `${(w.done / workMax) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </Panel>
      <p className="mt-3 flex items-center gap-1 text-[11px] text-muted-foreground"><Timer className="h-3 w-3" /> Updates live as forms change.</p>
    </DashboardLayout>
  );
};

export default Dashboard;
