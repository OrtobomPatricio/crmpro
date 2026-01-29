export type Role = "owner" | "admin" | "supervisor" | "agent" | "viewer";

// Definimos la jerarquía de roles built-in para evitar escalación (escalation)
// Un usuario con rol base inferior no debería poder adquirir rol custom que eleve privilegios, 
// PERO en este diseño, el 'customRole' es simplemente un set de permisos que reemplaza a la matriz por defecto.
// La seguridad recae en quién asigna el rol. Solo el Admin/Owner puede asignar roles custom.
// Por ende, si un admin le asigna un rol "SupervisorPower" a un "Agent", es intencional.

const BUILTIN_RANK: Record<string, number> = {
    viewer: 0,
    agent: 1,
    supervisor: 2,
    admin: 3,
    owner: 4,
};

export function computeEffectiveRole(args: {
    baseRole: string;
    customRole?: string | null;
    permissionsMatrix: Record<string, string[]>;
}) {
    const base = (args.baseRole || "agent").trim();

    // Owner siempre es Owner, no se degrada por custom role
    if (base === "owner") return "owner";

    const custom = (args.customRole || "").trim();
    if (!custom) return base;

    // customRole solo es válido si existe en la matriz de permisos
    if (!Object.prototype.hasOwnProperty.call(args.permissionsMatrix, custom)) return base;

    // Prohibido elevar a owner mediante custom role
    if (custom === "owner") return base;

    // Si custom es un rol built-in (ej. 'admin'), verificamos escalación
    // Esto previene que si por error se asigna 'admin' en customRole a un 'agent', no surta efecto si hay reglas automáticas.
    // Sin embargo, si la asignación es manual por un admin, debería valer. 
    // Mantenemos la protección de no escalar a un built-in role superior via customRole por seguridad.
    const baseRank = BUILTIN_RANK[base] ?? 0;
    const customRank = BUILTIN_RANK[custom];

    if (typeof customRank === "number" && customRank > baseRank) {
        // Bloquear escalación a rol built-in superior (ej. Agente -> Admin) via customRole 
        // Si se quiere promocionar, se debe cambiar el baseRole.
        return base;
    }

    // Permitir custom role para CUALQUIER base role (siempre que no sean owner o escalación built-in)
    // El objetivo es permitir roles como "Agente de Ventas VIP" o "Supervisor de Soporte"
    return custom;
}
