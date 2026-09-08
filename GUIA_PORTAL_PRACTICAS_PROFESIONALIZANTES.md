# GUÍA PARA LA CREACIÓN DEL PORTAL DE RECURSOS DE PRÁCTICAS PROFESIONALIZANTES
### DIRECCIÓN DE EDUCACIÓN TÉCNICA Y FORMACIÓN PROFESIONAL &bull; MINISTERIO DE EDUCACIÓN &bull; GOBIERNO DE TUCUMÁN

*Un ecosistema digital para conectar escuelas técnicas y agrotécnicas, estudiantes, empresas y organismos, sistematizar recursos, compartir experiencias y ampliar las oportunidades de formación profesionalizante en la Provincia de Tucumán.*

---

## 1. Fundamentación y Propósito

### 1.1 Problema que resuelve
Las Prácticas Profesionalizantes (PP) constituyen un eje central en la Educación Técnico Profesional (ETP) de la Provincia de Tucumán, vinculando el entorno formativo escolar con el entramado productivo citrícola, azucarero, metalmecánico, bioenergético, tecnológico y socio-comunitario regional. Sin embargo, históricamente se han detectado las siguientes limitaciones sistémicas:
* **Fragmentación de la información:** Desconexión entre las necesidades formativas de las escuelas técnicas/agrotécnicas y las ofertas del sector de la producción y los servicios.
* **Sobrecarga burocrática y dispersión documental:** Dificultad de los docentes tutores para acceder a modelos estandarizados de convenios, actas acuerdo, planillas de evaluación, normas de cobertura de seguro provincial y bitácoras de seguimiento.
* **Falta de visibilidad de experiencias exitosas:** Inexistencia de un repositorio público donde las escuelas tucumanas puedan visibilizar proyectos destacados y donde otras instituciones o empresas puedan tomar modelos replicables.
* **Incertidumbre en la trazabilidad y fiscalización:** Ausencia de indicadores centralizados en tiempo real sobre la cantidad de estudiantes vinculados, oferta por especialidad y convenios próximos a vencer a nivel provincial en la Dirección de ETP de Tucumán.

### 1.2 Objetivos Generales y Específicos
* **Objetivo General:** Desarrollar e implementar un portal web integral de recursos, directorio georreferenciado y panel de gestión para las Prácticas Profesionalizantes de la Educación Técnico Profesional de la Provincia de Tucumán.
* **Objetivos Específicos:**
  1. Sistematizar el catálogo provincial de empresas e industrias oferentes en los 17 departamentos de Tucumán con filtros geográficos y por especialidad ETP.
  2. Proveer un repositorio pedagógico digital único, accesible y actualizado para equipos directivos, supervisores y docentes tutores.
  3. Difundir casos de éxito de prácticas profesionalizantes estandarizadas para incentivar nuevos convenios del sector productivo.
  4. Proveer un panel de control con métricas en tiempo real para la Dirección de Educación Técnica y Formación Profesional del Ministerio de Educación de Tucumán.

### 1.3 Público Destinatario
* **Estudiantes de ETP:** Para consultar empresas elegibles en su departamento, requisitos de perfiles y conocer experiencias de sus pares.
* **Docentes y Tutores de Prácticas:** Para descargar instrumentos pedagógico-administrativos y realizar el seguimiento.
* **Equipos Directivos Escolares:** Para gestionar la nómina institucional, vincular con oferentes y proponer experiencias.
* **Empresas e Industrias (Oferentes):** Para dar a conocer su perfil, comunicar cupos requeridos y formalizar convenios con la Dirección de ETP.
* **Autoridades Provinciales / Dirección de ETP - Ministerio de Educación:** Para validar registros, supervisar convenios y evaluar el impacto del programa en Tucumán.
* **Comunidad General / Visitantes:** Para conocer el potencial técnico y productivo de la provincia.

