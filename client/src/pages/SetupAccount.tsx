
import { useState } from "react";
import { useLocation, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function SetupAccount() {
    const [, setLocation] = useLocation();
    const search = useSearch();
    const params = new URLSearchParams(search);
    const token = params.get("token");

    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");

    const accept = trpc.auth.acceptInvitation.useMutation({
        onSuccess: () => {
            toast.success("Cuenta configurada correctamente. Iniciando sesión...");
            // We don't have an /auth route – after activation we can safely send the user to the dashboard.
            setTimeout(() => setLocation("/"), 1200);
        },
        onError: (e) => toast.error(e.message),
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirm) {
            toast.error("Las contraseñas no coinciden");
            return;
        }
        if (!token) {
            toast.error("Token inválido");
            return;
        }
        accept.mutate({ token, password });
    };

    if (!token) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <Card className="w-full max-w-md">
                    <CardHeader>
                        <CardTitle className="text-red-500">Enlace inválido</CardTitle>
                        <CardDescription>No se encontró el token de invitación.</CardDescription>
                    </CardHeader>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle>Bienvenido a Imagine CRM</CardTitle>
                    <CardDescription>
                        Configurá tu contraseña para activar tu cuenta.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="password">Nueva Contraseña</Label>
                            <Input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                                minLength={6}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="confirm">Confirmar Contraseña</Label>
                            <Input
                                id="confirm"
                                type="password"
                                value={confirm}
                                onChange={(e) => setConfirm(e.target.value)}
                                placeholder="••••••••"
                                required
                                minLength={6}
                            />
                        </div>

                        <Button type="submit" className="w-full" disabled={accept.isPending}>
                            {accept.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Activar Cuenta
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
