# Librerías incluidas

Copias exactas de los paquetes publicados en npm, servidas por el propio portal
(sin CDN) para que la generación de certificados no dependa de un servicio externo.
Se cargan solo al generar un PDF en el Panel DETyFP.

| Archivo | Paquete | Versión | Licencia |
|---|---|---|---|
| `pdf-lib-1.17.1.esm.min.js` | [pdf-lib](https://github.com/Hopding/pdf-lib) (`dist/pdf-lib.esm.min.js`) | 1.17.1 | MIT |
| `fontkit-1.1.1.umd.min.js` | [@pdf-lib/fontkit](https://github.com/Hopding/fontkit) (`dist/fontkit.umd.min.js`) | 1.1.1 | MIT |

Para actualizar: `npm pack pdf-lib@<versión>` y copiar el mismo archivo de `dist/`,
cambiando el nombre y las rutas en `js/modules/certificados/recursos.js`.
