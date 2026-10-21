# Fuentes de los certificados

Se usan para escribir los datos sobre la plantilla del diploma
(`assets/certificados/plantilla-pp.pdf`). Todas son libres y se pueden redistribuir.

| Archivo | Fuente | Licencia | Reemplaza en el modelo de Word a |
|---|---|---|---|
| `Philosopher-Regular.ttf`, `Philosopher-Bold.ttf` | Philosopher, Jovanny Lemonad (Google Fonts) | SIL Open Font License 1.1 (`OFL-Philosopher.txt`) | Albertus MT (texto corrido): la libre más parecida en trazo y peso |
| `LiberationSans-Bold.ttf`, `-Italic.ttf`, `-BoldItalic.ttf` | Liberation Sans 2.1, Red Hat | SIL Open Font License 1.1 | Arial (mismas medidas) |

Albertus MT es una fuente comercial de Monotype y no puede publicarse en el
repositorio. Si la DETyFP tiene una licencia que lo permita, alcanza con poner los `.ttf` de Albertus en esta carpeta y cambiar los nombres en
`js/modules/certificados/diploma.js` (constante `ARCHIVOS`, claves `texto` y `textoNegrita`).
