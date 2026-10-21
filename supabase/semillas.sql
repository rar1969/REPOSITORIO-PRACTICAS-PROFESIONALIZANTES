-- Generado por herramientas/semillas-sql.mjs — no editar a mano.
-- 2026-10-20
begin;

insert into public.departamentos (nombre) values
  ('Burruyacú'),
  ('Capital'),
  ('Chicligasta'),
  ('Cruz Alta'),
  ('Famaillá'),
  ('Graneros'),
  ('Juan Bautista Alberdi'),
  ('La Cocha'),
  ('Leales'),
  ('Lules'),
  ('Monteros'),
  ('Río Chico'),
  ('Simoca'),
  ('Tafí del Valle'),
  ('Tafí Viejo'),
  ('Trancas'),
  ('Yerba Buena')
on conflict (nombre) do nothing;

insert into public.especialidades (nombre, resolucion) values
  ('Automotores', 'Res. 511/5'),
  ('Electromecánica', 'Res. 1277/5'),
  ('Electrónica', 'Res. 510/5'),
  ('Gestión y Administración de las Organizaciones', 'Res. 50/5'),
  ('Indumentaria y Productos de Confeccion Textil', 'Res. 1372/5'),
  ('Industrias de Procesos', 'Res. 468/5'),
  ('Informática', 'Res. 467/5'),
  ('Maestro Mayor de Obras', 'Res. 1296/5'),
  ('Mecanización Agropecuaria', 'Res. 261/5'),
  ('Medio Ambiente', 'Res. 509/5'),
  ('Producción Agropecuaria', 'Res. 106/5'),
  ('Química', 'Res. 260/5'),
  ('Tecnología de los Alimentos', 'Res. 465/5'),
  ('Turismo', 'Res. 466/5')
on conflict (nombre) do update set
  resolucion = excluded.resolucion;

