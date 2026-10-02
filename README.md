# Vienna

Aplicación local de análisis de ajedrez en español para Windows, con React, TypeScript, Tauri 2, SQLite y **Stockfish 19 nativo**. No usa Electron, motores remotos ni análisis simulados.

## Empezar

Abre el instalador en `src-tauri/target/release/bundle/nsis/`. Incluye el motor, sus redes neuronales integradas, las piezas y las fuentes; una vez instalada, PGN y análisis funcionan sin conexión. Chess.com solo requiere conexión para descargar partidas públicas. No solicita contraseñas.

Para desarrollo necesitas Node 24+, Rust estable MSVC, Microsoft C++ Build Tools y WebView2. Los proyectos nuevos de Linux/macOS requieren las dependencias de sistema de Tauri.

```powershell
npm ci
npm run engine:install
npm run desktop
```

`engine:install` descarga el paquete universal oficial de Stockfish 19, verifica el SHA-256 publicado en la API oficial de GitHub y extrae también el código fuente y la licencia. La selección de plataforma se realiza automáticamente (Windows x64/ARM64, Linux x64/ARM64, macOS). Windows x64 es la plataforma compilada y verificada aquí.

```powershell
npm run package          # Instalador NSIS de Windows
npm run bridge:build     # Adaptador para probar el mismo backend desde el navegador
npm run dev              # http://127.0.0.1:1420
```

El adaptador de desarrollo solo escucha en loopback, valida Host/Origin y exige JSON en las escrituras. Nunca forma parte del instalador. Tanto este adaptador como Tauri utilizan exactamente los mismos módulos de motor, API y SQLite de Rust. Una pestaña web no ejecuta un motor ficticio ni WASM.

## Uso

1. Introduce tu usuario público de Chess.com o importa un PGN. También puedes soltar un archivo sobre la ventana; un archivo puede contener varias partidas separadas por su cabecera `Event`.
2. Abre **Mis partidas** para buscar por jugador, ritmo o resultado. El filtro **Analizadas** y el acceso **Ver análisis** permiten abrir directamente las revisiones completas guardadas. Se actualizan automáticamente los dos archivos mensuales más recientes al iniciar la aplicación; las partidas anteriores descargadas se conservan.
3. Selecciona **Rápido**, **Normal**, **Profundo**, **Máximo** o ajusta un tiempo manual y pulsa **Analizar partida**. Se analiza la posición inicial y todas las posiciones posteriores, incluida la final.
4. Pulsa movimientos, puntos del gráfico o categorías del resumen para navegar. Usa `←`, `→`, `↑` y `Esc`.
5. Arrastra una pieza o usa clic origen/destino. La visualización está en notación española. Tras pensar, el motor muestra el símbolo de clasificación junto a la pieza; la barra conserva la evaluación anterior durante el cálculo.
6. Cada jugada distinta crea una rama. Puedes retroceder y abrir ramas dentro de otras ramas. **Volver a la jugada**, el icono de retorno junto a las cuatro flechas del tablero, regresa al punto donde empezaste la variante y conserva todas sus jugadas. Su espacio siempre está reservado; en la partida principal está desactivado. No cambia la pestaña seleccionada.
7. Botón derecho arrastrado dibuja una flecha; clic derecho marca una casilla en naranja y otro clic la borra. Las flechas del motor se activan desde la barra del tablero; la segunda flecha está en Ajustes.
8. En el resumen, pulsa el nombre de una categoría para recorrer las jugadas de ambos colores, o la cifra de Blancas/Negras para filtrar por jugador. Repite el clic para avanzar y usa **← Volver** o `Esc` para regresar al origen, incluso si has cambiado de categoría o color.
9. **Modo libre** tiene un tablero independiente con análisis, variantes y navegación por la rama elegida, sin selector de aperturas. Su posición, ramas y orientación se guardan localmente. El icono **Nuevo tablero** está en la cabecera; después de usarlo permite **Deshacer nuevo tablero** durante la sesión.
10. **Analizar nuevas partidas automáticamente** comprueba los archivos públicos cada cinco minutos mientras Vienna esté abierta. Está activado por defecto en nuevas configuraciones y puede desactivarse en Ajustes. Solo revisa partidas terminadas desde la primera activación para esa cuenta, una a una, a 5000 ms por posición y sin tope de profundidad, conservando los hilos, Hash y MultiPV configurados. Evita revisiones completas compatibles y da prioridad al análisis manual; los sondeos continúan mientras calcula. La sincronización manual también añade las partidas nuevas a la cola. El progreso aparece en una notificación inferior derecha que se puede ocultar; el aviso final desaparece en siete segundos. Chess.com puede retrasar su publicación.

