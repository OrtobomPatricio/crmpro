export type Role = "owner" | "admin" | "supervisor" | "agent" | "viewer";

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

    // owner nunca se degrada
    if (base === "owner") return "owner";

    const custom = (args.customRole || "").trim();
    if (!custom) return base;

    // customRole solo si existe en la matriz
    if (!Object.prototype.hasOwnProperty.call(args.permissionsMatrix, custom)) return base;

    // prohibido elevar a owner
    if (custom === "owner") return base;

    // evitar escalamiento entre roles built-in
    const baseRank = BUILTIN_RANK[base] ?? 0;
    const customRank = BUILTIN_RANK[custom];

    // si custom es built-in y escala, bloquea
    if (typeof customRank === "number" && customRank > baseRank) return base;

    // si custom NO es built-in (rol “custom”), solo permitilo si base es admin
    // AJUSTE: o si es el owner quien lo asignó (que ya se valida en el update), 
    // pero aqui en runtime, un agente no deberia tener un rol custom que le de mas permisos que su base?
    // La regla original dice: "si custom NO es built-in... solo permitilo si base es admin"
    // Esto asume que un "Admin" es el único que puede tener roles custom poderosos?
    // Si un Supervisor tiene un rol custom "SupervisorPower", ¿debería permitirse?
    // Siguiendo la instrucción estricta:
    if (typeof customRank !== "number" && base !== "admin") return base;

    return custom;
}