insert into public.escuelas (id, cue, nombre, tipo, localidad, municipio, departamento, direccion, lat, lng, precision, fuente_datos, especialidades, alumnos_por_especialidad, alumnos_7mo, circuito, supervisor, director, telefono, correo, verificado, observaciones) values
  ('ESC-01', '9000437', 'Escuela Agrotécnica Amaicha del Valle', 'agrotecnica', 'Amaicha del Valle', 'Comuna Rural Amaicha del Valle', 'Tafí del Valle', 'Ruta 307 - S/N°', -26.595247, -65.925392, 'domicilio', 'DETyFP · Oferta Educativa', array['Producción Agropecuaria']::text[], '{"Producción Agropecuaria":14}'::jsonb, 14, 'Circuito IV', '', 'Prof. Fidel Daniel Suarez a Cargo', '', 'agrotecnicaamaicha@yahoo.com.ar', false, default),
  ('ESC-02', '9000997', 'Escuela Agrotécnica Amalia Hernández de Castillo', 'agrotecnica', 'Estación Aráoz', 'Comuna Rural Estación Aráoz y Tacanas', 'Leales', 'Ruta 327 - Km 45', -27.054579, -64.915613, 'domicilio', 'DETyFP · Oferta Educativa', array['Producción Agropecuaria']::text[], '{"Producción Agropecuaria":26}'::jsonb, 26, 'Circuito I', '', 'Porf. Marcelo Sánchez', '3814986666', 'agrotecnicaestaraoz@yahoo.com.ar', false, default),
  ('ESC-03', '9001770', 'Escuela Agrotécnica Gastona Sud', 'agrotecnica', 'Gastona Sud', 'Comuna Rural Gastona Sud', 'Chicligasta', 'Ruta 328 - Km 8,5', -27.351792, -65.500105, 'domicilio', 'DETyFP · Oferta Educativa', array['Producción Agropecuaria']::text[], '{"Producción Agropecuaria":11}'::jsonb, 11, 'Circuito V', '', 'Prof. Roberto López', '', 'agrotecgastonasud@gmail.com', false, default),
  ('ESC-04', '9001884', 'Escuela Agrotécnica Ing. Agr. Jorge Palacios', 'agrotecnica', 'Famaillá', 'Municipalidad Famaillá', 'Famaillá', 'Monseñor Ferro S/N° - Santa Clara', -27.054116, -65.386651, 'domicilio', 'DETyFP · Oferta Educativa', array['Producción Agropecuaria', 'Mecanización Agropecuaria']::text[], '{"Producción Agropecuaria":32,"Mecanización Agropecuaria":0}'::jsonb, 32, 'Circuito IV', '', 'Prof. Florencia Benimeli', '', 'agrotecnicafamailla@yahoo.com.ar', false, default),
  ('ESC-05', '9001934', 'Escuela Agrotécnica Ing. Agr. Ludovico Tusek', 'agrotecnica', 'Concepción', 'Municipalidad Concepción', 'Chicligasta', 'Ruta 65 - Km 2,5', -27.34901, -65.615124, 'domicilio', 'DETyFP · Oferta Educativa', array['Producción Agropecuaria']::text[], '{"Producción Agropecuaria":16}'::jsonb, 16, 'Circuito V', '', 'Ing. Luciana Amani', '3865405655', 'escuelaagrotecnicaludovicotuse@gmail.com', false, default),
  ('ESC-06', '9001657', 'Escuela Agrotécnica Ing. Agr. Roberto Falci', 'agrotecnica', 'Santa Cruz', 'Municipalidad Tafí del Valle', 'Tafí del Valle', 'Ruta 325 - Km 9,5', -26.888736, -65.761898, 'domicilio', 'DETyFP · Oferta Educativa', array['Producción Agropecuaria']::text[], '{"Producción Agropecuaria":11}'::jsonb, 11, 'Circuito IV', '', 'Ing. Agr. Carlos Mercado', '3865628535', 'ceptafi@yahoo.com.ar', false, default),
  ('ESC-07', '9000956', 'Escuela Agrotécnica Juan B. Alberdi', 'agrotecnica', 'Marapa', 'Comuna Rural Marapa', 'Juan Bautista Alberdi', 'Ruta 308 - Km 2', -27.596957, -65.63183, 'domicilio', 'DETyFP · Oferta Educativa', array['Producción Agropecuaria', 'Mecanización Agropecuaria']::text[], '{"Producción Agropecuaria":23,"Mecanización Agropecuaria":15}'::jsonb, 38, 'Circuito V', '', 'Juan Ignacio Cambule', '3865540825', 'agrotecnicaalberdi@yahoo.com.ar', false, default),
  ('ESC-08', '9000469', 'Escuela Agrotécnica Juan Mantovani', 'agrotecnica', 'Santa Ana', 'Comuna Rural Santa Ana', 'Río Chico', 'Eva Perón S/N° - Camino Vecinal A Lote N° 17', -27.472679, -65.688749, 'domicilio', 'DETyFP · Oferta Educativa', array['Producción Agropecuaria']::text[], '{"Producción Agropecuaria":50}'::jsonb, 50, 'Circuito V', '', 'Ing. Agr. Mónica Hael', '3865557312', 'agrotecnicasantana@gmail.com', false, default),
  ('ESC-09', '9002199', 'Escuela Agrotécnica Los Pizarros', 'agrotecnica', 'Los Pizarros', 'Comuna Rural los Pizarros', 'La Cocha', '2 de Abril S/N° y Pasaje María Auxiliadora', -27.748059, -65.634699, 'domicilio', 'DETyFP · Oferta Educativa', array['Producción Agropecuaria']::text[], '{"Producción Agropecuaria":29}'::jsonb, 29, 'Circuito V', '', 'Prof. Daniel Córdoba', '', 'agrotecnicalospizarros@yahoo.com.ar', false, default),
  ('ESC-10', '9000054', 'Escuela Agrotécnica Los Sarmiento', 'agrotecnica', 'Los Sarmiento', 'Comuna Rural los Sarmiento', 'Río Chico', '9 de Julio S/N°', -27.412032, -65.69061, 'domicilio', 'DETyFP · Oferta Educativa', array['Producción Agropecuaria']::text[], '{"Producción Agropecuaria":27}'::jsonb, 27, 'Circuito V', '', 'Prof. Gonzalez', 'NO TIENE', 'agrotecnicalosarmiento@yahoo.com.ar', false, default),
  ('ESC-11', '9000634', 'Escuela Agrotécnica Mariano Ramos', 'agrotecnica', 'La Ramada', 'Comuna Rural la Ramada', 'Burruyacú', '24 de Septiembre S/N°', -26.687221, -64.946104, 'domicilio', 'DETyFP · Oferta Educativa', array['Producción Agropecuaria']::text[], '{"Producción Agropecuaria":9}'::jsonb, 9, 'Circuito I', '', 'Prof. Orse Paula', '', 'agrotecnicaburruyacu@yahoo.com.ar', false, default),
  ('ESC-12', '9000949', 'Escuela Agrotécnica Miguel A. Torres', 'agrotecnica', 'Tafí del Valle', 'Municipalidad Tafí del Valle', 'Tafí del Valle', 'Avenida General José de San Martín S/N°', -26.849763, -65.71057, 'domicilio', 'DETyFP · Oferta Educativa', array['Producción Agropecuaria', 'Turismo']::text[], '{"Producción Agropecuaria":36,"Turismo":16}'::jsonb, 52, 'Circuito IV', '', 'Prof Enrique Pastrana', '', 'agrotecnicatafidelvalle@yahoo.com.ar', false, default),
  ('ESC-13', '9002098', 'Escuela Agrotécnica Simoca', 'agrotecnica', 'Simoca', 'Municipalidad Simoca', 'Simoca', 'Belgrano S/N°', -27.268062, -65.359909, 'domicilio', 'DETyFP · Oferta Educativa', array['Producción Agropecuaria']::text[], '{"Producción Agropecuaria":35}'::jsonb, 35, 'Circuito IV', '', 'Prof. David Rodriguez', '', 'agrotecnicasimoca@gmail.com', false, default),
  ('ESC-14', '9000868', 'Escuela Agrotécnica Soldado Cajal', 'agrotecnica', 'Las Cejas', 'Comuna Rural las Cejas', 'Cruz Alta', 'Ruta 303 - Km 45', -26.828635, -64.765566, 'domicilio', 'DETyFP · Oferta Educativa', array['Producción Agropecuaria']::text[], '{"Producción Agropecuaria":16}'::jsonb, 16, 'Circuito I', '', 'Prof. Hector A. Roldan', '', 'agrotecnicalascejas@yahoo.com.ar', false, default),
  ('ESC-15', '9002510', 'Escuela Agrotécnica Trancas', 'agrotecnica', 'Trancas', 'Muncipalidad Trancas', 'Trancas', 'Lola Mora y Juan B. Justo', -26.237926, -65.276008, 'domicilio', 'DETyFP · Oferta Educativa', array['Producción Agropecuaria']::text[], '{"Producción Agropecuaria":0}'::jsonb, 0, 'Circuito III', '', '', '', '', false, default),
  ('ESC-16', '9000742', 'Escuela Técnica Crucero ARA Gral. Belgrano', 'tecnica', 'Famaillá', 'Municipalidad Famaillá', 'Famaillá', 'Ruta 301 - Km 36 - Barrio Cabildo', -27.049783, -65.392791, 'domicilio', 'DETyFP · Oferta Educativa', array['Maestro Mayor de Obras', 'Informática']::text[], '{"Maestro Mayor de Obras":41,"Informática":25}'::jsonb, 66, 'Circuito IV', '', 'Prof. Héctor Hugo Correa', '', 'esc_tecnica@yahoo.com.ar', false, default),
  ('ESC-17', '9001729', 'Escuela Técnica El Mollar', 'tecnica', 'El Mollar', 'Comuna Rural el Mollar', 'Tafí del Valle', 'Calle S/N° - Barrio el Lago', -26.935257, -65.706512, 'domicilio', 'DETyFP · Oferta Educativa', array['Maestro Mayor de Obras']::text[], '{"Maestro Mayor de Obras":11}'::jsonb, 11, 'Circuito IV', '', 'Profe. Liliana Sisini', '', 'escuelatecnicaelmollar@gmail.com', false, default),
  ('ESC-18', '9000341', 'Escuela Técnica N° 1 Aguilares', 'tecnica', 'Aguilares', 'Municipalidad Aguilares', 'Río Chico', 'Velez Sarfield N° 1200', -27.430539, -65.620597, 'domicilio', 'DETyFP · Oferta Educativa', array['Electromecánica', 'Indumentaria y Productos de Confeccion Textil', 'Industrias de Procesos']::text[], '{"Electromecánica":7,"Indumentaria y Productos de Confeccion Textil":7,"Industrias de Procesos":18}'::jsonb, 32, 'Circuito V', '', 'DIRECTOR (LICENCIA) VAZQUEZ JOSE VICE A CARGO DIRECCION ING ARAOZ', '', 'enet_1aguilares@yahoo.com.ar', false, default),
  ('ESC-19', '9000087', 'Escuela Técnica N° 1 Bella Vista', 'tecnica', 'Bella Vista', 'Municipalidad Bella Vista', 'Leales', 'Mariano Moreno N° 35', -27.02815, -65.308172, 'domicilio', 'DETyFP · Oferta Educativa', array['Electromecánica', 'Maestro Mayor de Obras', 'Automotores']::text[], '{"Electromecánica":29,"Maestro Mayor de Obras":24,"Automotores":5}'::jsonb, 58, 'Circuito I', '', 'Conrado Salto', '', 'tecnicabellavista@yahoo.com.ar', false, default),
  ('ESC-20', '9000651', 'Escuela Técnica N° 1 Concepción', 'tecnica', 'Concepción', 'Municipalidad Concepción', 'Chicligasta', 'Nasif Estefano y Stewart Shipton', -27.347609, -65.594386, 'domicilio', 'DETyFP · Oferta Educativa', array['Electromecánica', 'Maestro Mayor de Obras']::text[], '{"Electromecánica":56,"Maestro Mayor de Obras":68}'::jsonb, 124, 'Circuito V', '', 'Prof. Favio Torres - Jefe de Taller a Cargo Direccion', '', 'escuelatecnicaconcepcion@yahoo.com.ar', false, default),
  ('ESC-21', '9001835', 'Escuela Técnica N° 1 Hilda Guerrero de Molina', 'tecnica', 'Santa Lucia', 'Comuna Rural Santa Lucia', 'Monteros', 'José Hernández S/N°', -27.094353, -65.539552, 'domicilio', 'DETyFP · Oferta Educativa', array['Electromecánica', 'Informática']::text[], '{"Electromecánica":21,"Informática":12}'::jsonb, 33, 'Circuito IV', '', 'Prof. Lino Fabian Salazar', '', 'esctecnicasantalucia@yahoo.com.ar', false, default),
  ('ESC-22', '9000614', 'Escuela Técnica N° 1 Independencia Argentina', 'tecnica', 'San Miguel de Tucumán', 'Municipalidad San Miguel de Tucumán', 'Capital', 'Crisóstomo Álvarez N° 746', -26.831389, -65.208671, 'domicilio', 'DETyFP · Oferta Educativa', array['Gestión y Administración de las Organizaciones', 'Informática']::text[], '{"Gestión y Administración de las Organizaciones":52,"Informática":31}'::jsonb, 83, 'Circuito II', '', 'Ing.Claudio Fernández', '', 'enetindarg@gmail.com.ar', false, default),
  ('ESC-23', '9000835', 'Escuela Técnica N° 1 Ing. Antonio María Correa', 'tecnica', 'Delfin Gallo', 'Comuna Rural Delfin Gallo', 'Cruz Alta', 'Ruta 303 - Km 12', -26.853223, -65.092056, 'domicilio', 'DETyFP · Oferta Educativa', array['Electromecánica', 'Gestión y Administración de las Organizaciones']::text[], '{"Electromecánica":26,"Gestión y Administración de las Organizaciones":19}'::jsonb, 45, 'Circuito I', '', 'Prof. Isabel Castillo jefa de taller a cargo de la dirección', '', 'etecorrea@yahoo.com.ar', false, default),
  ('ESC-24', '9000139', 'Escuela Técnica N° 1 Juan B. Alberdi', 'tecnica', 'Juan Bautista Alberdi', 'Municipalidad Juan Bautista Alberdi', 'Juan Bautista Alberdi', 'Catamarca N° 500', -27.594069, -65.622015, 'domicilio', 'DETyFP · Oferta Educativa', array['Electromecánica', 'Informática']::text[], '{"Electromecánica":0,"Informática":0}'::jsonb, 0, 'Circuito V', 'PROF. IGNACIO RODRIGUEZ', 'Ing. Alberto Victoria', '3865472926', 'tecnica1jba@gmail.com', false, default),
  ('ESC-25', '9000690', 'Escuela Técnica N° 1 La Cocha', 'tecnica', 'La Cocha', 'Municipalidad la Cocha', 'La Cocha', 'Avenida Belgrano y Juan Bautista Alberdi', -27.774217, -65.586097, 'domicilio', 'DETyFP · Oferta Educativa', array['Gestión y Administración de las Organizaciones', 'Maestro Mayor de Obras', 'Turismo']::text[], '{"Gestión y Administración de las Organizaciones":28,"Maestro Mayor de Obras":28,"Turismo":14}'::jsonb, 70, 'Circuito V', '', 'Prof. Ana Herrera', 'NO TIENE', 'tecnicalacocha@yahoo.com.ar', false, default),
  ('ESC-26', '9000864', 'Escuela Técnica N° 1 Lastenia', 'tecnica', 'Lastenia', 'Municipalidad Banda del Río Salí', 'Cruz Alta', '17 de Agosto N° 640', -26.865351, -65.161195, 'domicilio', 'DETyFP · Oferta Educativa', array['Electromecánica', 'Medio Ambiente']::text[], '{"Electromecánica":20,"Medio Ambiente":11}'::jsonb, 31, 'Circuito I', '', 'Prof. Marcelo Salina', '', 'tecnicalastenia@yahoo.com.ar', false, default),
  ('ESC-27', '9000392', 'Escuela Técnica N° 1 Lules', 'tecnica', 'San Isidro de Lules', 'Municipalidad Lules', 'Lules', 'Teniente Auviex y Pasaje Mendoza', -26.929076, -65.336368, 'domicilio', 'DETyFP · Oferta Educativa', array['Electromecánica', 'Electrónica', 'Química']::text[], '{"Electromecánica":0,"Electrónica":0,"Química":0}'::jsonb, 0, 'Circuito III', '', 'Prof. Picco Roque - Jefe de Taller a cargo de la Direccion', '3814811590', 'tecnica1_lules@yahoo.com.ar', false, default),
  ('ESC-28', '9000475', 'Escuela Técnica N° 1 Monteros', 'tecnica', 'Monteros', 'Municipalidad Monteros', 'Monteros', 'Italia Esquina Perú', -27.169731, -65.490317, 'domicilio', 'DETyFP · Oferta Educativa', array['Electromecánica', 'Informática']::text[], '{"Electromecánica":50,"Informática":52}'::jsonb, 102, 'Circuito IV', '', 'Prof. Leonardo Ovejero', '', 'tecnicademonteros@yahoo.com.ar', false, default),
  ('ESC-29', '9000834', 'Escuela Técnica N° 1 Rafael Marino', 'tecnica', 'Tafi Viejo', 'Municipalidad Tafi Viejo', 'Tafí Viejo', 'Uttinger N° 856', -26.730141, -65.266814, 'domicilio', 'DETyFP · Oferta Educativa', array['Electromecánica', 'Electrónica']::text[], '{"Electromecánica":81,"Electrónica":26}'::jsonb, 107, 'Circuito III', '', 'Prof. Figueroa Fabian', '', 'tecnicatafi@yahoo.com.ar tecnica1rafaelmarino@gmail.com', false, default),
  ('ESC-30', '9001006', 'Escuela Técnica N° 1 Ranchillos', 'tecnica', 'Ranchillos', 'Comuna Rural Ranchillos y San Miguel', 'Cruz Alta', 'Avenida Solano Peña S/N° Altura Ruta 302, Km 25', -26.957208, -65.046101, 'domicilio', 'DETyFP · Oferta Educativa', array['Electromecánica', 'Informática', 'Gestión y Administración de las Organizaciones']::text[], '{"Electromecánica":14,"Informática":13,"Gestión y Administración de las Organizaciones":42}'::jsonb, 69, 'Circuito I', '', 'Prof. Facundo Rodriguez', '', 'tecnicaranchillos@yahoo.com.ar', false, default),
  ('ESC-31', '9000894', 'Escuela Técnica N° 1 Río Seco', 'tecnica', 'Río Seco', 'Comuna Rural Río Seco', 'Monteros', 'Avenida Himno Patrio S/N°', -27.275744, -65.562198, 'domicilio', 'DETyFP · Oferta Educativa', array['Electrónica', 'Industrias de Procesos']::text[], '{"Electrónica":28,"Industrias de Procesos":18}'::jsonb, 46, 'Circuito IV', '', 'Ing. Sara Hael', '', 'esmichars@yahoo.com.ar', false, default),
  ('ESC-32', '9000655', 'Escuela Técnica N° 1 Trancas', 'tecnica', 'Villa de Trancas', 'Municipalidad Trancas', 'Trancas', 'Ex Ruta 9 - Km 4', -26.237994, -65.274324, 'domicilio', 'DETyFP · Oferta Educativa', array['Mecanización Agropecuaria', 'Gestión y Administración de las Organizaciones']::text[], '{"Mecanización Agropecuaria":40,"Gestión y Administración de las Organizaciones":13}'::jsonb, 53, 'Circuito III', '', 'Prof. Juan Flores', '', 'tecnica_trancas@yahoo.com.ar', false, default),
  ('ESC-33', '9000668', 'Escuela Técnica N° 1 Villa de Leales', 'tecnica', 'Villa de Leales', 'Comuna Rural Villa de Leales', 'Leales', 'Joaquín Brizuela y Venecia', -27.191683, -65.310634, 'domicilio', 'DETyFP · Oferta Educativa', array['Electromecánica', 'Gestión y Administración de las Organizaciones']::text[], '{"Electromecánica":21,"Gestión y Administración de las Organizaciones":18}'::jsonb, 39, 'Circuito I', '', 'Prof. Héctor Miguel Severo', '', 'tecnicavillaleales@gmail.com', false, default),
  ('ESC-34', '9000552', 'Escuela Técnica N° 2 Obispo Colombres', 'tecnica', 'San Miguel de Tucumán', 'Municipalidad San Miguel de Tucumán', 'Capital', 'Domingo Garcia N° 47', -26.836581, -65.197635, 'domicilio', 'DETyFP · Oferta Educativa', array['Electromecánica', 'Automotores', 'Electrónica']::text[], '{"Electromecánica":65,"Automotores":46,"Electrónica":56}'::jsonb, 167, 'Circuito II', '', 'Elias Juarez - Regente a Cargo', '', 'tecnica2obispocolombres@gmail.com', false, default),
  ('ESC-35', '9002046', 'Escuela Técnica N° 2 Tafí Viejo Lomas de Tafí', 'tecnica', 'Lomas de Tafí', 'Municipalidad Tafi Viejo', 'Tafí Viejo', 'Juan Valdéz N° 150', -26.783403, -65.244737, 'domicilio', 'DETyFP · Oferta Educativa', array['Tecnología de los Alimentos']::text[], '{"Tecnología de los Alimentos":24}'::jsonb, 24, 'Circuito III', '', 'profe Bruno Ruiz', '', 'tecnica2lomas@yahoo.com.ar', false, default),
  ('ESC-36', '9000805', 'Escuela Técnica N° 3 Juan B. Terán', 'tecnica', 'San Miguel de Tucumán', 'Municipalidad San Miguel de Tucumán', 'Capital', 'Avenida Bartolomé Mitre N° 746', -26.817777, -65.216262, 'domicilio', 'DETyFP · Oferta Educativa', array['Electromecánica', 'Maestro Mayor de Obras']::text[], '{"Electromecánica":79,"Maestro Mayor de Obras":37}'::jsonb, 116, 'Circuito II', '', 'Prof. Miguel Garrido', '', 'etec_juanbteran@yahoo.com.ar', false, default),
  ('ESC-37', '9001774', 'Escuela Técnica N° 4 Juan XXIII', 'tecnica', 'San Miguel de Tucumán', 'Municipalidad San Miguel de Tucumán', 'Capital', 'Bolivia N° 220', -26.807163, -65.226513, 'domicilio', 'DETyFP · Oferta Educativa', array['Informática']::text[], '{"Informática":6}'::jsonb, 6, 'Circuito II', '', 'Prof. Manuel Romano', '', 'escuela@tecnica4tucuman.edu.ar', false, default),
  ('ESC-38', '9000380', 'Escuela Técnica N° 5', 'tecnica', 'San Miguel de Tucumán', 'Municipalidad San Miguel de Tucumán', 'Capital', 'Patricias Argentinas N° 383', -26.815117, -65.25529, 'domicilio', 'DETyFP · Oferta Educativa', array['Electromecánica', 'Maestro Mayor de Obras', 'Informática']::text[], '{"Electromecánica":23,"Maestro Mayor de Obras":13,"Informática":51}'::jsonb, 87, 'Circuito II', '', 'Prof. Cristhian Romano', '', 'tecnica5capital@yahoo.com.ar', false, default),
  ('ESC-39', '', 'Escuela Agrotécnica N° 1 de Monteros', 'agrotecnica', 'Monteros', '', 'Monteros', 'España 698', -27.169113, -65.501803, 'localidad', 'edificio de la Escuela Ibatín (padrón nacional)', array['Producción Agropecuaria']::text[], '{}'::jsonb, null, 'Circuito IV', '', '', '', '', false, 'Creación reciente, no figura en la Oferta Educativa. Funciona en dependencias de la Escuela Ibatín (CUE 9000515); dirección y coordenada tomadas de ese edificio. Falta el CUE propio y la matrícula.')
