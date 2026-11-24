/** Lo que hace falta de un plan para saber si una solicitud puede usarlo. */
export interface PlanParaCompletitud {
  actividades: {
    actividadProgramada: string;
    cantidadPersonasInstitucional: number;
    lugarSalida: string | null;
    lugarLlegada: string | null;
    participantesInstitucionales: unknown[];
  }[];
}

/**
 * Qué le falta al plan para respaldar una solicitud de viaje, o `null` si
 * está completo. El plan no pasa por VoBo: estar completo es lo que lo vuelve
 * utilizable.
 */
export function faltanteDelPlan(plan: PlanParaCompletitud): string | null {
  if (plan.actividades.length === 0) {
    return 'El plan de viaje no tiene actividades';
  }
  for (const a of plan.actividades) {
    const seleccionados = a.participantesInstitucionales.length;
    if (seleccionados !== a.cantidadPersonasInstitucional) {
      return `En "${a.actividadProgramada}" declaraste ${a.cantidadPersonasInstitucional} persona(s) institucional(es) pero seleccionaste ${seleccionados}`;
    }
    // Las filas migradas de antes del ANEXO 1 pueden no tener estos lugares
    if (!a.lugarSalida || !a.lugarLlegada) {
      return `En "${a.actividadProgramada}" faltan el lugar de salida o el de llegada`;
    }
  }
  return null;
}

export function planCompleto(plan: PlanParaCompletitud): boolean {
  return faltanteDelPlan(plan) === null;
}
