import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Eye, EyeOff, Lock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Section } from "@/components/site/blocks";
import { Logo } from "@/components/site/Logo";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/admin/reset-password")({
  component: ResetPassword,
  head: () => ({
    meta: [
      { title: "Reset password — Auto Driving School" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function ResetPassword() {
  const navigate = useNavigate();
  // Clicking the emailed link logs the browser into a short-lived
  // "recovery" session — that's what authorizes the password update below.
  // If someone lands here without that (e.g. opened the page directly),
  // there's nothing valid to do, so we show a dead-end message instead.
  const [checking, setChecking] = useState(true);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setHasRecoverySession(!!data.session);
      setChecking(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (event === "PASSWORD_RECOVERY" || newSession) {
        setHasRecoverySession(true);
        setChecking(false);
      }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (pw.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (pw !== pw2) {
      setError("Passwords don't match");
      return;
    }
    setSaving(true);
    const { error: updateError } = await supabase.auth.updateUser({ password: pw });
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setDone(true);
    toast.success("Password updated");
    setTimeout(() => navigate({ to: "/admin" }), 1500);
  }

  return (
    <Section className="flex min-h-[65vh] max-w-md items-center">
      <Card className="w-full overflow-hidden border-none py-0 shadow-xl">
        <div className="bg-primary relative px-8 pt-9 pb-10 text-center">
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px] opacity-60"
            style={{
              backgroundImage:
                "repeating-linear-gradient(90deg, var(--primary-foreground) 0 18px, transparent 18px 34px)",
            }}
            aria-hidden
          />
          <Logo showName={false} size={52} className="justify-center" />
          <h1 className="font-display text-primary-foreground mt-4 text-xl font-bold tracking-tight">
            Set a new password
          </h1>
          <p className="text-primary-foreground/70 mt-1 text-sm">Auto Driving School admin</p>
        </div>

        <CardContent className="space-y-4 pt-6 pb-8">
          {checking ? (
            <div className="flex justify-center py-4">
              <Loader2 className="text-muted-foreground size-6 animate-spin" />
            </div>
          ) : !hasRecoverySession ? (
            <div className="space-y-4 text-center">
              <p className="text-sm">
                This reset link is invalid or has expired. Request a new one from the sign-in page.
              </p>
              <Button className="w-full" onClick={() => navigate({ to: "/admin" })}>
                Back to sign in
              </Button>
            </div>
          ) : done ? (
            <p className="text-center text-sm">Password updated — taking you to the admin area…</p>
          ) : (
            <form onSubmit={handleSubmit} className="animate-in fade-in-0 space-y-3 duration-200">
              <div className="relative">
                <Lock className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                <Input
                  type={showPw ? "text" : "password"}
                  value={pw}
                  onChange={(e) => {
                    setPw(e.target.value);
                    setError("");
                  }}
                  placeholder="New password"
                  aria-label="New password"
                  autoFocus
                  autoComplete="new-password"
                  className="pr-10 pl-9"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? "Hide password" : "Show password"}
                  className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2"
                >
                  {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              <div className="relative">
                <Lock className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                <Input
                  type={showPw ? "text" : "password"}
                  value={pw2}
                  onChange={(e) => {
                    setPw2(e.target.value);
                    setError("");
                  }}
                  placeholder="Confirm new password"
                  aria-label="Confirm new password"
                  autoComplete="new-password"
                  className="pl-9"
                />
              </div>
              {error && <p className="text-destructive text-sm">{error}</p>}
              <Button type="submit" size="lg" className="w-full" disabled={saving}>
                {saving ? "Saving…" : "Save new password"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </Section>
  );
}