on conflict (id) do update set
  cue = excluded.cue,
  nombre = excluded.nombre,
  tipo = excluded.tipo,
  localidad = excluded.localidad,
  municipio = excluded.municipio,
  departamento = excluded.departamento,
  direccion = excluded.direccion,
  lat = excluded.lat,
  lng = excluded.lng,
  precision = excluded.precision,
  fuente_datos = excluded.fuente_datos,
  especialidades = excluded.especialidades,
  alumnos_por_especialidad = excluded.alumnos_por_especialidad,
  alumnos_7mo = excluded.alumnos_7mo,
  circuito = excluded.circuito,
  supervisor = excluded.supervisor,
  director = excluded.director,
  telefono = excluded.telefono,
  correo = excluded.correo,
  verificado = excluded.verificado,
  observaciones = excluded.observaciones;

insert into public.oferentes (id, razon_social, cuit, tipo_organizacion, departamento, localidad, direccion, latitud, longitud, telefono, correo, sitio_web, contacto_persona, especialidades, perfiles_requeridos, escuelas_vinculadas, convenio_vigente, fecha_inicio, fecha_vencimiento, cupos_disponibles, tipo_practica, estado, observaciones, fecha_actualizacion, ejemplo) values
  ('OFER-TUC-001', 'Metalmecánica Ejemplo S.R.L.', '', 'PyME', 'Cruz Alta', 'Banda del Río Salí', '', -26.8445, -65.169, '', 'practicas@ejemplo.com', '', 'Responsable de RR. HH. (ejemplo)', array['Electromecánica', 'Automotores']::text[], 'Mantenimiento preventivo de máquinas herramienta, tornería y control dimensional de piezas.', '{}'::text[], true, '2026-03-01', '2027-12-31', 6, 'Presencial', 'activo', 'Registro de ejemplo para mostrar cómo funciona el portal. No corresponde a una empresa, escuela ni convenio real.', '2026-10-20', true),
  ('OFER-TUC-002', 'Citrícola Ejemplo S.A.', '', 'Empresa Privada', 'Famaillá', 'Famaillá', '', -27.056, -65.403, '', 'vinculacion@ejemplo.com', '', 'Jefatura de planta (ejemplo)', array['Producción Agropecuaria', 'Industrias de Procesos', 'Tecnología de los Alimentos']::text[], 'Control de calidad en línea de empaque, análisis de jugos y muestreo en finca.', '{}'::text[], true, '2026-04-15', '2027-04-15', 8, 'Presencial', 'activo', 'Registro de ejemplo para mostrar cómo funciona el portal. No corresponde a una empresa, escuela ni convenio real.', '2026-10-20', true),
  ('OFER-TUC-003', 'Cooperativa de Software Ejemplo', '', 'Cooperativa', 'Capital', 'San Miguel de Tucumán', '', -26.83, -65.205, '', 'talento@ejemplo.com', '', 'Coordinación de proyectos (ejemplo)', array['Informática', 'Electrónica']::text[], 'Desarrollo web, pruebas de software y prototipos con microcontroladores.', '{}'::text[], true, '2026-05-01', '2027-05-01', 10, 'Semipresencial', 'activo', 'Registro de ejemplo para mostrar cómo funciona el portal. No corresponde a una empresa, escuela ni convenio real.', '2026-10-20', true),
  ('OFER-TUC-004', 'Municipio de Ejemplo — Área de Obras', '', 'Organismo Público', 'Monteros', 'Monteros', '', -27.169, -65.498, '', 'obras@ejemplo.com', '', 'Dirección de Obras (ejemplo)', array['Maestro Mayor de Obras', 'Medio Ambiente']::text[], 'Relevamiento de obras públicas, cómputo de materiales y monitoreo ambiental.', '{}'::text[], false, null, null, 4, 'Presencial', 'revision', 'Registro de ejemplo para mostrar cómo funciona el portal. No corresponde a una empresa, escuela ni convenio real.', '2026-10-20', true)
