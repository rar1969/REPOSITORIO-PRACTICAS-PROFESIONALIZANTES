# Fase 2 — Puesta en marcha de la base de datos (Supabase)

Esta guía es para hacer **una sola vez**. Cuando termine, el portal deja de guardar
en cada navegador y pasa a una base compartida, con ingreso por correo y contraseña.
Todo se hace desde el navegador: no hace falta instalar nada.

> Hasta completar el paso 8, el portal publicado sigue en modo demostración
> (`adaptador: 'estatico'`). Nada de esto lo afecta mientras tanto.

## Antes de empezar: ¿con qué cuenta?

Conviene crear la cuenta de Supabase con un **correo institucional de la DETyFP**
(o uno compartido del equipo), no con uno personal. El portal es de la Dirección:
si un día cambia quien lo mantiene, la base no debería quedar atada a una persona.

El plan gratuito alcanza con holgura para el portal. Un detalle: **un proyecto
gratuito se pausa si pasa una semana sin uso**. Se reactiva desde el panel con un
clic, pero conviene saberlo antes de presentarlo.

---

## 1. Crear el proyecto

1. Entrar a **supabase.com** → *Start your project* → registrarse.
2. *New project*:
   - **Name:** `portal-pp-detyfp`
   - **Database password:** generar una y **guardarla** en un lugar seguro.
   - **Region:** *South America (São Paulo)*, la más cercana.
3. Esperar uno o dos minutos a que diga que está listo.

## 2. Crear las tablas y los permisos

En el menú de la izquierda: **SQL Editor** → *New query*. Para cada archivo, en este orden:

| Orden | Archivo en GitHub | Qué hace |
|---|---|---|
| 1 | `supabase/migraciones/001_esquema.sql` | Tablas, permisos por rol y auditoría |
| 2 | `supabase/migraciones/002_almacenamiento.sql` | Espacio para los archivos del repositorio |
| 3 | `supabase/semillas.sql` | Carga las 39 escuelas, especialidades, departamentos y los ejemplos |

Para copiar cada uno: abrirlo en GitHub → botón **Raw** → seleccionar todo → copiar →
pegar en el editor SQL → **Run**. Tiene que decir *Success*. Si da error, no seguir:
mandar una captura.

## 3. Cerrar el registro abierto

**Authentication → Sign In / Providers** → desactivar **Allow new users to sign up**.

Así nadie se crea una cuenta solo: las da la Dirección. Es importante porque la base
guarda datos de estudiantes menores de edad.

## 4. Indicar la dirección del portal

**Authentication → URL Configuration**:

- **Site URL:** `https://rar1969.github.io/REPOSITORIO-PRACTICAS-PROFESIONALIZANTES/`
- **Redirect URLs:** agregar la misma dirección.

Es a donde vuelve una persona cuando toca el enlace de "olvidé mi contraseña".

## 5. Crear tu usuario

**Authentication → Users → Add user → Create new user**: tu correo, una contraseña
de al menos 8 caracteres, y tildar **Auto Confirm User**.

## 6. Darte el rol de administrador

Volver al **SQL Editor**, nueva consulta, pegar (con tu correo) y **Run**:

```sql
update public.perfiles
set rol = 'admin', nombre = 'Rodolfo A. Rodríguez'
where correo = 'TU-CORREO@ejemplo.com';
```

Todo usuario nuevo arranca como **visitante**. Los roles posibles son `admin`,
`escuela`, `empresa`, `docente`, `estudiante` y `visitante`. Para una escuela, además
del rol se indica cuál es (sus practicantes son los únicos que va a ver):

```sql
update public.perfiles
set rol = 'escuela', nombre = 'ET N° 2 Obispo Colombres',
    escuela_id = (select id from public.escuelas where nombre ilike '%Obispo Colombres%')
where correo = 'correo-de-la-escuela@ejemplo.com';
```

## 7. Copiar las dos claves públicas

**Project Settings → API** (puede figurar como *Data API* o *API Keys*):

- **Project URL** — algo como `https://abcdxyz.supabase.co`
- **anon public** — una clave larga que empieza con `eyJ…`

Esas dos sí se pueden compartir: están hechas para ir dentro del portal, y lo que
protege los datos son los permisos de la base.

> **No copies nunca la clave `service_role`** ni la contraseña de la base. Esas dan
> acceso total y no deben estar en el portal ni en un chat.

## 8. Activar el portal

Mandame la **Project URL** y la **anon public**. Cambio una línea de `index.html`:

```html
<script>window.PORTAL_CONFIG = {
  adaptador: 'supabase',
  supabase: { url: 'https://abcdxyz.supabase.co', clave: 'eyJ…' }
};</script>
```

…y lo subo. Desde ese momento el desplegable "Modo / Perfil" desaparece y aparece
el botón **Ingresar**.

---

## Qué protege la base (probado)

Las políticas de `001_esquema.sql` están probadas sobre un Postgres real
(`pruebas/base-de-datos.mjs`, 44 comprobaciones) y con el portal completo
(`pruebas/fase2-integracion.mjs`, 33):

| Quién | Ve | Puede cambiar |
|---|---|---|
| Visitante (sin sesión) | Oferentes, escuelas, mapa, documentos, casos, capacitaciones | Enviar solicitudes, que quedan pendientes |
| Usuario sin rol | Lo mismo que un visitante | Nada más |
| Escuela | Además, **solo sus** practicantes | Cargar y editar sus practicantes |
| Empresa | Lo público | Su propia ficha (cupos, contacto, tareas), **no** el estado del convenio |
| Administrador DETyFP | Todo, incluida la auditoría | Todo |

Además:

- **Ningún estudiante es visible sin sesión**, aunque alguien arme pedidos a mano con la clave pública.
- **Cada alta, cambio, baja y descarga queda en la tabla `auditoria`**, con fecha y usuario.
- Los archivos subidos quedan en el almacenamiento de Supabase con enlace permanente.

## Mantenimiento

- **Corregir la nómina de escuelas:** se sigue editando `data/escuelas.csv`. Después hay que regenerar `supabase/semillas.sql` y volver a correrlo en el SQL Editor; actualiza sin borrar lo cargado desde el portal. Avisame y lo regenero.
- **Quitar los registros de ejemplo de la base,** cuando haya datos reales: en el SQL Editor, `delete from public.oferentes where ejemplo;` (y lo mismo en `casos`, `documentos`, `capacitaciones`, `estudiantes`, `solicitudes`).
- **"Olvidé mi contraseña"** usa el correo de Supabase, que en el plan gratuito manda pocos correos por hora. Si se vuelve un problema, se configura un correo propio en *Authentication → Emails*.
- **Exportar todo** (SDD §6, portabilidad): *Database → Backups*, o desde el SQL Editor descargando cada tabla como CSV.
