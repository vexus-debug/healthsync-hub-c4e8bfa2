import { useState } from "react";
import { useNavigate } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Loader2, Lock, ShieldCheck, BadgeCheck, FlaskConical } from "lucide-react";
import logo from "@/assets/logo.png";
import { toast } from "sonner";

const ROLES = [
  { label: "Scientist", email: "scientist@greenmedical.ng" },
  { label: "Reception", email: "reception@greenmedical.ng" },
  { label: "Pathologist", email: "pathologist@greenmedical.ng" },
];

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState(false);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const emailError = touched && email.length > 0 && !emailValid;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!emailValid || !password) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) toast.error(error.message);
    else navigate("/dashboard");
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-muted/40">
      <div className="pointer-events-none absolute -left-40 -top-40 h-[32rem] w-[32rem] rounded-full bg-primary/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-[28rem] w-[28rem] rounded-full bg-primary/10 blur-3xl" />

      <div className="relative mx-auto grid min-h-screen max-w-6xl items-center gap-10 p-4 sm:p-8 lg:grid-cols-2">
        <section className="hidden lg:block">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Laboratory Workstation</p>
          <h1 className="mt-3 text-4xl font-extrabold leading-tight text-foreground">
            Secure access to results, specimens and sign-off.
          </h1>
          <p className="mt-4 max-w-md text-muted-foreground">
            Green Medical Diagnostics staff portal. All sessions are encrypted and audited.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            {[
              { icon: ShieldCheck, t: "HIPAA-aligned" },
              { icon: BadgeCheck, t: "ISO 15189 workflow" },
              { icon: Lock, t: "TLS encrypted" },
            ].map(({ icon: I, t }) => (
              <span key={t} className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/80 px-3 py-1.5 text-xs font-medium text-foreground shadow-soft backdrop-blur">
                <I className="h-4 w-4 text-primary" /> {t}
              </span>
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-sm rounded-2xl border border-border/60 bg-card/95 p-6 shadow-lg backdrop-blur-xl sm:p-8">
          <div className="text-center">
            <div className="relative mx-auto w-fit">
              <div className="absolute inset-0 animate-pulse rounded-full bg-primary/20 blur-xl" />
              <img src={logo} alt="Green Medical Diagnostics and Services" className="relative mx-auto h-24 w-auto" />
            </div>
            <h2 className="mt-3 text-xl font-bold text-foreground">Staff sign in</h2>
            <p className="text-sm text-muted-foreground">Green Medical Lab Dashboard</p>
          </div>

          <form onSubmit={handleLogin} className="mt-6 space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email" type="email" autoFocus autoComplete="email" value={email}
                onChange={(e) => setEmail(e.target.value)} onBlur={() => setTouched(true)}
                placeholder="you@greenmedical.ng" aria-invalid={emailError}
                className={emailError ? "border-destructive focus-visible:ring-destructive" : ""}
              />
              {emailError && <p className="text-xs text-destructive">Enter a valid email address.</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password" type={show ? "text" : "password"} autoComplete="current-password"
                  value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="pr-10"
                />
                <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"}
                  className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground">
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {touched && !password && <p className="text-xs text-destructive">Password is required.</p>}
            </div>
            <Button type="submit" variant="hero" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
              {loading ? "Signing in…" : "Sign In"}
            </Button>
          </form>

          {import.meta.env.DEV && (
            <div className="mt-6 border-t border-border/60 pt-4">
              <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <FlaskConical className="h-3.5 w-3.5" /> Quick fill (testing)
              </p>
              <div className="flex flex-wrap gap-2">
                {ROLES.map((r) => (
                  <button key={r.label} type="button" onClick={() => setEmail(r.email)}
                    className="rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-foreground hover:border-primary hover:text-primary">
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <p className="mt-6 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground lg:hidden">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Encrypted · HIPAA-aligned · ISO 15189
          </p>
        </section>
      </div>
    </div>
  );
};

export default Login;
