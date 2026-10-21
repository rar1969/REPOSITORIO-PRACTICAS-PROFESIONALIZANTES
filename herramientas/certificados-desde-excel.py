"""
Convierte la planilla de certificaciones (Excel) en SQL para cargar en Supabase
las tablas capacitaciones, dictados, participantes y certificados (migración 004).

    python3 herramientas/certificados-desde-excel.py planilla.xlsx salida.sql [--cap-desde 4] [--dic-desde 1]

Columnas esperadas (fila 3 = encabezados, datos desde la fila 4), en cualquier hoja:
    Orden | Orden | DNI | Apellido | Nombre | Escuela | Nombre de la Charla |
    Horas de PP a acreditar | Disertantes | Fecha | Curso | Especialización | Imprimidas

El SQL resultante contiene datos personales de menores: NO subirlo al repositorio.
Se corre una vez en el SQL Editor (o por el conector) y se descarta.

Reglas de limpieza (quedan registradas en 'observaciones' y en el informe):
  - DNI: se quitan puntos y espacios. Si no son 7-8 dígitos, queda vacío y se marca revisar.
  - Un mismo DNI usado por dos personas distintas: se deja vacío en ambas y se marca revisar.
  - Sin DNI: la persona se identifica por apellido + nombre + escuela.
  - 'Imprimidas' = OK  ->  certificado en estado 'impreso'.
"""
import datetime, re, sys, collections, json
import openpyxl

ESCUELAS = {
    'escuela tecnica nº 1 bella vista': 'ESC-19',
    'escuela tecnica el mollar': 'ESC-17',
    'escuela tecnica nº 1 juan bautista alberdi': 'ESC-24',
    'escuela tecnica nº 1 ing. antonio maria correa': 'ESC-23',
    'escuela tecnica nº 1 ranchillos': 'ESC-30',
    'escuela tecnica nº 1 crucero ara general belgrano': 'ESC-16',
    'escuela tecnica nº 1 monteros': 'ESC-28',
    'escuela tecnica nº 5': 'ESC-38',
    'escuela tecnica nº 1 hilda guerrero de molina': 'ESC-21',
    'escuela tecnica nº 1 la cocha': 'ESC-25',
    'escuela tecnica nº 3 juan b teran': 'ESC-36',
    'escuela tecnica nº 4 - juan xxiii': 'ESC-37',
}
# Erratas evidentes en títulos y disertantes (lo que se imprime en el diploma).
TITULOS = {
    'Programaciòn. Lenguaje C #': 'Programación. Lenguaje C#',
    'Mantenimiento Mecànico en Industrias': 'Mantenimiento Mecánico en Industrias',
    'De la Escuela Técnica al Mundo Laboral. Experiencia reales en diferentes industrias':
        'De la Escuela Técnica al Mundo Laboral. Experiencias reales en diferentes industrias',
}
DISERTANTES = {
    'TUP Pedro ismael Chavez; TUP Matias Sebastian Chocobar':
        'TUP Pedro Ismael Chávez; TUP Matías Sebastián Chocobar',
    'INSTITUTO DE LUMNINOTECNIA, LUZ Y VISIÓN, FACET -UNT':
        'Instituto de Luminotecnia, Luz y Visión (FACET-UNT)',
    'Empresa SMC': 'SMC Argentina',
}
ORGANISMO = {  # disertante institucional -> (organismo, tipo)
    'SMC Argentina': ('SMC Argentina', 'Empresa Privada'),
    'Instituto de Luminotecnia, Luz y Visión (FACET-UNT)':
        ('Instituto de Luminotecnia, Luz y Visión (FACET-UNT)', 'Organismo Público'),
}
ESPECIALIDADES = {  # a los nombres de la tabla especialidades
    'tecnico en informatica personal y profesional': 'Informática',
    'maestro mayor de obras': 'Maestro Mayor de Obras',
    'electromecanica': 'Electromecánica',
    'electromecanico': 'Electromecánica',
    'tecnico en gestion y administracion de las organizaciones':
        'Gestión y Administración de las Organizaciones',
}


def limpio(v):
    return re.sub(r'\s+', ' ', str(v)).strip() if v is not None else None


def sin_acentos(v):
    import unicodedata
    s = unicodedata.normalize('NFD', limpio(v) or '').lower()
    return unicodedata.normalize('NFC', ''.join(c for c in s if unicodedata.category(c) != 'Mn' or c == '̃'))


def k(v):
    # minúsculas, sin tildes (conserva la ñ)
    return sin_acentos(v)


def fecha(v):
    if v is None or v == '':
        return None
    if isinstance(v, datetime.datetime):
        return v.date()
    if isinstance(v, (int, float)):
        return datetime.date(1899, 12, 30) + datetime.timedelta(days=int(v))
    raise ValueError(f'fecha no reconocida: {v!r}')