on conflict (id) do update set
  razon_social = excluded.razon_social,
  cuit = excluded.cuit,
  tipo_organizacion = excluded.tipo_organizacion,
  departamento = excluded.departamento,
  localidad = excluded.localidad,
  direccion = excluded.direccion,
  latitud = excluded.latitud,
  longitud = excluded.longitud,
  telefono = excluded.telefono,
  correo = excluded.correo,
  sitio_web = excluded.sitio_web,
  contacto_persona = excluded.contacto_persona,
  especialidades = excluded.especialidades,
  perfiles_requeridos = excluded.perfiles_requeridos,
  escuelas_vinculadas = excluded.escuelas_vinculadas,
  convenio_vigente = excluded.convenio_vigente,
  fecha_inicio = excluded.fecha_inicio,
  fecha_vencimiento = excluded.fecha_vencimiento,
  cupos_disponibles = excluded.cupos_disponibles,
  tipo_practica = excluded.tipo_practica,
  estado = excluded.estado,
  observaciones = excluded.observaciones,
  fecha_actualizacion = excluded.fecha_actualizacion,
  ejemplo = excluded.ejemplo;

insert into public.capacitaciones (id, titulo, organismo, tipo, horas_certificadas, modalidad, destinatarios, escuelas_participantes, participantes_inscritos, estado, fecha_inicio, fecha_fin, lugar, ejemplo) values
  ('CAP-01', 'Automatización con controladores lógicos programables (ejemplo)', 'Organismo capacitador de ejemplo', 'Empresa Privada', 40, 'Semipresencial', 'Docentes de Electromecánica y Electrónica', 6, 30, 'En Curso', '2026-09-01', '2026-11-15', 'A definir', true),
  ('CAP-02', 'Seguridad e higiene para practicantes en planta (ejemplo)', 'Organismo capacitador de ejemplo', 'Público / Privado', 20, 'Presencial', 'Estudiantes de 7° año antes de iniciar la práctica', 10, 120, 'Próxima', '2027-03-15', '2027-04-15', 'A definir', true),
  ('CAP-03', 'Buenas prácticas agrícolas en finca (ejemplo)', 'Organismo capacitador de ejemplo', 'Organismo Público', 30, 'Presencial', 'Docentes tutores de escuelas agrotécnicas', 8, 25, 'Completada', '2026-05-04', '2026-06-12', 'A definir', true)