### 1.4 Alcance Provincial (Los 17 Departamentos de Tucumán)
El portal cubre la totalidad del territorio tucumano, conectando los 17 departamentos: **Capital (San Miguel de Tucumán), Cruz Alta, Tafí Viejo, Yerba Buena, Monteros, Chicligasta (Concepción), Lules, Famaillá, Tafí del Valle, Leales (Bella Vista), Burruyacú, Trancas, Simoca, Graneros, Río Chico (Aguilares) y La Cocha**, articulando con centros de formación profesional, escuelas secundarias técnicas y agrotécnicas.

### 1.5 Principios Fundamentales del Portal
* **Accesibilidad:** Cumplimiento de pautas WCAG 2.1 Nivel AA para garantizar el acceso universal.
* **Actualización Dinámica:** Flujos de trabajo institucionales con estados claros para evitar datos obsoletos.
* **Trazabilidad:** Registro auditado de cada alta, convenio, actualización y descarga documental.
* **Reutilización:** Recursos pedagógicos y proyectos licenciados para su libre adaptación entre escuelas.
* **Difusión Institucional:** Generación de piezas digitales (QR, enlaces permanentes) con la identidad oficial del Gobierno de Tucumán.

---

## 2. Arquitectura General del Portal

El portal se organiza en los siguientes módulos estructurales:

```
Portal de Recursos de Prácticas Profesionalizantes - DETyFP Tucumán
 ├── 1. Página de Inicio (Header Oficial, Buscador Rápido, Métricas, Destacados)
 ├── 2. Directorio de Oferentes / Buscador de Empresas de Tucumán
 ├── 3. Mapa Interactivo Cartográfico de los 17 Departamentos
 ├── 4. Repositorio Pedagógico Documental (Resoluciones, Convenios, Seguros)
 ├── 5. Casos Exitosos & Banco de Experiencias Tucumanas
 ├── 6. Normativa & Marco Jurídico Ministerial
 ├── 7. Módulos Específicos por Perfil (Escuelas, Estudiantes, Empresas)
 ├── 8. Novedades y Noticias del Sector ETP Tucumán
 ├── 9. Formulario "Quiero ser Oferente" (Tucumán)
 ├── 10. Formulario "Quiero publicar una Experiencia"
 ├── 11. Canal de Contacto & Mesa de Ayuda DETyFP
 └── 12. Panel de Administración Directivo (DETyFP Tucumán)
```

---

## 3. Directorio de Oferentes

El registro de cada empresa u organización oferente dentro del sistema cuenta con un esquema de datos normalizado y completo.

### Campos obligatorios por registro:
| Campo | Tipo de Dato | Descripción |
|---|---|---|
| `id_empresa` | UUID / Int | Identificador único del sistema (ej. OFER-TUC-001) |
| `razon_social` | String (150) | Nombre legal de la empresa u organización |
| `cuit` | String (13) | CUIT verificado (ej. 30-54128920-4) |
| `tipo_organizacion` | Enum | Empresa Privada / Organismo Público / PyME / Cooperativa |
| `departamento` | Enum (17) | Departamento de Tucumán (ej. Capital, Cruz Alta, Monteros, etc.) |
| `localidad` | String (100) | Localidad o municipio tucumano |
| `direccion` | String (200) | Domicilio legal o de planta industrial |
| `latitud` / `longitud` | Decimal (9,6) | Coordenadas geográficas para cartografía de Tucumán |
| `telefono` | String (30) | Teléfono de contacto institucional |
| `correo_contacto` | String (100) | Correo electrónico verificado |
| `sitio_web` | String (150) | Enlace al portal institucional o redes |
| `contacto_persona` | String (150) | Nombre y cargo del referente institucional |
| `especialidades_tecnicas` | Array / List | Electrónica, Electromecánica, Informática, Agro, Química, Automotores, etc. |
| `perfiles_requeridos` | Text | Descripción de las tareas o perfiles demandados |
| `escuelas_vinculadas` | Array / ForeignKeys | Lista de escuelas técnicas/agrotécnicas vinculadas |
| `convenio_vigente` | Boolean | Indica si posee convenio firmado activo |
| `fecha_inicio_convenio` | Date | Fecha de suscripción del convenio |
| `fecha_vencimiento_convenio` | Date | Fecha de caducidad del convenio |
| `cupos_disponibles` | Integer | Cantidad de vacantes de prácticas |
| `tipo_practica` | Enum | Presencial / Semipresencial / Proyecto productivo simulado |
| `estado` | Enum | Activo / Inactivo / En revisión / Vencido |
| `observaciones` | Text | Notas administrativas internas de la DETyFP |
| `fecha_ultima_actualizacion` | Timestamp | Trazabilidad de modificación |

