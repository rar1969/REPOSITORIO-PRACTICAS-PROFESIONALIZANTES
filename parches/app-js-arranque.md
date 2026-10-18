# Parche para `js/app.js` — arranque

Tres cambios al final del archivo, en el bloque `// Inicialización` (línea 998 y
siguientes). Los dos primeros son obligatorios.

## 1. Quitar la llamada a una función que no existe

```javascript
  // antes
  renderOferentes();
  renderRepositorio();
  renderCasosExitosos();      // ← esta función no está definida en ninguna parte
  renderCapacitaciones();
  renderAdminPanel();

  // después
  renderOferentes();
  renderRepositorio();
  renderAdminPanel();
```

`renderCasosExitosos()` no existe: se la llama en la línea 1004 y no está
declarada ni en `app.js` ni en ningún otro archivo. Lanza un `ReferenceError`
que corta la inicialización ahí mismo, así que **las dos líneas siguientes nunca
se ejecutaron**. Eso explica tres síntomas a la vez: la grilla de casos vacía, la
de capacitaciones vacía y los KPI de la portada en blanco.

`renderCapacitaciones()` sale de la lista porque ahora esa vista la dibuja su
módulo. `renderAdminPanel()` se queda: el panel sigue siendo del código viejo, y
con este cambio vuelve a dibujarse.

## 2. El menú dice 38 escuelas

En `index.html`, línea 70:

```html
<button class="nav-btn" data-view="mapa"><i class="fas fa-map-location-dot"></i> Mapa (39 Escuelas)</button>
```

Lo mismo en el pie de página, línea 752. Mejor todavía: sacar el número del
texto, porque vuelve a quedar viejo con la próxima creación.

## 3. Opcional: los enlaces del pie

Las líneas 751 a 754 navegan con `onclick="document.querySelector(…).click()"`.
Ahora que cada vista tiene dirección propia, pueden ser enlaces de verdad:

```html
<li><a href="#/directorio" style="color: #e2e8f0;">Directorio de Empresas</a></li>
```

Se pueden abrir en otra pestaña, copiar y mandar por WhatsApp. No es urgente;
queda para cuando se limpien los `onclick` inline, que es el ítem siguiente de
la fase 1.
