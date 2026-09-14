import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Phone, Lock, Loader2, ArrowLeft, ShieldCheck } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type Mode = "login" | "request" | "code";

/** Connexion par numéro de téléphone + réinitialisation du mot de passe par SMS. */
const PhoneLogin = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user, loading: authLoading, getDashboardPath, rolesLoading } = useAuth();

  const [mode, setMode] = useState<Mode>(params.get("oubli") ? "request" : "login");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!authLoading && !rolesLoading && user) navigate(getDashboardPath(), { replace: true });
  }, [user, authLoading, rolesLoading, getDashboardPath, navigate]);

  const cleanPhone = phone.replace(/[^\d+]/g, "");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cleanPhone.length < 8 || password.length < 6) {
      toast.error("Entrez votre numéro et votre mot de passe.");
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("phone-login", {
        body: { identifier: cleanPhone, password },
      });
      if (error || !data?.access_token) {
        throw new Error("Numéro ou mot de passe incorrect. Vérifiez votre numéro (ex. 07 00 00 00 00).");
      }
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });
      if (sessionError) throw new Error("Connexion impossible pour le moment.");
      toast.success("Connexion réussie !");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Connexion impossible.");
    } finally {
      setBusy(false);
    }
  };

  const requestCode = async () => {
    if (cleanPhone.length < 8) {
      toast.error("Entrez le numéro de téléphone de votre compte.");
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("phone-password-reset", {
        body: { action: "request", phone: cleanPhone },
      });
      if (error) throw new Error("Envoi du code impossible. Réessayez dans un instant.");
      if (data?.error) throw new Error(String(data.error));
      toast.success("Si ce numéro correspond à un compte, un code vient d'être envoyé par SMS.");
      setMode("code");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Envoi impossible.");
    } finally {
      setBusy(false);
    }
  };

  const applyReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      toast.error("Entrez le code à 6 chiffres reçu par SMS.");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("Choisissez un mot de passe d'au moins 8 caractères.");
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("phone-password-reset", {
        body: { action: "reset", phone: cleanPhone, code, new_password: newPassword },
      });
      if (error) throw new Error("Code incorrect ou expiré.");
      if (data?.error) throw new Error(String(data.error));
      toast.success("Mot de passe modifié. Vous pouvez vous connecter.");
      setPassword(newPassword);
      setCode("");
      setNewPassword("");
      setMode("login");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Modification impossible.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-background">
      <Helmet>
        <title>Connexion par téléphone | Scoly</title>
        <meta
          name="description"
          content="Connectez-vous à votre espace Scoly avec votre numéro de téléphone, ou réinitialisez votre mot de passe par SMS."
        />
      </Helmet>
      <Navbar />

      <section className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-md">
          <Link to="/auth" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
            <ArrowLeft size={16} /> Connexion par e-mail
          </Link>

          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
            <h1 className="text-2xl font-display font-bold text-foreground">
              {mode === "login" ? "Connexion par téléphone" : "Mot de passe oublié"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {mode === "login"
                ? "Utilisez le numéro enregistré sur votre compte Scoly."
                : "Nous vous envoyons un code à 6 chiffres par SMS, valable 10 minutes."}
            </p>

            {mode === "login" && (
              <form onSubmit={handleLogin} className="space-y-4 mt-6">
                <div>
                  <Label htmlFor="phone">Numéro de téléphone</Label>
                  <div className="relative mt-1">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                    <Input
                      id="phone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      className="pl-10"
                      placeholder="07 00 00 00 00"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="pwd">Mot de passe</Label>
                  <div className="relative mt-1">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                    <Input
                      id="pwd"
                      type="password"
                      autoComplete="current-password"
                      className="pl-10"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <Button type="submit" variant="hero" className="w-full" disabled={busy}>
                  {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Connexion…</> : "Se connecter"}
                </Button>

                <button
                  type="button"
                  className="w-full text-sm text-primary hover:underline"
                  onClick={() => setMode("request")}
                >
                  Mot de passe oublié ? Recevoir un code par SMS
                </button>
              </form>
            )}

            {mode === "request" && (
              <div className="space-y-4 mt-6">
                <div>
                  <Label htmlFor="phone-reset">Numéro de téléphone</Label>
                  <div className="relative mt-1">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                    <Input
                      id="phone-reset"
                      type="tel"
                      inputMode="tel"
                      className="pl-10"
                      placeholder="07 00 00 00 00"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                </div>
                <Button variant="hero" className="w-full" disabled={busy} onClick={requestCode}>
                  {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Envoi…</> : "Recevoir le code par SMS"}
                </Button>
                <button type="button" className="w-full text-sm text-primary hover:underline" onClick={() => setMode("login")}>
                  Revenir à la connexion
                </button>
              </div>
            )}

            {mode === "code" && (
              <form onSubmit={applyReset} className="space-y-4 mt-6">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <ShieldCheck size={16} className="text-primary" />
                  Code envoyé au {phone}
                </div>
                <div>
                  <Label htmlFor="code">Code à 6 chiffres</Label>
                  <Input
                    id="code"
                    inputMode="numeric"
                    maxLength={6}
                    className="mt-1 tracking-[0.4em] text-center text-lg"
                    placeholder="000000"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  />
                </div>
                <div>
                  <Label htmlFor="new-pwd">Nouveau mot de passe</Label>
                  <Input
                    id="new-pwd"
                    type="password"
                    autoComplete="new-password"
                    className="mt-1"
                    placeholder="8 caractères minimum"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>
                <Button type="submit" variant="hero" className="w-full" disabled={busy}>
                  {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Validation…</> : "Valider mon nouveau mot de passe"}
                </Button>
                <button type="button" className="w-full text-sm text-primary hover:underline" onClick={requestCode} disabled={busy}>
                  Renvoyer un code
                </button>
              </form>
            )}
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
};

export default PhoneLogin;
