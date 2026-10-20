/**
 * main — punto de entrada del portal.
 *
 * Reemplaza al par bootstrap.js + app.js de la fase 1. No hay más objeto
 * global de datos ni funciones colgadas de `window`: todo lo que el portal
 * hace pasa por core/, que monta los módulos, y por services/api, que es el
 * único que toca los datos.
 */

import { iniciar } from './core/index.js';
import { api } from './services/api.js';

try {
  await iniciar();
  console.info(`[portal] Listo (adaptador de datos: ${api.origen}).`);
} catch (error) {
  console.error('[portal] Falló el arranque.', error);
  const aviso = document.createElement('p');
  aviso.setAttribute('role', 'alert');
  aviso.style.cssText = 'padding:1rem;background:#b3261e;color:#fff;margin:0';
  aviso.textContent = 'No se pudo cargar el portal. Actualizá la página o avisá a la DETyFP.';
  document.body.prepend(aviso);
}