on conflict (id) do update set
  titulo = excluded.titulo,
  organismo = excluded.organismo,
  tipo = excluded.tipo,
  horas_certificadas = excluded.horas_certificadas,
  modalidad = excluded.modalidad,
  destinatarios = excluded.destinatarios,
  escuelas_participantes = excluded.escuelas_participantes,
  participantes_inscritos = excluded.participantes_inscritos,
  estado = excluded.estado,
  fecha_inicio = excluded.fecha_inicio,
  fecha_fin = excluded.fecha_fin,
  lugar = excluded.lugar,
  ejemplo = excluded.ejemplo;

insert into public.documentos (id, titulo, descripcion, categoria, tipo_archivo, tamanio, fecha, version, organismo, estado, descargas, url, ejemplo) values
  ('DOC-TUC-001', 'Ley N° 26.058 de Educación Técnico Profesional', 'Ley nacional que regula la ETP. Texto oficial en el sitio de normativa del Gobierno nacional.', 'Normativa', 'WEB', 'enlace', '2005-09-07', 'texto vigente', 'Congreso de la Nación Argentina', 'Vigente', 0, 'https://www.argentina.gob.ar/normativa/nacional/ley-26058-109525/texto', default),
  ('DOC-TUC-002', 'Modelo de convenio marco escuela–empresa (ejemplo)', 'Lugar reservado para el modelo oficial de la DETyFP. Todavía no está cargado.', 'Convenios', 'DOCX', '', '2026-10-20', 'borrador', 'Dirección de Educación Técnica y Formación Profesional', 'Pendiente de carga', 0, default, true),
  ('DOC-TUC-003', 'Modelo de acta acuerdo individual por practicante (ejemplo)', 'Lugar reservado para el modelo oficial: tareas, horario, seguro y tutores asignados.', 'Convenios', 'DOCX', '', '2026-10-20', 'borrador', 'Dirección de Educación Técnica y Formación Profesional', 'Pendiente de carga', 0, default, true),
  ('DOC-TUC-004', 'Bitácora del practicante — plantilla (ejemplo)', 'Lugar reservado para la plantilla de registro semanal de tareas y horas.', 'Bitácora digital', 'XLSX', '', '2026-10-20', 'borrador', 'Dirección de Educación Técnica y Formación Profesional', 'Pendiente de carga', 0, default, true),
  ('DOC-TUC-005', 'Rúbrica de evaluación de la práctica (ejemplo)', 'Lugar reservado para la rúbrica de competencias técnicas y transversales.', 'Seguimiento', 'PDF', '', '2026-10-20', 'borrador', 'Dirección de Educación Técnica y Formación Profesional', 'Pendiente de carga', 0, default, true)