La barra lateral contiene Mis partidas, Análisis, Modo libre y Estadísticas, además de las cinco partidas más recientes. Se compacta en ventanas de menor altura para mostrar las cinco sin desplazamiento. La cuenta ocupa una sola fila inferior con avatar, nombre y rueda de Ajustes.

Pulsa el perfil para añadir, cambiar o quitar una foto local (JPG, PNG o WebP, hasta 10 MB). Se recorta al centro y guarda a 256×256 en las preferencias locales; no se envía a Chess.com. Sin foto se muestran las iniciales. Cambiar cuenta conserva el acceso al usuario de Chess.com.

Las cinco partidas recientes muestran W/B, una corona junto a tu nombre al ganar, una cruz roja al perder e igual en ambos jugadores en tablas y tu nombre con mayor contraste, sin tarjetas ni texto de resultado. Los nombres completos, colores y resultado siguen disponibles en el tooltip y el nombre accesible. Los sonidos originales de Vienna distinguen movimiento, captura —incluida captura al paso—, jaque y mate; mate tiene prioridad sobre jaque y captura. Ajustes permite silenciarlos, regular su volumen, probar cada efecto y cargar MP3, WAV u OGG propios de hasta 3 segundos y 2 MB. Restaurar recupera el predeterminado de la edición instalada. La carga inicial y los cálculos del motor no reproducen sonidos.

### Estadísticas y ajustes

Estadísticas muestra resultados, winrate, precisión de tus jugadas, recuento de las nueve categorías y Elo por modo con evolución. Permite combinar periodo, modo y color. Con una cuenta solo incluye partidas donde aparece ese usuario; sin cuenta permite elegir Blancas o Negras para los PGN importados.

El winrate divide victorias entre partidas terminadas, incluidas las tablas; excluye las partidas sin resultado. Categorías y precisión usan únicamente jugadas propias de análisis completos compatibles. El Elo es el último registrado en las partidas del periodo seleccionado, no una consulta del Elo actual de Chess.com. Actualizar recarga los análisis guardados; terminar un análisis también actualiza la pantalla. Se ha eliminado el módulo de práctica.

Ajustes tiene dos vistas de altura estable: Procesamiento, con parámetros del motor y análisis automático, y Sonido y tablero. Se accede desde la rueda junto al perfil. El diálogo permite seleccionar texto y solo cierra con un gesto que empiece y termine fuera, el botón de cierre, Listo o Escape.

El botón **Perfil Ryzen 9800X3D** configura 8 hilos, 512 MB de Hash por canal, 4 líneas, 2 s para análisis interactivo, 5 s por posición en revisión y profundidad sin límite. Es un punto de partida equilibrado; ambos canales pueden trabajar a la vez. Para estudiar una posición con más tiempo se puede usar análisis sin límite y 1 línea. El perfil se aplica solo al pulsar el botón.

Las promociones permiten elegir dama, torre, alfil o caballo. Las reglas incluyen enroque, captura al paso y posiciones PGN con `SetUp`/`FEN`.

## Arquitectura

