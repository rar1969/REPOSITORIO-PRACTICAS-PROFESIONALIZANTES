/**
 * core — arranque del portal.
 *
 * Registra los módulos, arma el contexto que reciben y enciende el ruteador.
 * Es el único archivo que conoce la lista de módulos: agregar uno es agregar
 * una línea acá, y nada más. Quitar uno, lo mismo —el resto del portal sigue
 * andando sin esa opción.
 */

import { api } from '../services/api.js';
import { registrar, registrados, persistentes } from './registro.js';
import { emitir, escuchar } from './bus.js';
import { iniciar as iniciarRouter, ir } from './router.js';
import { iniciarSesion } from './sesion.js';
import { iniciarModales } from '../ui/modal.js';
import { iniciarTema } from '../ui/tema.js';
import { avisar } from '../ui/aviso.js';

// Vistas: una por sección del menú.
import inicio from '../modules/inicio/index.js';
import directorio from '../modules/directorio/index.js';
import mapa from '../modules/mapa/index.js';
import capacitaciones from '../modules/capacitaciones/index.js';
import repositorio from '../modules/repositorio/index.js';
import casos from '../modules/casos/index.js';
import admin from '../modules/admin/index.js';

// Persistentes: se abren desde cualquier vista y responden al bus.
import solicitudes from '../modules/solicitudes/index.js';
import oferente from '../modules/oferente/index.js';
import documentos from '../modules/documentos/index.js';

const MODULOS = [
  inicio, directorio, mapa, capacitaciones, repositorio, casos, admin,
  solicitudes, oferente, documentos
];

export async function iniciar() {
  iniciarTema();
  iniciarModales();
  escuchar('aviso', ({ texto, tipo } = {}) => avisar(texto, tipo));
  const sesion = await iniciarSesion();   // en modo supabase, espera la sesión guardada

  for (const modulo of MODULOS) registrar(modulo);

  const ctx = { api, emitir, escuchar, ir, sesion };

  // Los persistentes primero: cuando una vista emita algo, ya hay quien oiga.
  for (const modulo of persistentes()) {
    try {
      await modulo.montar(document.body, ctx);
    } catch (error) {
      console.error(`[core] No se pudo montar "${modulo.id}".`, error);
    }
  }

  await iniciarRouter(ctx);

  console.info(`[core] ${registrados().length} módulos registrados:`,
    registrados().map(m => m.id).join(', '));
}

export { ir, emitir, escuchar };