on conflict (id) do update set
  titulo = excluded.titulo,
  descripcion = excluded.descripcion,
  categoria = excluded.categoria,
  tipo_archivo = excluded.tipo_archivo,
  tamanio = excluded.tamanio,
  fecha = excluded.fecha,
  version = excluded.version,
  organismo = excluded.organismo,
  estado = excluded.estado,
  descargas = excluded.descargas,
  url = excluded.url,
  ejemplo = excluded.ejemplo;

insert into public.casos (id, titulo, escuela, localidad, departamento, especialidad, empresa, cantidad_estudiantes, duracion, problematica, actividades, competencias, resultados, testimonio_estudiante, testimonio_empresa, imagen_url, video_url, destacado, ejemplo) values
  ('CASO-TUC-001', 'Dispositivo de control dimensional para piezas torneadas', 'Escuela técnica de ejemplo', 'Banda del Río Salí', 'Cruz Alta', 'Electromecánica', 'Metalmecánica Ejemplo S.R.L.', 6, '200 horas reloj', 'El control manual de medidas demoraba la entrega de lotes.', 'Calibración de instrumentos, diseño de un calibre pasa/no pasa y registro de mediciones.', 'Metrología, lectura de planos, trabajo en equipo.', 'Se redujo el tiempo de control por lote y quedó un procedimiento escrito para la planta.', 'Ejemplo de testimonio: aplicamos en la planta lo que vimos en el taller.', 'Ejemplo de testimonio: el dispositivo quedó en uso en la línea.', '', '', true, true),
  ('CASO-TUC-002', 'Monitoreo de humedad de suelo con sensores en un vivero', 'Escuela agrotécnica de ejemplo', 'Famaillá', 'Famaillá', 'Producción Agropecuaria', 'Citrícola Ejemplo S.A.', 5, '160 horas reloj', 'El riego del vivero se decidía a ojo y había pérdidas de plantines.', 'Instalación de sensores de humedad, registro de datos y propuesta de calendario de riego.', 'Manejo de cultivos, registro de datos, uso de tecnología aplicada al agro.', 'Menor consumo de agua y un registro semanal que el vivero sigue usando.', 'Ejemplo de testimonio: ver los datos nos ayudó a entender el cultivo.', 'Ejemplo de testimonio: la propuesta fue simple y útil.', '', '', false, true)