```text
frontend/
  api/           Transporte Tauri/desarrollo y Chess.com
  chess/         PGN, reglas, historial y árbol de variantes
  components/    Tablero, gráfico, biblioteca, ajustes y revisión
  database/      Repositorio tipado sobre SQLite
  engine/        EngineService y perspectiva de evaluación
  review/        GameReviewService y clasificación configurable
  types/         Contratos compartidos de la interfaz
src-tauri/src/
  engine.rs      Procesos UCI, parsing, cancelación y clave de caché
  database.rs    SQLite en WAL; documentos y caché de posiciones
  api.rs         PubAPI con User-Agent, límites y errores
  lib.rs         Backend compartido y comandos Tauri
  bridge.rs      Adaptador JSON por stdin/stdout para desarrollo/pruebas
```

El motor trabaja fuera del hilo de interfaz. Hay dos canales independientes, interactivo y revisión, serializados por canal. Cada solicitud abre su propio proceso nativo; el proceso se termina al acabar o cancelar. Esto simplifica el aislamiento de parámetros y la recuperación de fallos, con un coste de arranque por posición. Cada canal utiliza el Hash configurado. El modo sin límite se mantiene hasta cambiar de posición, ajustes o cerrar la aplicación.

El análisis interactivo tiene un debounce de 160 ms y descarta resultados obsoletos. La caché incluye la huella SHA-256 del ejecutable, FEN inicial, **historial completo de movimientos**, Threads, Hash, MultiPV, tiempo y profundidad. De este modo no se confunden posiciones iguales con distinto historial de repetición. El análisis sin límite no se almacena como resultado terminado.

Al recorrer la partida original se reutilizan directamente las posiciones guardadas de su revisión, incluidas las posiciones terminadas de una revisión parcial. No se inicia un cálculo interactivo que sustituya sus líneas, flechas o evaluación. Las variantes y el modo libre conservan su análisis interactivo independiente; cambiar sus parámetros no altera la revisión guardada. Para revisar la partida con otro nivel se utiliza Reanalizar partida.

## Evaluación y revisión