def nombre_propio(s):
    if s:   # acento grave por error de tipeo: Gòmez -> Gómez
        s = s.translate(str.maketrans('àèìòùÀÈÌÒÙ', 'áéíóúÁÉÍÓÚ'))
    if s and (s.isupper() or s.islower()):
        return ' '.join(p[:1].upper() + p[1:].lower() for p in s.split(' '))
    return s


def q(v):
    if v is None:
        return 'null'
    if isinstance(v, bool):
        return 'true' if v else 'false'
    if isinstance(v, (int, float)):
        return str(v)
    return "'" + str(v).replace("'", "''") + "'"


def main(entrada, salida, cap_desde=4, dic_desde=1):
    origen = re.sub(r'^[0-9a-f]{8}-', '', entrada.replace('\\', '/').split('/')[-1])
    wb = openpyxl.load_workbook(entrada, data_only=True)
    filas = []
    for ws in wb:
        for i, r in enumerate(ws.iter_rows(min_row=4, values_only=True), start=4):
            if all(v is None for v in r):
                continue
            (_, _, dni, ape, nom, esc, charla, horas, dis, fec, curso, esp, imp) = r[:13]
            dni_txt = re.sub(r'[.\s-]', '', str(dni)) if dni is not None else ''
            ape, nom = limpio(ape), limpio(nom)
            if nom and ape and k(ape).endswith(', ' + k(nom)):   # "Medina, Lahion Gabriel"
                ape = ape[:-(len(nom) + 2)].strip()
            filas.append(dict(
                fuente=f'{ws.title} fila {i}', dni_original=limpio(dni),
                dni=dni_txt if re.fullmatch(r'\d{7,8}', dni_txt) else None,
                apellido=nombre_propio(limpio(ape)), nombre=nombre_propio(limpio(nom)),
                escuela_id=ESCUELAS[k(esc)],
                titulo=TITULOS.get(limpio(charla), limpio(charla)),
                horas=int(horas), disertantes=DISERTANTES.get(limpio(dis), limpio(dis)),
                fecha=fecha(fec), curso=limpio(curso),
                especialidad=ESPECIALIDADES[k(esp)], impreso=limpio(imp) == 'OK'))

    informe = collections.defaultdict(list)

    # --- DNI compartidos por personas distintas
    por_dni = collections.defaultdict(set)
    for f in filas:
        if f['dni']:
            por_dni[f['dni']].add((k(f['apellido']), k(f['nombre'])))
    dni_conflicto = {d for d, s in por_dni.items() if len(s) > 1}

    # --- participantes
    participantes, id_de = {}, {}
    for f in filas:
        obs, revisar = [], False
        dni = f['dni']
        if dni in dni_conflicto:
            otros = [f2 for f2 in filas if f2['dni'] == dni and k(f2['apellido']) != k(f['apellido'])]
            obs.append(f"DNI {dni} de la planilla repetido con {otros[0]['apellido']}, {otros[0]['nombre']}")
            dni, revisar = None, True
        elif dni is None and f['dni_original']:
            obs.append(f"DNI ilegible en la planilla: {f['dni_original']}")
            revisar = True
        elif dni is None:
            obs.append('Sin DNI en la planilla')
        if k(f['apellido']) == k(f['nombre']) or k(f['nombre']) in k(f['apellido']):
            obs.append('Falta el apellido: la planilla repite el nombre en las dos columnas')
            revisar = True
        llave = ('dni', dni) if dni else ('nom', k(f['apellido']), k(f['nombre']), f['escuela_id'])
        if llave not in participantes:
            participantes[llave] = dict(dni=dni, apellido=f['apellido'], nombre=f['nombre'],
                                        escuela_id=f['escuela_id'], revisar=revisar,
                                        observaciones='; '.join(dict.fromkeys(obs)) or None)
        f['llave'] = llave
    for n, (llave, p) in enumerate(participantes.items(), start=1):
        p['id'] = f'PAR-{n:04d}'
        if p['revisar']:
            informe['revisar'].append(f"{p['id']} {p['apellido']}, {p['nombre']}: {p['observaciones']}")
        elif p['dni'] is None:
            informe['sin_dni'].append(p['id'])

    # --- capacitaciones y dictados
    caps, dics = {}, {}
    for f in filas:
        caps.setdefault(f['titulo'], dict(titulo=f['titulo'], horas=f['horas'], fechas=set(),
                                          escuelas=set(), personas=set(), esp=set(), dis=set()))
        c = caps[f['titulo']]
        if f['fecha']:
            c['fechas'].add(f['fecha'])
        c['escuelas'].add(f['escuela_id']); c['personas'].add(f['llave']); c['esp'].add(f['especialidad'])
        if f['disertantes']:
            c['dis'].add(f['disertantes'])
        dk = (f['titulo'], f['escuela_id'], f['fecha'], f['disertantes'])
        dics.setdefault(dk, dict(titulo=f['titulo'], escuela_id=f['escuela_id'],
                                 fecha=f['fecha'], disertantes=f['disertantes']))
        f['dk'] = dk
    for n, c in enumerate(sorted(caps.values(), key=lambda c: c['titulo']), start=cap_desde):
        c['id'] = f'CAP-{n:02d}'
    for n, d in enumerate(sorted(dics.values(), key=lambda d: (d['fecha'] or datetime.date.max, d['titulo'], d['escuela_id'])), start=dic_desde):
        d['id'] = f'DIC-{n:03d}'
        if d['fecha'] is None:
            informe['dictado_sin_fecha'].append(f"{d['id']} {d['titulo']} ({d['escuela_id']})")
        if d['disertantes'] is None:
            informe['dictado_sin_disertantes'].append(f"{d['id']} {d['titulo']} ({d['escuela_id']})")

    # --- certificados
    certs, vistos = [], set()
    for f in filas:
        pid, did = participantes[f['llave']]['id'], dics[f['dk']]['id']
        if (pid, did) in vistos:
            informe['duplicado'].append(f['fuente']); continue
        vistos.add((pid, did))
        certs.append(dict(participante_id=pid, dictado_id=did, curso=f['curso'],
                          especialidad=f['especialidad'], horas=f['horas'],
                          estado='impreso' if f['impreso'] else 'pendiente',
                          fuente=f"{origen} · {f['fuente']}"))
    for n, c in enumerate(certs, start=1):
        c['id'] = f'CER-{n:04d}'

    # --- SQL
    L = ['begin;']
    for c in sorted(caps.values(), key=lambda c: c['id']):
        org, tipo = (None, None)
        if len(c['dis']) == 1:
            org, tipo = ORGANISMO.get(next(iter(c['dis'])), (None, None))
        L.append('insert into public.capacitaciones (id, titulo, organismo, tipo, horas_certificadas, modalidad, '
                 'destinatarios, escuelas_participantes, participantes_inscritos, estado, fecha_inicio, fecha_fin) values ('
                 + ', '.join(q(v) for v in [c['id'], c['titulo'], org, tipo, c['horas'], 'Presencial',
                                            'Estudiantes de ' + ', '.join(sorted(c['esp'])),
                                            len(c['escuelas']), len(c['personas']), 'Completada',
                                            min(c['fechas']).isoformat() if c['fechas'] else None,
                                            max(c['fechas']).isoformat() if c['fechas'] else None]) + ');')
    for d in sorted(dics.values(), key=lambda d: d['id']):
        L.append('insert into public.dictados (id, capacitacion_id, escuela_id, fecha, disertantes) values ('
                 + ', '.join(q(v) for v in [d['id'], caps[d['titulo']]['id'], d['escuela_id'],
                                            d['fecha'].isoformat() if d['fecha'] else None, d['disertantes']]) + ');')
    for i in range(0, len(participantes), 200):
        lote = list(participantes.values())[i:i + 200]
        L.append('insert into public.participantes (id, dni, apellido, nombre, escuela_id, revisar, observaciones) values\n'
                 + ',\n'.join('(' + ', '.join(q(p[x]) for x in ['id', 'dni', 'apellido', 'nombre', 'escuela_id', 'revisar', 'observaciones']) + ')' for p in lote) + ';')
    for i in range(0, len(certs), 200):
        lote = certs[i:i + 200]
        L.append('insert into public.certificados (id, participante_id, dictado_id, curso, especialidad, horas, estado, fuente) values\n'
                 + ',\n'.join('(' + ', '.join(q(c[x]) for x in ['id', 'participante_id', 'dictado_id', 'curso', 'especialidad', 'horas', 'estado', 'fuente']) + ')' for c in lote) + ';')
    L.append(f"select setval('public.capacitaciones_seq', greatest((select max(substr(id, 5)::int) from public.capacitaciones where id ~ '^CAP-\\d+$'), 1));")
    L.append(f"select setval('public.dictados_seq', {len(dics) + dic_desde - 1});")
    L.append(f"select setval('public.participantes_seq', {len(participantes)});")
    L.append(f"select setval('public.certificados_seq', {len(certs)});")
    L.append('commit;')
    open(salida, 'w', encoding='utf-8').write('\n'.join(L) + '\n')

    resumen = dict(filas=len(filas), capacitaciones=len(caps), dictados=len(dics),
                   participantes=len(participantes), certificados=len(certs),
                   impresos=sum(c['estado'] == 'impreso' for c in certs),
                   pendientes=sum(c['estado'] == 'pendiente' for c in certs),
                   sin_dni=len(informe['sin_dni']))
    print(json.dumps(resumen, ensure_ascii=False, indent=1))
    for t in ['revisar', 'dictado_sin_fecha', 'dictado_sin_disertantes', 'duplicado']:
        if informe[t]:
            print(f'\n## {t} ({len(informe[t])})')
            print('\n'.join(informe[t]))


if __name__ == '__main__':
    a = sys.argv[1:]
    opt = {a[i]: int(a[i + 1]) for i in range(2, len(a), 2)}
    main(a[0], a[1], opt.get('--cap-desde', 4), opt.get('--dic-desde', 1))