on conflict (id) do update set
  titulo = excluded.titulo,
  escuela = excluded.escuela,
  localidad = excluded.localidad,
  departamento = excluded.departamento,
  especialidad = excluded.especialidad,
  empresa = excluded.empresa,
  cantidad_estudiantes = excluded.cantidad_estudiantes,
  duracion = excluded.duracion,
  problematica = excluded.problematica,
  actividades = excluded.actividades,
  competencias = excluded.competencias,
  resultados = excluded.resultados,
  testimonio_estudiante = excluded.testimonio_estudiante,
  testimonio_empresa = excluded.testimonio_empresa,
  imagen_url = excluded.imagen_url,
  video_url = excluded.video_url,
  destacado = excluded.destacado,
  ejemplo = excluded.ejemplo;

insert into public.estudiantes (id, dni, nombre, escuela, especialidad, curso, estado, empresa, ejemplo) values
  ('ALU-01', '00.000.001', 'Estudiante Ejemplo A', 'Escuela técnica de ejemplo', 'Electromecánica', '7° 1ª', 'En Práctica', 'Metalmecánica Ejemplo S.R.L.', true),
  ('ALU-02', '00.000.002', 'Estudiante Ejemplo B', 'Escuela agrotécnica de ejemplo', 'Producción Agropecuaria', '7° 1ª', 'Asignado', 'Citrícola Ejemplo S.A.', true),
  ('ALU-03', '00.000.003', 'Estudiante Ejemplo C', 'Escuela técnica de ejemplo', 'Informática', '7° 2ª', 'Finalizado', 'Cooperativa de Software Ejemplo', true)