---

## 4. Mapa Interactivo de la Provincia de Tucumán

El visor geográfico permite visualizar la distribución territorial de los oferentes y las escuelas vinculadas en la provincia.

* **Marcadores Personalizados:** Iconografía según sector industrial o especialidad (Citrícola, Azucarero, Automotriz, Informática, Química, etc.).
* **Filtros Cartográficos:** Selección simultánea por localidad, departamento tucumano, especialidad y estado de convenio.
* **Búsqueda por Proximidad:** Radio de distancia configurable (ej. 5km, 10km, 25km) desde una escuela técnica seleccionada.
* **Ficha Emergente (Tooltip/Popup):** Vista previa de la empresa con nombre, especialidad, dirección en Tucumán, cupos disponibles y botón directo "Ver Ficha Completa / Contactar".
* **Conexión Visual:** Representación vectorial de los vínculos entre una escuela técnica y sus empresas oferentes asociadas.

---

## 5. Sistema de Filtros y Búsqueda

Permite encontrar oportunidades de prácticas mediante filtros combinados en tiempo real:

### 5.1 Por Especialidad Técnica
* Electrónica
* Electromecánica
* Informática y Programación
* Construcciones / Maestro Mayor de Obras
* Automotores / Mecanizado CNC
* Agropecuaria y Citricultura
* Energías Renovables y Biomasa
* Química y Tecnología Azucarera / Alimentos
* Administración y Economía Personal
* Otras especialidades ETP

### 5.2 Por Ubicación (17 Departamentos de Tucumán)
* Capital, Cruz Alta, Tafí Viejo, Yerba Buena, Monteros, Chicligasta, Lules, Famaillá, Tafí del Valle, Leales, Burruyacú, Trancas, Simoca, Graneros, Río Chico, La Cocha.

### 5.3 Por Estado de Convenio
* **Convenio Vigente:** Listo para recibir alumnos.
* **En Proceso de Firma:** Convenio en etapa administrativa en la DETyFP.
* **Histórico:** Convenios finalizados para registro estadístico.

---

## 6. Repositorio Pedagógico ETP Tucumán

El repositorio digital organiza los recursos necesarios para la gestión técnico-pedagógica de las prácticas profesionalizantes.

### 6.1 Categorías Principales
1. **Normativa Tucumán:** Resoluciones del Ministerio de Educación de Tucumán, Ley de ETP N° 26.058, disposiciones de la DETyFP.
2. **Convenios Marco y Específicos:** Modelos descargables en formato `.docx` y `.pdf`.
3. **Seguros y Cobertura:** Protocolos de ART y seguro escolar provincial de Tucumán.
4. **Bitácora Digital:** Plantillas de diario de actividades y registros para el estudiante.
5. **Planillas y Formularios:** Fichas de inscripción, evaluación de desempeño y encuestas.
6. **Seguimiento y Evaluación:** Rúbricas de competencias técnicas y transversales.
7. **Instructivos y Protocolos:** Guías de seguridad e higiene laboral en plantas cítricas, ingenios y talleres CNC.

---

## 7. Casos Exitosos (Banco de Experiencias en Tucumán)