- Todas las puntuaciones numéricas usan la perspectiva de **blancas**: + favorece a blancas y − a negras, independientemente de la cuenta o la orientación. +M4 indica mate a favor de blancas y −M4 a favor de negras. Un resultado sin evaluación muestra un guion.
- La barra mantiene blancas arriba y negras abajo, independientemente de la orientación. El gráfico usa siempre la perspectiva blanca y acota el dibujo a ±6 para legibilidad; los valores numéricos conservan el resultado original.
- Las líneas MultiPV terminadas proceden de una misma iteración completa del motor, para no mezclar profundidades.
- La barra usa la expectativa `(victorias + tablas / 2) / 1000` de `UCI_ShowWDL`, calibrada por Stockfish para partidas entre motores. Para clasificar jugadas se usa la [curva pública de Win% de Lichess](https://lichess.org/page/accuracy), basada en partidas humanas: `1 / (1 + exp(-0.00368208 × centipeones))`. Las pérdidas se calculan desde el color del jugador que movió. Los mates y resultados sin puntuación numérica conservan el tratamiento de WDL. Las puntuaciones y líneas originales del motor no cambian.
- Las reglas y umbrales están aislados en `frontend/review/classification.ts`. Los límites numéricos coinciden con los [publicados por Chess.com](https://support.chess.com/en/articles/8572705-how-are-moves-classified-what-is-a-blunder-or-brilliant-etc): Excelente pierde menos de 2 puntos porcentuales de expectativa; Buena, de 2 a menos de 5; Imprecisión, de 5 a menos de 10; Error, de 10 a menos de 20; Grave error, 20 o más. Mejor identifica la primera elección del motor. En los límites exactos se usa el tramo que empieza en ese valor, con tolerancia numérica de 1e-12.
- **Libro** reconoce pares exactos de posición y jugada del catálogo CC0 de Lichess, con transposiciones y derechos de enroque/captura al paso, durante las primeras 32 medias jugadas. No basta con estar en las primeras jugadas. El catálogo contiene 3.815 aperturas y 8.063 pares distintos; funciona sin Internet. Que una línea tenga nombre no implica que el motor la considere óptima. Las jugadas de libro quedan fuera del cálculo de precisión y de los momentos mejores/críticos. Las revisiones guardadas se decoran al abrirlas sin perder sus evaluaciones.
- La precisión de Vienna es `100 × exp(-4 × pérdida media de expectativa)`. Es una estimación propia, no una medida oficial o estadísticamente calibrada para humanos.
- «Brillante» reconoce una oferta de pieza de valor mínimo 3 que, si se acepta legalmente, cuesta al menos un punto material después de las recapturas óptimas en esa casilla. El rival puede rechazarla, y la compensación táctica en otra casilla no invalida el sacrificio. También reconoce una aceptación en la continuación durante las primeras tres respuestas, si la pieza ofrecida no se mueve. Exige profundidad mínima 10, continuación legal, alternativas a la misma profundidad, pérdida inferior a 2 puntos porcentuales y expectativa propia mínima 0,455 (margen de equilibrio de aproximadamente medio peón). Las otras opciones no deben mantener una expectativa de 0,90 o más. Tiene prioridad sobre Genial. Un intercambio equivalente no cumple el criterio. Es una heurística propia: solo sigue la pieza movida; la aceptación tardía y los sacrificios de otra pieza pueden pasar desapercibidos. La exploración de intercambios está limitada a 256 nodos; evidencia incompleta no otorga la etiqueta.
- «Genial» exige ser la primera elección, alternativas a la misma profundidad mínima 16 y una diferencia de al menos 15 puntos porcentuales frente a la mejor alternativa disponible. Además debe conservar una expectativa de al menos 0,50 cuando las alternativas quedan por debajo, o al menos 0,75 cuando las alternativas no alcanzan ese valor. No basta con ser menos mala en una posición perdida, ni con ser mejor cuando las otras opciones también mantienen una posición ganadora. Los valores 0,75/0,90 y los filtros de evidencia son decisiones locales de Vienna; no son parámetros publicados de Chess.com. Con MultiPV 1 no se asignan Brillante ni Genial. Cambiar profundidad, tiempo o alternativas puede cambiar estas categorías sin que la jugada deje de ser la mejor.
- No se afirma reproducir el algoritmo privado: Chess.com usa un modelo de expectativa y reglas especiales dependientes del Elo; Vienna usa una curva pública basada en partidas humanas, sin adaptación al Elo. Por eso los mismos límites no garantizan las mismas etiquetas. Vienna no implementa actualmente la categoría adicional Miss/Oportunidad perdida. La precisión conserva su fórmula propia; cambiar el modelo de pérdidas también actualiza los porcentajes al abrir las revisiones antiguas.
- Las categorías comparan la jugada realizada con las alternativas de la misma búsqueda cuando está entre ellas. La primera elección no se degrada porque un nuevo cálculo de la posición siguiente cambie la evaluación. Si no existe esa candidata, se usa la evaluación posterior como estimación. Las reglas llevan su propia versión y las etiquetas antiguas se actualizan al abrir sin recalcular ni borrar las posiciones.
- En escritorio hay tres columnas alineadas: tablero; Análisis y Resumen; Evaluación y Continuaciones. Resumen conserva las pestañas Revisión y Movimientos. Revisión muestra precisión y recuentos solo al completar el análisis. Los errores aparecen en un aviso superior derecho; no desplazan las tarjetas.
- Revisión y Movimientos comparten una franja inferior de la misma altura con la jugada seleccionada, su categoría y explicación. Durante un recorrido de categorías, Revisión añade el color, contador y botón Volver en la cabecera de esa franja. La posición inicial muestra una indicación breve. La lista y las explicaciones largas se desplazan en sus propias áreas, sin cambiar la altura exterior de las tarjetas.
- Continuaciones muestra primero la jugada realizada, seguida de hasta cuatro candidatas; cuando procede de la posición siguiente se identifica como Evaluación posterior. Una estrella identifica la primera elección del motor. Los fondos claros/oscuros de puntuación indican ventaja blanca/negra, usando los mismos colores que las tarjetas de precisión. La barra sitúa la puntuación en el lado favorecido. Las revisiones antiguas mantienen las líneas con las que se guardaron hasta reanalizar. Al pasar el ratón o enfocar una línea se muestra una sola flecha naranja; al salir se restauran las flechas automáticas configuradas.
- Evaluación conserva puntos circulares al redimensionarse. Mínimo y máximo usan siempre la perspectiva blanca y excluyen mates. Tu ventaja cuenta posiciones con al menos medio peón a favor del jugador de la cuenta, incluyendo mates a favor; su tooltip explica el porcentaje.
- Los perfiles muestran las piezas capturadas en la rama actual y la ventaja material (peón 1, caballo/alfil 3, torre 5, dama 9). Las variantes se conservan en el árbol local y se puede volver a la partida original; no hay una pestaña de gestión de variantes. Una revisión completa muestra Partida analizada y permite repetirla explícitamente mediante Reanalizar.
- Las explicaciones se limitan a hechos obtenidos del motor. No se generan relatos tácticos no demostrados.
- Una revisión parcial se guarda después de cada posición. Si se repite una partida ya analizada, el progreso se escribe en review-drafts y la revisión completa anterior se conserva hasta finalizar; cancelar restaura también ese resumen en pantalla. Al repetirla, la caché compatible permite continuar sin recalcular las posiciones ya terminadas.

## Datos locales

En Windows, Tauri guarda `vienna.sqlite3` en `%APPDATA%\app.vienna.chess\`. En desarrollo web se utiliza `.vienna-dev/vienna.sqlite3`, separada de los datos de escritorio. Los ensayos de integración usan directorios aislados dentro de `test-results/`.

SQLite almacena partidas y PGN, árboles de variantes, configuración, usuario, revisiones, categorías, líneas y posiciones calculadas. No hay telemetría ni fuentes web remotas. Para una copia de seguridad, cierra Vienna y copia su carpeta de datos completa.

## Verificación

```powershell
npm test                  # Reglas, ramas, FEN, promociones, repetición, WDL y clasificación
npm run test:native       # Parser UCI, normalización y claves de caché
npm run test:integration  # Ejecuta el Stockfish real y verifica SQLite/cancelación/reinicio
$env:TEST_CHESSCOM='1'; npm run test:integration  # Añade PubAPI pública real
npm run build
```

Las pruebas no introducen partidas ni resultados de muestra en los datos de la aplicación instalada. Las pruebas visuales utilizan un PGN histórico importado explícitamente en la base de desarrollo.

## Licencias

Vienna se distribuye bajo GPL-3.0-or-later por compatibilidad con Chessground. Las piezas Cburnett de Colin M. L. Burnett son abiertas. Stockfish es GPLv3 y su distribución oficial incluye el código correspondiente. Las fuentes son SIL OFL. Consulta `THIRD_PARTY_NOTICES.md` y `LICENSE`. Los iconos y el monograma de Vienna son originales. Los cuatro sonidos originales de Vienna se dedican mediante CC0-1.0; su generador y procedencia están incluidos. No se usan logos, piezas ni recursos gráficos de Chess.com.

La compilación normal (`npm run package`) contiene exclusivamente los sonidos originales. La compilación personal (`npm run package:personal`) usa recursos privados que quedan fuera del repositorio y de la exportación pública. Consulta [PUBLISHING.md](docs/PUBLISHING.md) para preparar la copia de GitHub sin datos de usuarios y [DISTRIBUTION.md](docs/DISTRIBUTION.md) para las condiciones de distribución.

Fuentes verificadas para esta implementación: [Tauri](https://v2.tauri.app/start/prerequisites/), [Stockfish 19](https://github.com/official-stockfish/Stockfish/releases/tag/sf_19), [documentación UCI](https://official-stockfish.github.io/docs/stockfish-wiki/UCI-&-Commands.html), [chess.js](https://github.com/jhlywa/chess.js), [Chessground](https://github.com/lichess-org/chessground) y [PubAPI](https://www.chess.com/news/view/published-data-api). Las versiones exactas quedan fijadas en `package-lock.json` y `src-tauri/Cargo.lock`.
