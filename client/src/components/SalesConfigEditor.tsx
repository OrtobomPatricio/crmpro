
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useState, useEffect } from "react";
import { DollarSign, Percent } from "lucide-react";

export function SalesConfigEditor({ query, onSave, isPending }: any) {
    const [salesForm, setSalesForm] = useState({
        defaultCommissionRate: 10,
        currencySymbol: "G$",
        requireValueOnWon: true
    });

    useEffect(() => {
        if (query.data?.salesConfig) {
            setSalesForm({
                defaultCommissionRate: (query.data.salesConfig.defaultCommissionRate ?? 0.10) * 100,
                currencySymbol: query.data.salesConfig.currencySymbol ?? "G$",
                requireValueOnWon: query.data.salesConfig.requireValueOnWon ?? true
            });
        }
    }, [query.data]);

    const handleSave = () => {
        const payload = {
            salesConfig: {
                defaultCommissionRate: Math.max(0, Math.min(1, (salesForm.defaultCommissionRate ?? 0) / 100)),
                currencySymbol: salesForm.currencySymbol?.trim() || "G$",
                requireValueOnWon: !!salesForm.requireValueOnWon,
            },
        };
        onSave?.(payload);
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Configuración de Ventas</CardTitle>
                <CardDescription>Define reglas automáticas para comisiones y metas.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                        <Label>Comisión por Defecto (%)</Label>
                        <div className="relative">
                            <Percent className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="number"
                                className="pl-9"
                                value={salesForm.defaultCommissionRate}
                                onChange={(e) => setSalesForm(p => ({ ...p, defaultCommissionRate: parseFloat(e.target.value) }))}
                            />
                        </div>
                        <p className="text-xs text-muted-foreground">Se aplicará a los usuarios que no tengan una regla específica.</p>
                    </div>

                    <div className="space-y-2">
                        <Label>Símbolo de Moneda</Label>
                        <div className="relative">
                            <DollarSign className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                className="pl-9"
                                value={salesForm.currencySymbol}
                                onChange={(e) => setSalesForm(p => ({ ...p, currencySymbol: e.target.value }))}
                                placeholder="G$, USD, €"
                            />
                        </div>
                    </div>
                </div>

                <div className="flex items-center space-x-2 border p-3 rounded-lg">
                    <Switch
                        checked={salesForm.requireValueOnWon}
                        onCheckedChange={(c) => setSalesForm(p => ({ ...p, requireValueOnWon: c }))}
                    />
                    <div>
                        <Label>Requerir Valor al Ganar</Label>
                        <p className="text-xs text-muted-foreground">Al mover un lead a "Ganado", obligar a ingresar el monto de la venta.</p>
                    </div>
                </div>

                <div className="flex justify-end pt-2">
                    <Button onClick={handleSave} disabled={isPending}>
                        {isPending ? "Guardando..." : "Guardar Configuración"}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
