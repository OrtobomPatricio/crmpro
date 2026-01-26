import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { getLoginUrl } from "@/const";
import { useTheme } from "@/contexts/ThemeContext";
import { MessageCircle, Moon, Sun, Mail, Lock, User, ArrowRight } from "lucide-react";
import { useState } from "react";

export default function Login() {
  const { theme, toggleTheme } = useTheme();
  const canDevLogin = import.meta.env.VITE_DEV_BYPASS_AUTH === "1";
  // const [isRegistering, setIsRegistering] = useState(false); // No registration for now
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const login = trpc.auth.loginWithCredentials.useMutation({
    onSuccess: () => {
      // Reload to hydrate session
      window.location.href = "/";
    },
    onError: (e) => toast.error(e.message || "Credenciales inválidas"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email || !formData.password) {
      toast.error("Ingresá email y contraseña");
      return;
    }

    login.mutate(formData);
  };

  const handleOAuthLogin = () => {
    // All providers redirect to the main OAuth
    window.location.href = getLoginUrl();
  };

  const handleDevLogin = () => {
    window.location.href = "/api/dev/login";
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-background">
      {/* Animated Background */}
      <div className="animated-bg" />

      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute w-2 h-2 bg-purple-500/30 rounded-full animate-pulse" style={{ top: '20%', left: '10%' }} />
        <div className="absolute w-3 h-3 bg-blue-500/20 rounded-full animate-pulse" style={{ top: '60%', left: '80%', animationDelay: '1s' }} />
        <div className="absolute w-2 h-2 bg-pink-500/25 rounded-full animate-pulse" style={{ top: '80%', left: '20%', animationDelay: '2s' }} />
        <div className="absolute w-4 h-4 bg-cyan-500/15 rounded-full animate-pulse" style={{ top: '30%', left: '70%', animationDelay: '0.5s' }} />
        <div className="absolute w-2 h-2 bg-green-500/20 rounded-full animate-pulse" style={{ top: '50%', left: '40%', animationDelay: '1.5s' }} />
      </div>

      {/* Theme Toggle */}
      <div className="absolute top-4 right-4 z-10">
        <Button
          variant="outline"
          size="icon"
          onClick={toggleTheme}
          className="rounded-full bg-card/50 backdrop-blur-sm border-border/50 hover:bg-card"
        >
          {theme === "dark" ? (
            <Sun className="h-5 w-5 text-yellow-400" />
          ) : (
            <Moon className="h-5 w-5 text-purple-500" />
          )}
        </Button>
      </div>

      {/* Main Content */}
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Logo and Title */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 mb-4 shadow-lg shadow-purple-500/25">
              <MessageCircle className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text text-transparent">
              Imagine Lab CRM
            </h1>
            <p className="text-muted-foreground mt-2">
              Sistema de Gestión WhatsApp
            </p>
          </div>

          {/* Login Card */}
          <Card className="glass-card border-border/50 shadow-2xl shadow-purple-500/10">
            <CardHeader className="text-center pb-4">
              <CardTitle className="text-xl">
                Iniciar Sesión
              </CardTitle>
              <CardDescription>
                Accede a tu cuenta para continuar
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* OAuth Buttons */}
              <div className="grid gap-3">
                {canDevLogin && (
                  <Button
                    className="w-full h-11 bg-muted/60 hover:bg-muted border border-border/50 transition-all duration-300"
                    onClick={handleDevLogin}
                  >
                    Entrar como DEV (sin Google)
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="w-full h-11 bg-card/50 hover:bg-card border-border/50 transition-all duration-300 hover:border-primary/50 hover:shadow-md hover:shadow-primary/10"
                  onClick={handleOAuthLogin}
                >
                  <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  Continuar con Google
                </Button>

                <Button
                  variant="outline"
                  className="w-full h-11 bg-card/50 hover:bg-card border-border/50 transition-all duration-300 hover:border-primary/50 hover:shadow-md hover:shadow-primary/10"
                  onClick={handleOAuthLogin}
                >
                  <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                    <path fill="#F25022" d="M1 1h10v10H1z" />
                    <path fill="#00A4EF" d="M1 13h10v10H1z" />
                    <path fill="#7FBA00" d="M13 1h10v10H13z" />
                    <path fill="#FFB900" d="M13 13h10v10H13z" />
                  </svg>
                  Continuar con Microsoft
                </Button>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <Separator className="w-full" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">
                    O continúa con email
                  </span>
                </div>
              </div>

              {/* Email Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="tu@email.com"
                      className="pl-10 bg-card/50 border-border/50 focus:border-primary"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Contraseña</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      className="pl-10 bg-card/50 border-border/50 focus:border-primary"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full h-11 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg shadow-purple-500/25 transition-all duration-300 hover:shadow-xl hover:shadow-purple-500/30"
                >
                  Iniciar Sesión
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </form>

              <div className="pt-2 text-center">
                <DebugDialog />
              </div>

            </CardContent>
          </Card>

          {/* Footer */}
          <p className="text-center text-xs text-muted-foreground mt-6">
            Al continuar, aceptas nuestros{" "}
            <button className="text-primary hover:underline">Términos de Servicio</button>
            {" "}y{" "}
            <button className="text-primary hover:underline">Política de Privacidad</button>
          </p>
        </div>
      </div>
    </div>
  );
}

function DebugDialog() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runDiagnostics = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/public-debug");
      if (!res.ok) {
        throw new Error(`Error HTTP: ${res.status}`);
      }
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-center">
      <Button
        variant="link"
        size="sm"
        className="text-xs text-muted-foreground"
        onClick={() => {
          const win = window.open("", "Diagnóstico", "width=600,height=800");
          if (win) {
            win.document.write("<h1>Cargando diagnóstico...</h1>");
            fetch("/api/public-debug")
              .then(r => r.json())
              .then(d => {
                win.document.body.innerHTML = `<pre style='background:#eee; padding:10px; font-family:monospace'>${JSON.stringify(d, null, 2)}</pre>`;
              })
              .catch(e => {
                win.document.body.innerHTML = `<h1 style='color:red'>Error de conexión al backend</h1><p>El servidor no responde en /api/public-debug. Causa probable: Código no actualizado.</p><pre>${String(e)}</pre>`;
              });
          } else {
            alert("Por favor habilita las ventanas emergentes para ver el diagnóstico");
          }
        }}
      >
        🔍 Ejecutar Diagnóstico de Sistema
      </Button>
    </div>
  );
}