Módulo destinado a jerarquizar y visibilizar las prácticas profesionalizantes destacadas.

### 7.1 Ficha Estandarizada de Caso Exitoso
* **Nombre de la experiencia:** Título del proyecto o práctica.
* **Escuela participante:** Nombre y número de la institución educativa de Tucumán.
* **Localidad / Departamento:** Ubicación territorial en Tucumán.
* **Especialidad ETP:** Área técnica vinculada.
* **Empresa / Organización oferente:** Contraparte del sector productivo tucumano.
* **Cantidad de estudiantes participantes:** Nómina de beneficiarios.
* **Duración:** Cantidad de horas reloj acumuladas.
* **Problemática abordada:** Necesidad o desafío resuelto en la industria/comunidad.
* **Actividades realizadas:** Descripción de tareas ejecutadas por los practicantes.
* **Competencias desarrolladas:** Saberes técnicos y habilidades blandas consolidadas.
* **Resultados e impacto:** Indicadores de éxito (ej. prototipo desarrollado, inserción laboral).
* **Testimonio de estudiantes:** Citas de valoración del proceso formativo.
* **Testimonio de la empresa:** Declaración del tutor industrial o directivo.
* **Llamado a la Acción:** Botón destacado **`¿Querés replicar esta experiencia?`** que abre un formulario de contacto directo para que otras empresas o escuelas adopten el proyecto.

---

## 8. Perfiles de Usuarios y Matriz de Permisos (RBAC)

| Perfil | Descripción | Permisos / Accesos |
|---|---|---|
| **Visitante** | Público general, medios o empresas exploradoras | Búsqueda pública, lectura de normativa, mapa interactivo de Tucumán y casos exitosos. |
| **Estudiante** | Alumno de escuelas técnicas y agrotécnicas | Consulta de oferentes, descarga de bitácoras, guías y casos de éxito. |
| **Docente / Tutor** | Profesor a cargo del seguimiento | Acceso a instrumentos pedagógicos, planillas de evaluación y consulta de empresas. |
| **Escuela / Directivo** | Institución educativa de ETP de Tucumán | Gestión de perfil institucional, postulación de experiencias y vinculación con oferentes. |
| **Empresa / Oferente** | Entidad contraparte | Modificación de datos corporativos, actualización de cupos y manifiesto de interés. |
| **Administrador Provincial (DETyFP)** | Dirección de Educación Técnica y FP | Control total: altas/bajas, validación de convenios, moderación, estadísticas y auditoría. |

---

## 9. Formulario "Quiero ser Oferente" (Tucumán)

Herramienta estratégica para la captación activa de nuevas empresas y entidades en la provincia.

---

## 10. Panel de Administración y Estadísticas (DETyFP)

Centro de control para las autoridades de la Dirección de Educación Técnica y Formación Profesional del Ministerio de Educación de Tucumán.

* **Dashboard de Métricas:** Gráficos en tiempo real de convenios y prácticas en los 17 departamentos.
* **Gestor de Oferentes (ABM):** Alta, modificación, suspensión o validación de CUITs y convenios.
* **Gestor de Escuelas:** Nómina provincial de escuelas técnicas y agrotécnicas.
* **Bandeja de Entrada:** Revisión de solicitudes "Quiero ser oferente" y "Quiero publicar experiencia".

---

## 11. Conclusión y Concepto Central

El **Portal de Recursos de Prácticas Profesionalizantes** de la **Dirección de Educación Técnica y Formación Profesional del Ministerio de Educación de Tucumán** se constituye como un ecosistema digital dinámico y articulado:

$$\text{EMPRESAS TUCUMANAS} \longrightarrow \text{EXPERIENCIAS DESTACADAS} \longrightarrow \text{RECURSOS PEDAGÓGICOS}$$

De esta forma, el portal pasa a ser una **herramienta estratégica de gestión, vinculación institucional, comunicación y expansión de las Prácticas Profesionalizantes en la Provincia de Tucumán**.
