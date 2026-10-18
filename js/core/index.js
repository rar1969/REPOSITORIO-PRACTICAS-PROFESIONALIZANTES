/**
 * core — arranque del portal.
 *
 * Registra los módulos, arma el contexto que reciben y enciende el ruteador.
 * Es el único archivo que conoce la lista de módulos: agregar uno es agregar
 * una línea acá, y nada más.
 */

import { api } from '../services/api.js';
import { registrar, registrados } from './registro.js';
import { emitir, escuchar } from './bus.js';
import { iniciar as iniciarRouter, ir } from './router.js';

// Los módulos ya migrados. Los que faltan siguen dentro de app.js.
import casos from '../modules/casos/index.js';
import capacitaciones from '../modules/capacitaciones/index.js';

const MODULOS = [casos, capacitaciones];

export async function iniciar() {
  for (const modulo of MODULOS) registrar(modulo);

  const ctx = { api, emitir, escuchar, ir };
  iniciarRouter(ctx);

  // Respuestas a eventos que todavía no tienen módulo propio.
  escuchar('caso:replicar', id => {
    emitir('aviso', {
      texto: 'Pedido registrado. La DETyFP te contacta para replicar la experiencia.',
      tipo: 'success', referencia: id
    });
  });

  // Puente con el `showToast` del app.js heredado, mientras exista.
  escuchar('aviso', ({ texto, tipo }) => {
    if (typeof window.showToast === 'function') window.showToast(texto, tipo);
    else console.info(`[aviso] ${texto}`);
  });

  console.info(`[core] ${registrados().length} módulos registrados:`,
    registrados().map(m => m.id).join(', '));
}

export { ir, emitir, escuchar };
