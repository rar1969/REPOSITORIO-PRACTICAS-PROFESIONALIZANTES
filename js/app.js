// ==========================================================================
// LÓGICA DE LA APLICACIÓN WEB INTERACTIVA (PORTAL MVP)
// DIRECCIÓN DE EDUCACIÓN TÉCNICA Y FORMACIÓN PROFESIONAL - PROVINCIA DE TUCUMÁN
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
  // Estado Global de la Aplicación
  const AppState = {
    currentRole: 'Visitante',
    activeView: 'inicio',
    theme: localStorage.getItem('portal_theme') || 'light',
    oferentesFilter: { search: '', especialidad: '', departamento: '', estado: '' },
    repoCategory: 'Todos',
    repoSearch: '',
    mapFilterMode: 'all', // 'all', 'escuelas', 'empresas'
    leafletMap: null,
    schoolMarkers: [],
    companyMarkers: [],
    uploadedFileObj: null
  };

  // Inicialización de Elementos DOM
  const elements = {
    roleSelect: document.getElementById('role-select'),
    themeToggleBtn: document.getElementById('theme-toggle-btn'),
    navBtns: document.querySelectorAll('.nav-btn'),
    views: document.querySelectorAll('.view-section'),
    
    // Contenedores
    gridOferentes: document.getElementById('grid-oferentes'),
    docList: document.getElementById('doc-list'),
    gridCasos: document.getElementById('grid-casos'),
    gridCapacitaciones: document.getElementById('grid-capacitaciones'),
    
    // Filtros
    inputSearchHero: document.getElementById('search-hero'),
    selectSpecHero: document.getElementById('spec-hero'),
    btnSearchHero: document.getElementById('btn-search-hero'),
    
    filterSearch: document.getElementById('filter-search'),
    filterSpec: document.getElementById('filter-spec'),
    filterDept: document.getElementById('filter-dept'),
    filterStatus: document.getElementById('filter-status'),
    btnResetFilters: document.getElementById('btn-reset-filters'),
    
    catChips: document.querySelectorAll('.cat-chip'),
    searchRepo: document.getElementById('search-repo'),
    
    // Admin
    navBtnAdmin: document.getElementById('nav-btn-admin'),
    adminQueueTable: document.getElementById('admin-queue-table'),
    adminSpecList: document.getElementById('admin-spec-list'),
    adminDocsTable: document.getElementById('admin-docs-table'),
    adminAlumnosTable: document.getElementById('admin-alumnos-table'),
    adminCapacitacionesWrapper: document.getElementById('admin-capacitaciones-table-wrapper'),
    formAddSpec: document.getElementById('form-add-spec'),
    newSpecName: document.getElementById('new-spec-name'),
    formEditSpec: document.getElementById('form-edit-spec'),
    editSpecIndex: document.getElementById('edit-spec-index'),
    editSpecName: document.getElementById('edit-spec-name'),
    formAddAlumno: document.getElementById('form-add-alumno'),
    selectAluEscuela: document.getElementById('alu-escuela'),
    
    adminTabMenu: document.querySelectorAll('[data-admin-tab]'),
    adminTabContents: document.querySelectorAll('.admin-tab-content'),
    adminOnlyElements: document.querySelectorAll('.admin-only-element'),
    
    kpiEmpresas: document.getElementById('kpi-empresas'),
    kpiEscuelas: document.getElementById('kpi-escuelas'),
    kpiEstudiantes: document.getElementById('kpi-estudiantes'),
    kpiCasos: document.getElementById('kpi-casos'),
    
    // Modales
    modalOferente: document.getElementById('modal-oferente'),
    modalExperiencia: document.getElementById('modal-experiencia'),
    modalReplica: document.getElementById('modal-replica'),
    modalDetalle: document.getElementById('modal-detalle'),
    modalSubirDoc: document.getElementById('modal-subir-doc'),
    modalEditarSpec: document.getElementById('modal-editar-spec'),
    modalAlumno: document.getElementById('modal-alumno'),
    closeModalBtns: document.querySelectorAll('.close-modal-btn'),
    
    formOferente: document.getElementById('form-oferente'),
    formExperiencia: document.getElementById('form-experiencia'),
    formReplica: document.getElementById('form-replica'),
    formSubirDoc: document.getElementById('form-subir-doc'),
    uploadDocFile: document.getElementById('upload-doc-file'),
    fileSelectedName: document.getElementById('file-selected-name')
  };

  // --------------------------------------------------------------------------
  // 1. GESTIÓN DE TEMA Y NAVEGACIÓN SPA
  // --------------------------------------------------------------------------
  
  function initTheme() {
    document.documentElement.setAttribute('data-theme', AppState.theme);
    updateThemeIcon();
  }

  function toggleTheme() {
    AppState.theme = AppState.theme === 'light' ? 'dark' : 'light';
    localStorage.setItem('portal_theme', AppState.theme);
    initTheme();
  }

  function updateThemeIcon() {
    if (elements.themeToggleBtn) {
      elements.themeToggleBtn.innerHTML = AppState.theme === 'dark' 
        ? '<i class="fas fa-sun"></i>' 
        : '<i class="fas fa-moon"></i>';
    }
  }

  function switchView(viewId) {
    AppState.activeView = viewId;
    elements.views.forEach(view => {
      if (view.id === `view-${viewId}`) {
        view.style.display = 'block';
      } else {
        view.style.display = 'none';
      }
    });

    elements.navBtns.forEach(btn => {
      if (btn.dataset.view === viewId) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    if (viewId === 'mapa') {
      setTimeout(() => initMap(), 150);
    }
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // --------------------------------------------------------------------------
  // 2. SISTEMA DE ROLES DE USUARIO Y PERMISOS ADMIN
  // --------------------------------------------------------------------------

  function handleRoleChange(newRole) {
    AppState.currentRole = newRole;
    const roleBadge = document.getElementById('active-role-display');
    if (roleBadge) {
      roleBadge.textContent = newRole;
    }

    const isAdmin = newRole === 'Administrador Provincial';

    if (elements.navBtnAdmin) {
      elements.navBtnAdmin.style.display = isAdmin ? 'flex' : 'none';
    }

    elements.adminOnlyElements.forEach(el => {
      el.style.display = isAdmin ? 'inline-flex' : 'none';
    });

    renderRepositorio();
    renderAdminPanel();

    if (!isAdmin && AppState.activeView === 'admin') {
      switchView('inicio');
    }

    showToast(`Rol activo: <strong>${newRole}</strong> ${isAdmin ? '(Gestión Completa Habilitada)' : ''}`, 'info');
  }

  // --------------------------------------------------------------------------
  // 3. POBLACIÓN Y EDICIÓN DE ESPECIALIDADES ETP
  // --------------------------------------------------------------------------

  function populateSpecialtyDropdowns() {
    const specSelects = document.querySelectorAll('.spec-select-dynamic');
    specSelects.forEach(select => {
      const currentValue = select.value;
      let html = `<option value="">Todas las Especialidades</option>`;
      window.PORTAL_DATA.especialidades.forEach(spec => {
        html += `<option value="${spec}">${spec}</option>`;
      });
      select.innerHTML = html;
      select.value = currentValue;
    });

    renderAdminSpecialtiesList();
  }

  function populateSchoolSelects() {
    if (!elements.selectAluEscuela) return;

    let html = `<option value="">Seleccionar Escuela de Tucumán...</option>`;
    window.PORTAL_DATA.escuelas.forEach(esc => {
      html += `<option value="${esc.nombre}">${esc.nombre} (${esc.localidad})</option>`;
    });
    elements.selectAluEscuela.innerHTML = html;
  }

  function renderAdminSpecialtiesList() {
    if (!elements.adminSpecList) return;

    elements.adminSpecList.innerHTML = window.PORTAL_DATA.especialidades.map((spec, index) => `
      <div class="spec-item-row">
        <span><i class="fas fa-microchip" style="color: var(--primary); margin-right: 0.5rem;"></i> <strong>${spec}</strong></span>
        <div>
          <button class="btn-action-sm btn-approve" onclick="window.openEditSpecialtyModal(${index})">
            <i class="fas fa-pen-to-square"></i> Editar
          </button>
          <button class="btn-action-sm btn-reject" onclick="window.deleteSpecialty(${index})">
            <i class="fas fa-trash"></i> Eliminar
          </button>
        </div>
      </div>
    `).join('');
  }

  window.openEditSpecialtyModal = function(index) {
    const specName = window.PORTAL_DATA.especialidades[index];
    if (elements.editSpecIndex) elements.editSpecIndex.value = index;
    if (elements.editSpecName) elements.editSpecName.value = specName;
    openModal(elements.modalEditarSpec);
  };

  if (elements.formEditSpec) {
    elements.formEditSpec.addEventListener('submit', (e) => {
      e.preventDefault();
      const index = parseInt(elements.editSpecIndex.value);
      const newName = elements.editSpecName.value.trim();

      if (!newName) return;

      const oldName = window.PORTAL_DATA.especialidades[index];
      window.PORTAL_DATA.especialidades[index] = newName;

      // Actualizar referencias en oferentes
      window.PORTAL_DATA.oferentes.forEach(o => {
        const i = o.especialidades.indexOf(oldName);
        if (i !== -1) o.especialidades[i] = newName;
      });

      populateSpecialtyDropdowns();
      renderOferentes();
      closeModal(elements.modalEditarSpec);
      showToast(`Especialidad renombra de <strong>"${oldName}"</strong> a <strong>"${newName}"</strong>.`, 'success');
    });
  }

  window.deleteSpecialty = function(index) {
    const deleted = window.PORTAL_DATA.especialidades.splice(index, 1);
    populateSpecialtyDropdowns();
    renderOferentes();
    showToast(`Especialidad <strong>"${deleted[0]}"</strong> eliminada.`, 'info');
  };

  if (elements.formAddSpec) {
    elements.formAddSpec.addEventListener('submit', (e) => {
      e.preventDefault();
      const newName = elements.newSpecName.value.trim();
      if (!newName) return;

      if (window.PORTAL_DATA.especialidades.includes(newName)) {
        showToast('Esta especialidad ya existe en el catálogo.', 'error');
        return;
      }

      window.PORTAL_DATA.especialidades.push(newName);
      elements.newSpecName.value = '';
      populateSpecialtyDropdowns();
      renderOferentes();
      showToast(`¡Nueva especialidad <strong>"${newName}"</strong> incorporada exitosamente!`, 'success');
    });
  }

  // --------------------------------------------------------------------------
  // 4. DIRECTORIO DE OFERENTES
  // --------------------------------------------------------------------------

  function renderOferentes() {
    if (!elements.gridOferentes) return;

    const filtered = window.PORTAL_DATA.oferentes.filter(item => {
      const matchSearch = !AppState.oferentesFilter.search || 
        item.razon_social.toLowerCase().includes(AppState.oferentesFilter.search.toLowerCase()) ||
        item.perfiles_requeridos.toLowerCase().includes(AppState.oferentesFilter.search.toLowerCase());

      const matchSpec = !AppState.oferentesFilter.especialidad || 
        item.especialidades.includes(AppState.oferentesFilter.especialidad);

      const matchDept = !AppState.oferentesFilter.departamento || 
        item.departamento === AppState.oferentesFilter.departamento;

      const matchStatus = !AppState.oferentesFilter.estado || 
        item.estado === AppState.oferentesFilter.estado;

      return matchSearch && matchSpec && matchDept && matchStatus;
    });

    if (filtered.length === 0) {
      elements.gridOferentes.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 3rem; background: var(--bg-card); border-radius: var(--radius-md); border: 1px dashed var(--border-color);">
          <i class="fas fa-building-circle-exclamation" style="font-size: 2.5rem; color: var(--text-muted); margin-bottom: 1rem;"></i>
          <h3>No se encontraron oferentes en Tucumán con los filtros seleccionados</h3>
          <p style="color: var(--text-muted);">Intenta seleccionar otro departamento o limpia los criterios de búsqueda.</p>
        </div>
      `;
      return;
    }

    elements.gridOferentes.innerHTML = filtered.map(item => `
      <div class="card-oferente">
        <div class="card-top">
          <span class="org-type-badge">${item.tipo_organizacion}</span>
          <span class="status-badge ${item.estado}">
            <i class="fas fa-circle" style="font-size: 0.5rem;"></i> Convenio ${item.convenio_vigente ? 'Vigente' : 'En trámite'}
          </span>
        </div>
        <div class="card-title">
          <h3>${item.razon_social}</h3>
          <div class="card-location">
            <i class="fas fa-location-dot"></i> ${item.localidad}, Dpto. ${item.departamento}
          </div>
        </div>
        <div class="specialties-tags">
          ${item.especialidades.map(spec => `<span class="tag-spec"><i class="fas fa-wrench" style="font-size: 0.65rem;"></i> ${spec}</span>`).join('')}
        </div>
        <div class="card-details">
          <span><i class="fas fa-users"></i> Vacantes: <strong class="cupos-highlight">${item.cupos_disponibles} cupos</strong></span>
          <span><i class="fas fa-calendar"></i> Act: ${item.fecha_actualizacion}</span>
        </div>
        <div class="card-actions">
          <button class="btn-card" onclick="window.viewOferenteDetail('${item.id}')">
            <i class="fas fa-circle-info"></i> Ver Ficha Completa
          </button>
        </div>
      </div>
    `).join('');
  }

  // --------------------------------------------------------------------------
  // 5. MAPA CARTOGRÁFICO DE LAS 38 ESCUELAS Y OFERENTES EN TUCUMÁN
  // --------------------------------------------------------------------------

  function initMap() {
    const mapContainer = document.getElementById('map-container');
    if (!mapContainer || AppState.leafletMap) return;

    AppState.leafletMap = L.map('map-container').setView([-26.9000, -65.3500], 9.5);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | DETyFP Tucumán'
    }).addTo(AppState.leafletMap);

    // 1. Iconos Personalizados para Escuelas y Empresas
    const schoolIcon = L.divIcon({
      className: 'custom-map-icon school-icon',
      html: `<div style="background: #0284c7; color: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1rem; box-shadow: 0 4px 8px rgba(0,0,0,0.3); border: 2px solid white;"><i class="fas fa-graduation-cap"></i></div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });

    const companyIcon = L.divIcon({
      className: 'custom-map-icon company-icon',
      html: `<div style="background: #0f172a; color: #38bdf8; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1rem; box-shadow: 0 4px 8px rgba(0,0,0,0.3); border: 2px solid #38bdf8;"><i class="fas fa-industry"></i></div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });

    // 2. Marcadores de las 38 Escuelas Técnicas y Agrotécnicas
    window.PORTAL_DATA.escuelas.forEach(esc => {
      const marker = L.marker([esc.lat, esc.lng], { icon: schoolIcon }).addTo(AppState.leafletMap);
      
      const popupContent = `
        <div style="font-family: var(--font-sans); padding: 0.2rem; max-width: 250px;">
          <span style="background: #e0f2fe; color: #0369a1; font-size: 0.7rem; font-weight: 700; padding: 0.2rem 0.5rem; border-radius: 4px; display: inline-block; margin-bottom: 0.3rem;">ESCUELA TÉCNICA ETP</span>
          <h4 style="margin-bottom: 0.25rem; font-size: 0.95rem; color: #0f172a; font-weight: 700;">${esc.nombre}</h4>
          <p style="margin-bottom: 0.4rem; font-size: 0.8rem; color: #475569;">
            <i class="fas fa-location-dot" style="color: #0284c7;"></i> ${esc.localidad} (Dpto. ${esc.departamento})<br>
            <i class="fas fa-barcode"></i> CUE: ${esc.cue}
          </p>
          <p style="font-size: 0.75rem; color: #334155; margin-bottom: 0.5rem;">
            <strong>Especialidades:</strong> ${esc.especialidades.join(', ')}<br>
            <strong>Matrícula Prácticas:</strong> ${esc.estudiantes} alumnos
          </p>
        </div>
      `;
      marker.bindPopup(popupContent);
      AppState.schoolMarkers.push(marker);
    });

    // 3. Marcadores de Empresas Oferentes
    window.PORTAL_DATA.oferentes.forEach(item => {
      const marker = L.marker([item.latitud, item.longitud], { icon: companyIcon }).addTo(AppState.leafletMap);
      
      const popupContent = `
        <div style="font-family: var(--font-sans); padding: 0.2rem; max-width: 250px;">
          <span style="background: #fef3c7; color: #d97706; font-size: 0.7rem; font-weight: 700; padding: 0.2rem 0.5rem; border-radius: 4px; display: inline-block; margin-bottom: 0.3rem;">EMPRESA OFERENTE</span>
          <h4 style="margin-bottom: 0.25rem; font-size: 0.95rem; color: #0f172a; font-weight: 700;">${item.razon_social}</h4>
          <p style="margin-bottom: 0.4rem; font-size: 0.8rem; color: #475569;">
            <i class="fas fa-location-dot"></i> ${item.localidad} (Dpto. ${item.departamento})<br>
            <i class="fas fa-briefcase"></i> ${item.especialidades.join(', ')}
          </p>
          <div style="background: #e0f2fe; color: #0369a1; padding: 0.25rem 0.5rem; border-radius: 4px; font-weight: 700; font-size: 0.75rem; margin-bottom: 0.5rem;">
            ${item.cupos_disponibles} Cupos Disponibles
          </div>
          <button onclick="window.viewOferenteDetail('${item.id}')" style="background: #0284c7; color: white; border: none; padding: 0.35rem 0.75rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600; cursor: pointer; width: 100%;">
            Ver Ficha Completa
          </button>
        </div>
      `;
      marker.bindPopup(popupContent);
      AppState.companyMarkers.push(marker);
    });
  }

  window.setMapFilter = function(mode) {
    AppState.mapFilterMode = mode;
    
    document.querySelectorAll('#map-filter-all, #map-filter-escuelas, #map-filter-empresas').forEach(b => b.classList.remove('active'));
    document.getElementById(`map-filter-${mode}`).classList.add('active');

    if (!AppState.leafletMap) return;

    AppState.schoolMarkers.forEach(m => {
      if (mode === 'all' || mode === 'escuelas') AppState.leafletMap.addLayer(m);
      else AppState.leafletMap.removeLayer(m);
    });

    AppState.companyMarkers.forEach(m => {
      if (mode === 'all' || mode === 'empresas') AppState.leafletMap.addLayer(m);
      else AppState.leafletMap.removeLayer(m);
    });
  };

  // --------------------------------------------------------------------------
  // 6. REPOSITORIO PEDAGÓGICO
  // --------------------------------------------------------------------------

  function renderRepositorio() {
    if (!elements.docList) return;

    const isAdmin = AppState.currentRole === 'Administrador Provincial';

    const filteredDocs = window.PORTAL_DATA.documentos.filter(doc => {
      const matchCat = AppState.repoCategory === 'Todos' || doc.categoria === AppState.repoCategory;
      const matchSearch = !AppState.repoSearch || 
        doc.titulo.toLowerCase().includes(AppState.repoSearch.toLowerCase()) ||
        doc.descripcion.toLowerCase().includes(AppState.repoSearch.toLowerCase());
      return matchCat && matchSearch;
    });

    if (filteredDocs.length === 0) {
      elements.docList.innerHTML = `
        <div style="text-align: center; padding: 3rem; background: var(--bg-card); border-radius: var(--radius-md); border: 1px dashed var(--border-color);">
          <i class="fas fa-folder-open" style="font-size: 2.5rem; color: var(--text-muted); margin-bottom: 1rem;"></i>
          <h3>No se encontraron documentos en esta categoría</h3>
          <p style="color: var(--text-muted);">Prueba seleccionar otra categoría o cambiar la palabra clave.</p>
        </div>
      `;
      return;
    }

    elements.docList.innerHTML = filteredDocs.map(doc => `
      <div class="doc-item">
        <div class="doc-icon ${doc.tipo_archivo.toLowerCase()}">
          <i class="fas fa-file-${doc.tipo_archivo.toLowerCase() === 'pdf' ? 'pdf' : doc.tipo_archivo.toLowerCase() === 'xlsx' ? 'excel' : 'word'}"></i>
        </div>
        <div class="doc-meta">
          <h4>${doc.titulo}</h4>
          <p>${doc.descripcion}</p>
          <div class="doc-tags">
            <span><i class="fas fa-tag"></i> ${doc.categoria}</span>
            <span><i class="fas fa-building-columns"></i> ${doc.organismo}</span>
            <span><i class="fas fa-clock"></i> v${doc.version} (${doc.fecha})</span>
            <span><i class="fas fa-download"></i> ${doc.descargas} descargas</span>
          </div>
        </div>
        <div style="display: flex; gap: 0.5rem; align-items: center;">
          <button class="doc-action-btn" onclick="window.downloadRealDocument('${doc.id}')">
            <i class="fas fa-download"></i> Descargar (${doc.tamaño})
          </button>
          ${isAdmin ? `
            <button class="doc-action-btn" style="background: rgba(239, 68, 68, 0.15); color: #ef4444;" onclick="window.deleteDocument('${doc.id}')" title="Eliminar documento del repositorio">
              <i class="fas fa-trash"></i> Eliminar
            </button>
          ` : ''}
        </div>
      </div>
    `).join('');
  }

  window.deleteDocument = function(docId) {
    const docIndex = window.PORTAL_DATA.documentos.findIndex(d => d.id === docId);
    if (docIndex !== -1) {
      const docName = window.PORTAL_DATA.documentos[docIndex].titulo;
      window.PORTAL_DATA.documentos.splice(docIndex, 1);
      renderRepositorio();
      renderAdminPanel();
      showToast(`Documento <strong>"${docName}"</strong> eliminado del repositorio.`, 'info');
    }
  };

  window.downloadRealDocument = function(docId) {
    const doc = window.PORTAL_DATA.documentos.find(d => d.id === docId);
    if (!doc) return;

    doc.descargas++;
    renderRepositorio();

    if (doc.fileUrl) {
      const a = document.createElement('a');
      a.href = doc.fileUrl;
      a.download = doc.fileName || `${doc.titulo}.${doc.tipo_archivo.toLowerCase()}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast(`Descargando archivo subido: <strong>${doc.titulo}</strong>`, 'success');
    } else {
      const content = `================================================================================\n` +
        `DIRECCIÓN DE EDUCACIÓN TÉCNICA Y FORMACIÓN PROFESIONAL\n` +
        `MINISTERIO DE EDUCACIÓN - GOBIERNO DE TUCUMÁN\n` +
        `================================================================================\n\n` +
        `DOCUMENTO OFICIAL: ${doc.titulo}\n` +
        `CATEGORÍA: ${doc.categoria}\n` +
        `ORGANISMO EMISOR: ${doc.organismo}\n` +
        `FECHA DE EMISIÓN: ${doc.fecha} | VERSIÓN: ${doc.version}\n` +
        `ESTADO: ${doc.estado}\n\n` +
        `DESCRIPCIÓN:\n${doc.descripcion}\n\n` +
        `--------------------------------------------------------------------------------\n` +
        `Este documento es un instrumento oficial del Portal de Prácticas Profesionalizantes.\n` +
        `Validez en todas las escuelas secundarias técnicas, agrotécnicas y empresas oferentes\n` +
        `de los 17 departamentos de la Provincia de Tucumán.\n` +
        `--------------------------------------------------------------------------------\n`;

      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${doc.titulo.replace(/[^a-zA-Z0-9]/g, '_')}_DETyFP.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast(`Descargando documento oficial: <strong>${doc.titulo}</strong>`, 'success');
    }
  };

  // --------------------------------------------------------------------------
  // 7. SITUACIÓN DE CAPACITACIONES EN ORGANISMOS PÚBLICOS Y PRIVADOS
  // --------------------------------------------------------------------------

  function renderCapacitaciones() {
    if (!elements.gridCapacitaciones) return;

    elements.gridCapacitaciones.innerHTML = window.PORTAL_DATA.capacitaciones.map(cap => `
      <div class="card-caso" style="padding: 1.5rem; justify-content: space-between;">
        <div>
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;">
            <span class="org-type-badge">${cap.tipo}</span>
            <span class="status-badge ${cap.estado === 'En Curso' ? 'active' : ''}">${cap.estado}</span>
          </div>
          <h3 style="font-size: 1.15rem; margin-bottom: 0.5rem; color: var(--primary);">${cap.titulo}</h3>
          <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.75rem;">
            <i class="fas fa-building-columns"></i> <strong>Impartido por:</strong> ${cap.organismo}
          </p>
          <p style="font-size: 0.85rem; margin-bottom: 0.5rem;">
            <i class="fas fa-users-gear"></i> <strong>Destinatarios:</strong> ${cap.destinatarios}
          </p>
          <p style="font-size: 0.85rem; margin-bottom: 0.75rem;">
            <i class="fas fa-location-dot"></i> <strong>Lugar:</strong> ${cap.lugar}
          </p>
        </div>
        <div style="border-top: 1px solid var(--border-color); padding-top: 0.75rem; display: flex; justify-content: space-between; font-size: 0.8rem; color: var(--text-muted);">
          <span><i class="fas fa-clock"></i> ${cap.horas_certificadas} Hs Certificadas</span>
          <span><i class="fas fa-user-check"></i> ${cap.participantes_inscritos} Inscriptos</span>
        </div>
      </div>
    `).join('');
  }

  // --------------------------------------------------------------------------
  // 8. PANEL DE ADMINISTRACIÓN Y NÓMINA DE ALUMNOS (DETyFP TUCUMÁN)
  // --------------------------------------------------------------------------

  function renderAdminPanel() {
    if (elements.kpiEmpresas) elements.kpiEmpresas.textContent = window.PORTAL_DATA.metricas.empresas_activas;
    if (elements.kpiEscuelas) elements.kpiEscuelas.textContent = window.PORTAL_DATA.escuelas.length;
    if (elements.kpiEstudiantes) elements.kpiEstudiantes.textContent = window.PORTAL_DATA.metricas.estudiantes_participantes;
    if (elements.kpiCasos) elements.kpiCasos.textContent = window.PORTAL_DATA.metricas.casos_exitosos_publicados;

    // Tabla 1: Solicitudes
    if (elements.adminQueueTable) {
      if (window.PORTAL_DATA.solicitudes.length === 0) {
        elements.adminQueueTable.innerHTML = `<tr><td colspan="6" style="text-align:center;">No hay solicitudes pendientes en la bandeja de entrada directiva.</td></tr>`;
      } else {
        elements.adminQueueTable.innerHTML = window.PORTAL_DATA.solicitudes.map(sol => `
          <tr>
            <td><strong>${sol.id}</strong></td>
            <td><span class="org-type-badge">${sol.tipo.toUpperCase()}</span></td>
            <td>${sol.titulo}<br><small style="color:var(--text-muted);">${sol.solicitante}</small></td>
            <td>${sol.departamento}</td>
            <td>${sol.fecha}</td>
            <td>
              <button class="btn-action-sm btn-approve" onclick="window.processSolicitud('${sol.id}', 'aprobar')"><i class="fas fa-check"></i> Aprobar</button>
              <button class="btn-action-sm btn-reject" onclick="window.processSolicitud('${sol.id}', 'rechazar')"><i class="fas fa-xmark"></i> Rechazar</button>
            </td>
          </tr>
        `).join('');
      }
    }

    // Tabla 2: Nómina de Alumnos por Escuela
    if (elements.adminAlumnosTable) {
      if (window.PORTAL_DATA.alumnos.length === 0) {
        elements.adminAlumnosTable.innerHTML = `<tr><td colspan="6" style="text-align:center;">No hay alumnos registrados en la nómina oficial.</td></tr>`;
      } else {
        elements.adminAlumnosTable.innerHTML = window.PORTAL_DATA.alumnos.map(alu => `
          <tr>
            <td><strong>${alu.dni}</strong></td>
            <td>${alu.nombre}<br><small style="color:var(--text-muted);">${alu.curso}</small></td>
            <td>${alu.escuela}</td>
            <td><span class="tag-spec">${alu.especialidad}</span></td>
            <td><span class="status-badge ${alu.estado === 'En Práctica' ? 'active' : ''}">${alu.estado}</span></td>
            <td>${alu.empresa || 'Por Asignar'}</td>
          </tr>
        `).join('');
      }
    }

    // Tabla 3: Carga y ABM Documental
    if (elements.adminDocsTable) {
      if (window.PORTAL_DATA.documentos.length === 0) {
        elements.adminDocsTable.innerHTML = `<tr><td colspan="5" style="text-align:center;">No hay documentos registrados en el repositorio.</td></tr>`;
      } else {
        elements.adminDocsTable.innerHTML = window.PORTAL_DATA.documentos.map(doc => `
          <tr>
            <td><strong>${doc.titulo}</strong></td>
            <td><span class="org-type-badge">${doc.categoria}</span></td>
            <td>${doc.tipo_archivo} (${doc.tamaño})</td>
            <td>${doc.fecha}</td>
            <td>
              <button class="btn-action-sm btn-reject" onclick="window.deleteDocument('${doc.id}')">
                <i class="fas fa-trash"></i> Eliminar
              </button>
            </td>
          </tr>
        `).join('');
      }
    }

    // Tabla 4: Situación de Capacitaciones en Panel Admin
    if (elements.adminCapacitacionesWrapper) {
      elements.adminCapacitacionesWrapper.innerHTML = `
        <table class="data-table">
          <thead>
            <tr>
              <th>Programa de Capacitación</th>
              <th>Organismo Oferente</th>
              <th>Tipo</th>
              <th>Hs Certificadas</th>
              <th>Inscriptos</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            ${window.PORTAL_DATA.capacitaciones.map(c => `
              <tr>
                <td><strong>${c.titulo}</strong></td>
                <td>${c.organismo}</td>
                <td><span class="org-type-badge">${c.tipo}</span></td>
                <td>${c.horas_certificadas} Hs</td>
                <td>${c.participantes_inscritos} Alumnos</td>
                <td><span class="status-badge ${c.estado === 'En Curso' ? 'active' : ''}">${c.estado}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }
  }

  // Formulario: Agregar Alumno a la Nómina
  if (elements.formAddAlumno) {
    elements.formAddAlumno.addEventListener('submit', (e) => {
      e.preventDefault();
      const nuevoAlumno = {
        id: `ALU-${Math.floor(100 + Math.random() * 900)}`,
        dni: document.getElementById('alu-dni').value,
        nombre: document.getElementById('alu-nombre').value,
        escuela: document.getElementById('alu-escuela').value,
        especialidad: document.getElementById('alu-spec').value,
        curso: document.getElementById('alu-curso').value || '7° Año',
        estado: document.getElementById('alu-estado').value,
        empresa: document.getElementById('alu-empresa').value || 'En trámite'
      };

      window.PORTAL_DATA.alumnos.unshift(nuevoAlumno);
      renderAdminPanel();
      closeModal(elements.modalAlumno);
      elements.formAddAlumno.reset();
      showToast(`¡Estudiante <strong>"${nuevoAlumno.nombre}"</strong> registrado en la nómina de prácticas!`, 'success');
    });
  }

  elements.adminTabMenu.forEach(item => {
    item.addEventListener('click', () => {
      elements.adminTabMenu.forEach(m => m.classList.remove('active'));
      item.classList.add('active');
      
      const tabTarget = item.dataset.adminTab;
      elements.adminTabContents.forEach(content => {
        if (content.id === `admin-tab-${tabTarget}`) {
          content.style.display = 'block';
        } else {
          content.style.display = 'none';
        }
      });
    });
  });

  // --------------------------------------------------------------------------
  // 9. ACCIONES DE MODALES Y HANDLERS
  // --------------------------------------------------------------------------

  window.viewOferenteDetail = function(id) {
    const oferente = window.PORTAL_DATA.oferentes.find(o => o.id === id);
    if (!oferente) return;

    const content = document.getElementById('modal-detalle-content');
    if (content) {
      content.innerHTML = `
        <div style="margin-bottom: 1.5rem;">
          <span class="org-type-badge" style="margin-bottom: 0.5rem; display: inline-block;">${oferente.tipo_organizacion}</span>
          <h2 style="font-size: 1.6rem; color: var(--primary);">${oferente.razon_social}</h2>
          <p style="color: var(--text-muted); font-weight: 500;"><i class="fas fa-id-card"></i> CUIT: ${oferente.cuit}</p>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem; background: var(--bg-main); padding: 1rem; border-radius: var(--radius-md);">
          <div>
            <strong><i class="fas fa-location-dot"></i> Ubicación:</strong><br>
            ${oferente.direccion}, ${oferente.localidad} (Dpto. ${oferente.departamento})
          </div>
          <div>
            <strong><i class="fas fa-user-tie"></i> Contacto Institucional:</strong><br>
            ${oferente.contacto_persona}<br>
            <a href="mailto:${oferente.correo}">${oferente.correo}</a>
          </div>
        </div>

        <div style="margin-bottom: 1.5rem;">
          <h4>Perfiles y Tareas Requeridas:</h4>
          <p style="color: var(--text-main); margin-top: 0.25rem;">${oferente.perfiles_requeridos}</p>
        </div>

        <div style="margin-bottom: 1.5rem;">
          <h4>Especialidades ETP Asociadas:</h4>
          <div class="specialties-tags" style="margin-top: 0.5rem;">
            ${oferente.especialidades.map(s => `<span class="tag-spec">${s}</span>`).join('')}
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; background: var(--primary-light); padding: 1rem; border-radius: var(--radius-md); color: var(--primary);">
          <div>
            <strong>Vacantes Activas: ${oferente.cupos_disponibles} cupos</strong><br>
            <small>Convenio vigente hasta ${oferente.fecha_vencimiento}</small>
          </div>
          <button class="btn-primary-action nav-btn" onclick="alert('Se ha registrado la solicitud de vinculación. La Dirección de ETP se contactará con el establecimiento.');">
            <i class="fas fa-paper-plane"></i> Solicitar Vinculación
          </button>
        </div>
      `;
      openModal(elements.modalDetalle);
    }
  };

  window.openReplicaModal = function(tituloCaso, escuela) {
    const casoInput = document.getElementById('replica-caso-nombre');
    if (casoInput) casoInput.value = `${tituloCaso} (${escuela})`;
    openModal(elements.modalReplica);
  };

  window.processSolicitud = function(id, accion) {
    window.PORTAL_DATA.solicitudes = window.PORTAL_DATA.solicitudes.filter(s => s.id !== id);
    renderAdminPanel();
    showToast(`Solicitud ${id} <strong>${accion === 'aprobar' ? 'APROBADA' : 'RECHAZADA'}</strong> en la Dirección de ETP Tucumán.`, accion === 'aprobar' ? 'success' : 'info');
  };

  function openModal(modal) {
    if (modal) modal.classList.add('active');
  }

  function closeModal(modal) {
    if (modal) modal.classList.remove('active');
  }

  elements.closeModalBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const modal = e.target.closest('.modal-backdrop');
      closeModal(modal);
    });
  });

  // --------------------------------------------------------------------------
  // 10. FORMULARIO SUBMISSIONS
  // --------------------------------------------------------------------------

  if (elements.formOferente) {
    elements.formOferente.addEventListener('submit', (e) => {
      e.preventDefault();
      const razonSocial = document.getElementById('oferente-razon').value;
      const departamento = document.getElementById('oferente-dept').value;
      const especialidad = document.getElementById('oferente-spec').value;

      const nuevaSolicitud = {
        id: `SOL-TUC-${Math.floor(100 + Math.random() * 900)}`,
        tipo: 'oferente',
        titulo: razonSocial,
        solicitante: document.getElementById('oferente-contacto').value,
        correo: document.getElementById('oferente-correo').value,
        departamento: departamento,
        especialidad: especialidad,
        fecha: new Date().toISOString().split('T')[0],
        estado: 'Pendiente',
        detalles: 'Solicitud enviada a la Dirección de ETP Tucumán.'
      };

      window.PORTAL_DATA.solicitudes.push(nuevaSolicitud);
      renderAdminPanel();

      closeModal(elements.modalOferente);
      elements.formOferente.reset();
      showToast('¡Solicitud enviada a la Dirección de ETP Tucumán! Pendiente de aprobación.', 'success');
    });
  }

  if (elements.formExperiencia) {
    elements.formExperiencia.addEventListener('submit', (e) => {
      e.preventDefault();
      const titulo = document.getElementById('exp-titulo').value;

      const nuevaSolicitud = {
        id: `SOL-TUC-${Math.floor(100 + Math.random() * 900)}`,
        tipo: 'experiencia',
        titulo: titulo,
        solicitante: document.getElementById('exp-escuela').value,
        correo: 'escuela@educacion.tucuman.gob.ar',
        departamento: 'Provincial',
        especialidad: document.getElementById('exp-spec').value,
        fecha: new Date().toISOString().split('T')[0],
        estado: 'Pendiente',
        detalles: 'Experiencia propuesta pendiente de revisión por la Supervisión ETP.'
      };

      window.PORTAL_DATA.solicitudes.push(nuevaSolicitud);
      renderAdminPanel();

      closeModal(elements.modalExperiencia);
      elements.formExperiencia.reset();
      showToast('¡Experiencia enviada a la Supervisión de ETP Tucumán con éxito!', 'success');
    });
  }

  if (elements.formReplica) {
    elements.formReplica.addEventListener('submit', (e) => {
      e.preventDefault();
      closeModal(elements.modalReplica);
      elements.formReplica.reset();
      showToast('Solicitud de réplica enviada a la Coordinación de Prácticas Profesionalizantes.', 'success');
    });
  }

  // --------------------------------------------------------------------------
  // 11. NOTIFICACIONES TOAST (FEEDBACK UI)
  // --------------------------------------------------------------------------

  function showToast(message, type = 'info') {
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'toast-container';
      toastContainer.style.cssText = `
        position: fixed; bottom: 1.5rem; right: 1.5rem; z-index: 9999;
        display: flex; flex-direction: column; gap: 0.5rem;
      `;
      document.body.appendChild(toastContainer);
    }

    const toast = document.createElement('div');
    const bg = type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#0284c7';
    toast.style.cssText = `
      background: ${bg}; color: white; padding: 0.85rem 1.25rem;
      border-radius: var(--radius-md); box-shadow: var(--shadow-md);
      font-size: 0.875rem; font-family: var(--font-sans);
      animation: slideIn 0.3s ease; display: flex; align-items: center; gap: 0.5rem;
    `;
    toast.innerHTML = `<i class="fas fa-info-circle"></i> <span>${message}</span>`;
    
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 4000);
  }

  // --------------------------------------------------------------------------
  // 12. EVENT LISTENERS
  // --------------------------------------------------------------------------

  if (elements.themeToggleBtn) {
    elements.themeToggleBtn.addEventListener('click', toggleTheme);
  }

  if (elements.roleSelect) {
    elements.roleSelect.addEventListener('change', (e) => handleRoleChange(e.target.value));
  }

  elements.navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const viewId = btn.dataset.view;
      if (viewId) switchView(viewId);
    });
  });

  document.querySelectorAll('[data-open-modal]').forEach(btn => {
    btn.addEventListener('click', () => {
      const modalId = btn.dataset.openModal;
      if (modalId === 'oferente') openModal(elements.modalOferente);
      if (modalId === 'experiencia') openModal(elements.modalExperiencia);
      if (modalId === 'subir-doc') openModal(elements.modalSubirDoc);
      if (modalId === 'alumno') openModal(elements.modalAlumno);
    });
  });

  if (elements.filterSearch) {
    elements.filterSearch.addEventListener('input', (e) => {
      AppState.oferentesFilter.search = e.target.value;
      renderOferentes();
    });
  }

  if (elements.filterSpec) {
    elements.filterSpec.addEventListener('change', (e) => {
      AppState.oferentesFilter.especialidad = e.target.value;
      renderOferentes();
    });
  }

  if (elements.filterDept) {
    elements.filterDept.addEventListener('change', (e) => {
      AppState.oferentesFilter.departamento = e.target.value;
      renderOferentes();
    });
  }

  if (elements.filterStatus) {
    elements.filterStatus.addEventListener('change', (e) => {
      AppState.oferentesFilter.estado = e.target.value;
      renderOferentes();
    });
  }

  if (elements.btnResetFilters) {
    elements.btnResetFilters.addEventListener('click', () => {
      AppState.oferentesFilter = { search: '', especialidad: '', departamento: '', estado: '' };
      if (elements.filterSearch) elements.filterSearch.value = '';
      if (elements.filterSpec) elements.filterSpec.value = '';
      if (elements.filterDept) elements.filterDept.value = '';
      if (elements.filterStatus) elements.filterStatus.value = '';
      renderOferentes();
    });
  }

  if (elements.btnSearchHero) {
    elements.btnSearchHero.addEventListener('click', () => {
      if (elements.inputSearchHero) AppState.oferentesFilter.search = elements.inputSearchHero.value;
      if (elements.selectSpecHero) AppState.oferentesFilter.especialidad = elements.selectSpecHero.value;
      if (elements.filterSearch) elements.filterSearch.value = AppState.oferentesFilter.search;
      if (elements.filterSpec) elements.filterSpec.value = AppState.oferentesFilter.especialidad;
      switchView('directorio');
      renderOferentes();
    });
  }

  elements.catChips.forEach(chip => {
    chip.addEventListener('click', () => {
      elements.catChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      AppState.repoCategory = chip.dataset.cat;
      renderRepositorio();
    });
  });

  if (elements.searchRepo) {
    elements.searchRepo.addEventListener('input', (e) => {
      AppState.repoSearch = e.target.value;
      renderRepositorio();
    });
  }

  // Inicialización
  initTheme();
  populateSpecialtyDropdowns();
  populateSchoolSelects();
  renderOferentes();
  renderRepositorio();
  renderAdminPanel();
});
