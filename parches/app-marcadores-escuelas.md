# Parche para `js/app.js` — escuelas sin ubicación exacta

Dos cambios en la función `initMap()`. Son los únicos que el `app.js` actual necesita
para convivir con la nómina real.

## 1. Un segundo ícono, atenuado, para las ubicaciones aproximadas

Justo después de la definición de `companyIcon` (alrededor de la línea 362), agregar:

```javascript
    // Escuelas ubicadas por localidad, no por domicilio: ícono traslúcido y punteado.
    const schoolIconAprox = L.divIcon({
      className: 'custom-map-icon school-icon school-icon--aprox',
      html: `<div style="background: #7dd3fc; color: #0c4a6e; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1rem; box-shadow: 0 2px 5px rgba(0,0,0,0.2); border: 2px dashed white; opacity: 0.75;"><i class="fas fa-graduation-cap"></i></div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });
```

## 2. El bucle de marcadores

Reemplazar la línea 369 (`window.PORTAL_DATA.escuelas.forEach(esc => {`) y la
siguiente por:

```javascript
    window.PORTAL_DATA.escuelas
      .filter(esc => esc.lat !== null && esc.lng !== null)
      .forEach(esc => {
      const aproximada = esc.precision !== 'domicilio';
      const marker = L.marker([esc.lat, esc.lng], {
        icon: aproximada ? schoolIconAprox : schoolIcon,
        title: aproximada ? `${esc.nombre} — ubicación aproximada` : esc.nombre
      }).addTo(AppState.leafletMap);
```

El `.filter()` es obligatorio: hay escuelas sin coordenada y Leaflet rompe con `null`.

## 3. El aviso dentro del globo

Dentro de `popupContent`, después de la línea del nombre (`<h4 …>${esc.nombre}</h4>`),
agregar:

```javascript
          ${aproximada ? `<p style="margin: 0 0 0.4rem; font-size: 0.72rem; color: #b45309; background: #fef3c7; border-radius: 4px; padding: 0.2rem 0.4rem;"><i class="fas fa-triangle-exclamation"></i> Ubicación aproximada: apunta a la localidad, no al edificio.</p>` : ''}
```

Y conviene mostrar el domicilio, que ahora existe, junto a la localidad:

```javascript
            <i class="fas fa-location-dot" style="color: #0284c7;"></i> ${esc.direccion ? esc.direccion + ' — ' : ''}${esc.localidad} (Dpto. ${esc.departamento})<br>
```

## 4. Regla pendiente, para cuando exista la búsqueda por proximidad

Una escuela con `precision !== 'domicilio'` **no debe participar** del filtro por radio
de distancia. Un error de uno a tres kilómetros es inofensivo para mirar un mapa y
engañoso para decidir si una empresa queda a 5 km de una escuela.