on conflict (id) do update set
  dni = excluded.dni,
  nombre = excluded.nombre,
  escuela = excluded.escuela,
  especialidad = excluded.especialidad,
  curso = excluded.curso,
  estado = excluded.estado,
  empresa = excluded.empresa,
  ejemplo = excluded.ejemplo;

insert into public.solicitudes (id, tipo, titulo, solicitante, correo, departamento, especialidad, fecha, estado, detalles, ejemplo) values
  ('SOL-TUC-101', 'oferente', 'Panificadora Ejemplo S.A.', 'Responsable de planta (ejemplo)', 'contacto@ejemplo.com', 'Lules', 'Tecnología de los Alimentos', '2026-10-20', 'Pendiente', 'Solicitud de ejemplo para probar la bandeja. Ofrece 4 cupos en control de calidad.', true)
on conflict (id) do update set
  tipo = excluded.tipo,
  titulo = excluded.titulo,
  solicitante = excluded.solicitante,
  correo = excluded.correo,
  departamento = excluded.departamento,
  especialidad = excluded.especialidad,
  fecha = excluded.fecha,
  estado = excluded.estado,
  detalles = excluded.detalles,
  ejemplo = excluded.ejemplo;

select setval('public.escuelas_seq', greatest(coalesce((select max(substring(id from 5)::int) from public.escuelas where id ~ '^ESC-[0-9]+$'), 0), (select last_value from public.escuelas_seq)), true);

select setval('public.oferentes_seq', greatest(coalesce((select max(substring(id from 10)::int) from public.oferentes where id ~ '^OFER-TUC-[0-9]+$'), 0), (select last_value from public.oferentes_seq)), true);

select setval('public.estudiantes_seq', greatest(coalesce((select max(substring(id from 5)::int) from public.estudiantes where id ~ '^ALU-[0-9]+$'), 0), (select last_value from public.estudiantes_seq)), true);

select setval('public.capacitaciones_seq', greatest(coalesce((select max(substring(id from 5)::int) from public.capacitaciones where id ~ '^CAP-[0-9]+$'), 0), (select last_value from public.capacitaciones_seq)), true);

select setval('public.documentos_seq', greatest(coalesce((select max(substring(id from 9)::int) from public.documentos where id ~ '^DOC-TUC-[0-9]+$'), 0), (select last_value from public.documentos_seq)), true);

select setval('public.casos_seq', greatest(coalesce((select max(substring(id from 10)::int) from public.casos where id ~ '^CASO-TUC-[0-9]+$'), 0), (select last_value from public.casos_seq)), true);

select setval('public.solicitudes_seq', greatest(coalesce((select max(substring(id from 9)::int) from public.solicitudes where id ~ '^SOL-TUC-[0-9]+$'), 0), (select last_value from public.solicitudes_seq)), true);

commit;
