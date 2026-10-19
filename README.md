# Vienna

Aplicación local de análisis de ajedrez en español para Windows, con React, TypeScript, Tauri 2, SQLite y **Stockfish 19 nativo**. No usa Electron, motores remotos ni análisis simulados.

## Empezar

Descarga **[Vienna.exe para Windows x64](https://github.com/MagicNube/Vienna/releases/latest/download/Vienna.exe)** desde [Releases](https://github.com/MagicNube/Vienna/releases). No necesitas clonar el repositorio ni instalar herramientas de desarrollo. El instalador incluye el motor, sus redes neuronales integradas, las piezas y las fuentes; una vez instalada, PGN y análisis funcionan sin conexión. Chess.com solo requiere conexión para descargar partidas públicas. No solicita contraseñas. El instalador no está firmado y Windows puede mostrar un aviso de SmartScreen.

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
npm run build:public     # Comprueba que no se incorporen sonidos privados ni datos locales
npm run preview          # Previsualización de dist con el mismo backend local (requiere bridge:build)
```

El adaptador de desarrollo solo escucha en loopback, valida Host/Origin y exige JSON en las escrituras. Nunca forma parte del instalador. Tanto este adaptador como Tauri utilizan exactamente los mismos módulos de motor, API y SQLite de Rust. Una pestaña web no ejecuta un motor ficticio ni WASM.

La previsualización de producción utiliza el mismo adaptador, en el puerto 1420. `VIENNA_DATA_DIR` permite elegir una base de pruebas separada; nunca se incluye en el instalador.

## Uso

**Sugerencias y problemas:** en **Ajustes → Ayuda** puedes escribir al desarrollador. Al abrir el formulario, el botón fijo cambia de «Listo» a «Enviar opinión»; muestra «Enviando…» y después «Enviado» con una confirmación visible. El contacto es opcional. Solo se comparten el texto, el contacto que indiques, la versión y el sistema operativo mediante Web3Forms; no se adjuntan partidas ni datos de la cuenta. El envío necesita Internet y conserva «Usar mi correo» como alternativa.

1. Introduce tu usuario público de Chess.com o importa un PGN. También puedes soltar un archivo sobre la ventana; un archivo puede contener varias partidas separadas por su cabecera `Event`.
2. Abre **Mis partidas** para buscar por jugador, ritmo, resultado o estado. Cada partida muestra un único estado: **Sin analizar**, **Analizada** (un tick) o **Revisada** (doble tick), que sustituye al anterior cuando ya la has visto. Pulsa la fila para abrirla y el estado para marcarla o desmarcarla; también puedes hacerlo bajo el tablero. Solo se puede marcar Revisada cuando hay un análisis completo guardado. Las partidas nuevas empiezan sin revisar. La marca manual se guarda sin alterar los análisis. Se actualizan automáticamente los dos archivos mensuales más recientes al iniciar la aplicación; las partidas anteriores descargadas se conservan.
3. Selecciona **Rápido**, **Normal**, **Profundo**, **Máximo** o ajusta un tiempo manual y pulsa **Analizar partida**. Se analiza la posición inicial y todas las posiciones posteriores, incluida la final.
4. Pulsa movimientos, puntos del gráfico o categorías del resumen para navegar. Usa `←`, `→`, `↑` y `Esc`.
5. Arrastra una pieza o usa clic origen/destino. La visualización está en notación española. Tras pensar, el motor muestra el símbolo de clasificación junto a la pieza; la barra conserva la evaluación anterior durante el cálculo.
6. Cada jugada distinta crea una rama. Puedes retroceder y abrir ramas dentro de otras ramas. El icono de retorno junto a las cuatro flechas del tablero regresa al punto de la partida principal del que sale la variante, conservando todas sus jugadas. Su espacio siempre está reservado; sin variante ni recorrido está desactivado. No cambia la pestaña seleccionada.
7. Botón derecho arrastrado dibuja una flecha; clic derecho marca una casilla en naranja y otro clic la borra. Las dos flechas del motor se activan por separado desde la barra del tablero o desde Ajustes.
8. En el resumen, pulsa el nombre de una categoría para recorrer las jugadas de ambos colores, o la cifra de Blancas/Negras para filtrar por jugador. Repite el clic para avanzar; navegar por la partida pausa el contador de la categoría y permite volver al origen. El mismo icono de retorno bajo el tablero regresa al origen, incluso si has cambiado de categoría o color. `Esc` hace exactamente lo mismo. Si creas un Custom durante el recorrido, el primer retorno sale de la variante y el segundo recupera la posición anterior al recorrido.
9. **Modo libre** tiene un tablero independiente con análisis, variantes y navegación por la rama elegida, sin selector de aperturas. Su posición, ramas y orientación se guardan localmente. Los controles **Reiniciar tablero** y **Deshacer reinicio** están a la derecha de la cinta bajo el tablero. El reinicio se puede deshacer hasta jugar una nueva jugada.
10. **Analizar nuevas partidas automáticamente** comprueba los archivos públicos cada cinco minutos mientras Vienna esté abierta. Está activado por defecto en nuevas configuraciones y puede desactivarse en Ajustes. Solo revisa partidas terminadas desde la primera activación para esa cuenta, una a una, por defecto a 5000 ms por posición, respetando los hilos, Hash, MultiPV y profundidad configurados. Evita revisiones completas compatibles y procesa solicitudes manuales y automáticas en una sola cola; los sondeos continúan mientras calcula. La sincronización manual también añade las partidas nuevas a la cola. La campana reúne progreso, confirmaciones y errores. Pulsar una notificación abre la partida, incluso si queda fuera de las últimas cinco; la **×** la omite. Las confirmaciones permanecen hasta abrir la partida desde cualquier acceso u omitirlas. La cola puede pausarse al terminar la posición actual y reanudarse desde la campana. Chess.com puede retrasar su publicación.

La barra lateral contiene Mis partidas, Análisis, Modo libre y Estadísticas, además de las cinco partidas más recientes de la cuenta conectada. Se compacta en ventanas de menor altura para mostrar las cinco sin desplazamiento. La cuenta ocupa una sola fila inferior con avatar, nombre y rueda de Ajustes.

Mis partidas muestra la antigüedad de cada partida debajo del ritmo (Hace 5m, Hace 1h, Hace 3d), actualizada cada minuto. Al pasar el cursor por esa fecha se ve la fecha y hora completas. El filtro Sin analizar permite localizar los análisis pendientes aunque la partida ya no esté entre las últimas cinco.

Pulsa el perfil y después la propia foto para añadirla o cambiarla (JPG, PNG o WebP, hasta 10 MB). La cámara identifica el control; al pasar el ratón o enfocarlo con el teclado aparece la acción. Quitar foto queda junto al nombre cuando hay una imagen. Se recorta al centro y guarda a 256×256 en las preferencias locales; no se envía a Chess.com. Sin foto se muestran las iniciales. Cambiar cuenta conserva el acceso al usuario de Chess.com.

Las cinco partidas recientes muestran W/B, una corona junto a tu nombre al ganar, una cruz roja al perder e igual en ambos jugadores en tablas y tu nombre con mayor contraste, sin tarjetas ni texto de resultado. Los nombres completos, colores y resultado siguen disponibles en el tooltip y el nombre accesible. Los sonidos de madera de Kenney (CC0), editados para Vienna, distinguen movimiento, captura —incluida captura al paso—, jaque y mate; mate tiene prioridad sobre jaque y captura. Ajustes permite silenciarlos, regular su volumen, probar cada efecto y cargar MP3, WAV u OGG propios de hasta 3 segundos y 2 MB. Restaurar recupera el predeterminado de la edición instalada. La carga inicial y los cálculos del motor no reproducen sonidos.

### Estadísticas y ajustes

Estadísticas conserva un Resumen con resultados, precisión de tus jugadas, recuento de las diez categorías y Elo por modo. La superficie integrada tiene cinco pestañas: Resumen, Aperturas, Comparativas, Fases y Evolución. Los filtros de periodo, modo y color se aplican a todas las vistas. Con una cuenta solo incluye partidas donde aparece ese usuario; sin cuenta permite elegir Blancas o Negras para los PGN importados. Las partidas contra coaches y bots se identifican por los metadatos del PGN o la URL de Chess.com, no por el nombre del rival. Se conservan en una colección separada de Mis partidas y no cuentan para estadísticas ni últimas cinco.

Las tablas de aperturas y comparativas por ritmo, color y rival se ordenan pulsando sus cabeceras: partidas, victorias, puntuación, precisión, análisis y brillantes cuando corresponde. Un segundo clic invierte el orden; los valores ausentes quedan al final. Permiten exigir un mínimo de partidas. Comparativas incluye mejores rachas de victorias y sin perder, y las rachas actuales; una tabla interrumpe victorias seguidas pero conserva la racha sin perder.

El icono de información de una apertura abre una ventana independiente con una línea de referencia del catálogo CC0, inicialmente en su posición final. Permite recorrer las jugadas y girar el tablero sin iniciar el motor ni modificar la partida principal. El visor usa 149 familias de la misma revisión del catálogo que el libro; `node scripts/build-opening-lines.mjs` regenera esas líneas. La explicación de fases queda detrás de su icono de información.

Estadísticas conserva sus recuentos y perfiles en memoria al salir de la vista y prepara la caché en segundo plano al abrir la app. Cada análisis tiene además un resumen compacto persistente en SQLite, con categorías y pérdidas de expectativa, sin las continuaciones de cada posición. Un análisis terminado actualiza solo su resumen; las partidas nuevas se cargan por identificador. Los números anteriores permanecen visibles mientras se actualizan. Los análisis de instalaciones anteriores preparan ese resumen una sola vez; solo las etiquetas de una versión antigua requieren leer la revisión completa para actualizarse. El icono Actualizar fuerza una nueva lectura y borrar análisis invalida los recuentos correspondientes. La selección de cuenta mantiene separados los datos mostrados.

Pulsar una categoría con jugadas abre Mis partidas filtradas por esa categoría. Solo cuenta tus jugadas de análisis completos y conserva el periodo, modo y color seleccionados en Estadísticas. Cada partida aparece una vez con su número de jugadas de la categoría; al abrirla accedes al análisis guardado. La × junto al filtro recupera la biblioteca completa.

Victorias % divide victorias entre partidas terminadas, incluidas las tablas. Puntuación % asigna 1 punto a una victoria, ½ a las tablas y 0 a una derrota. Ambos excluyen las partidas sin resultado. Las tablas tienen su propio contador y nunca aumentan el de derrotas. Categorías y precisión usan únicamente jugadas propias de análisis completos compatibles. El Elo es el último registrado en las partidas del periodo seleccionado, no una consulta del Elo actual de Chess.com. Actualizar recarga los análisis guardados; terminar un análisis también actualiza la pantalla.

Aperturas reconoce la línea principal con el catálogo local y agrupa variantes por nombre de apertura y color propio. Incluye partidas, victorias/tablas/derrotas, ambos porcentajes, precisión y análisis completos disponibles. Un PGN que comienza en una posición personalizada no se atribuye a una apertura. Errores por fase usa una heurística explicada en la vista: apertura hasta la jugada 10, final con hasta 26 puntos de piezas entre ambos bandos (sin peones ni reyes) y medio juego en el resto, dando prioridad al final. Cuenta imprecisiones, errores, graves errores y oportunidades perdidas por cada 100 jugadas. Evolución muestra precisión y fallos por partida, con media móvil de hasta 10 partidas del periodo seleccionado; excluye análisis parciales, fechas inválidas y partidas que solo tienen jugadas de libro. Estas vistas reutilizan los análisis guardados y no lanzan Stockfish.

Ajustes tiene dos vistas de altura estable: Procesamiento, con parámetros del motor y análisis automático, y Sonido y tablero. Se accede desde la rueda junto al perfil. El diálogo permite seleccionar texto y solo cierra con un gesto que empiece y termine fuera, el botón de cierre, Listo o Escape.

En Ajustes, los perfiles **Bajo**, **Medio**, **Alto** y **Máximo** configuran hilos, Hash, líneas, análisis interactivo, profundidad y tiempos de revisión manual/automática. Los hilos se limitan a la mitad de los procesadores lógicos disponibles, como mínimo uno y hasta ocho. **Personalizado** conserva los valores y permite mezclarlos; cualquier cambio manual activa esa opción. Elegir un perfil no vuelve a analizar partidas ya guardadas.

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
- La barra sigue la orientación del tablero: al abrir tu partida, tu color aparece abajo. Girar el tablero invierte también los colores de la barra. La cifra se sitúa en el extremo del color favorecido; el signo conserva la perspectiva blanca (+ blancas, − negras). El tooltip identifica tu color cuando tu cuenta participa en la partida. El gráfico usa siempre la perspectiva blanca y acota el dibujo a ±6 para legibilidad; los valores numéricos conservan el resultado original.
- Las líneas MultiPV terminadas proceden de una misma iteración completa del motor, para no mezclar profundidades.
- La barra usa la expectativa `(victorias + tablas / 2) / 1000` de `UCI_ShowWDL`, calibrada por Stockfish para partidas entre motores. Para clasificar jugadas se usa la [curva pública de Win% de Lichess](https://lichess.org/page/accuracy), basada en partidas humanas: `1 / (1 + exp(-0.00368208 × centipeones))`. Las pérdidas se calculan desde el color del jugador que movió. Los mates y resultados sin puntuación numérica conservan el tratamiento de WDL. Las puntuaciones y líneas originales del motor no cambian.
- Las reglas y umbrales están aislados en `frontend/review/classification.ts`. Los límites numéricos coinciden con los [publicados por Chess.com](https://support.chess.com/en/articles/8572705-how-are-moves-classified-what-is-a-blunder-or-brilliant-etc): Excelente pierde menos de 2 puntos porcentuales de expectativa; Buena, de 2 a menos de 5; Imprecisión, de 5 a menos de 10; Error, de 10 a menos de 20; Grave error, 20 o más. Mejor identifica la primera elección del motor. En los límites exactos se usa el tramo que empieza en ese valor, con tolerancia numérica de 1e-12.
- **Libro** reconoce pares exactos de posición y jugada del catálogo CC0 de Lichess, con transposiciones y derechos de enroque/captura al paso, durante las primeras 32 medias jugadas. No basta con estar en las primeras jugadas. El catálogo contiene 3.815 aperturas y 8.063 pares distintos; funciona sin Internet. Que una línea tenga nombre no implica que el motor la considere óptima. Las jugadas de libro quedan fuera del cálculo de precisión y de los momentos mejores/críticos. Las revisiones guardadas se decoran al abrirlas sin perder sus evaluaciones.
- La precisión de Vienna es `100 × exp(-4 × pérdida media de expectativa)`. Es una estimación propia, no una medida oficial o estadísticamente calibrada para humanos.
- «Brillante» reconoce una oferta de pieza de valor mínimo 3 que, si se acepta legalmente, cuesta al menos un punto material después de las recapturas óptimas en esa casilla. Puede ofrecerse una pieza distinta de la que se mueve, por ejemplo dejando la dama capturable al preparar un tenedor de caballo. En ese caso exige que la jugada cambie el coste del intercambio: dejar una pieza ya colgada con exactamente la misma exposición no vuelve a contar como sacrificio. El rival puede rechazarla, y la compensación táctica en otra casilla no invalida el sacrificio. También reconoce una aceptación demorada de la pieza movida en la continuación durante las primeras tres respuestas, si esa pieza no vuelve a moverse. Exige profundidad mínima 16, continuación legal, alternativas a la misma profundidad, pérdida inferior a 2 puntos porcentuales y expectativa propia mínima 0,455 (margen de equilibrio de aproximadamente medio peón). Normalmente, las otras opciones no deben mantener una expectativa de 0,90 o más. Se admite una excepción comprobable en posiciones ganadoras: la primera elección del motor ofrece sin capturar un caballo, alfil o torre con jaque directo y tenedor sobre la dama; todas las capturas legales de esa pieza permiten mate en una y todas las respuestas que la rechazan permiten capturar rentablemente la dama con esa pieza. Exige una expectativa propia mínima de 0,90 y descarta posiciones donde ya había mate en una. Conserva los controles de profundidad, continuación legal y coste material. Tiene prioridad sobre Genial. Un intercambio equivalente no cumple el criterio. Es una heurística propia: las aceptaciones tardías de otras piezas pueden pasar desapercibidas. La exploración de intercambios está limitada a 256 nodos; evidencia incompleta no otorga la etiqueta. No hay un cupo máximo por partida: varios sacrificios distintos y correctos pueden merecerla.
- «Genial» exige ser la primera elección, alternativas a la misma profundidad mínima 16 y una diferencia de al menos 15 puntos porcentuales frente a la mejor alternativa disponible. Además debe conservar una expectativa de al menos 0,50 cuando las alternativas quedan por debajo, o al menos 0,75 cuando las alternativas no alcanzan ese valor. No basta con ser menos mala en una posición perdida, ni con ser mejor cuando las otras opciones también mantienen una posición ganadora. Los valores 0,75/0,90 y los filtros de evidencia son decisiones locales de Vienna; no son parámetros publicados de Chess.com. Con MultiPV 1 no se asignan Brillante ni Genial. Cambiar profundidad, tiempo o alternativas puede cambiar estas categorías sin que la jugada deje de ser la mejor.
- «Oportunidad perdida» identifica un error del jugador que desaprovecha una ventaja ganadora recién concedida por el rival. Exige evidencia de tres posiciones consecutivas y profundidad mínima 16: antes del error rival la expectativa propia era inferior a 0,75; después alcanza al menos 0,75 y mejora al menos 10 puntos porcentuales; tras la jugada del jugador queda en 0,55 o menos. La jugada anterior del rival debe diferir de la primera elección del motor. Valida las jugadas y posiciones, y exige profundidad coincidente para las candidatas comparadas dentro de cada búsqueda. Solo sustituye Imprecisión, Error o Grave error; no modifica Brillante, Genial, Libro, Mejor, Excelente o Buena. Conserva la pérdida y la precisión. Estos umbrales son propios de Vienna; una búsqueda más profunda puede cambiar la evidencia y la etiqueta.
- No se afirma reproducir el algoritmo privado: Chess.com usa un modelo de expectativa y reglas especiales dependientes del Elo; Vienna usa una curva pública basada en partidas humanas, sin adaptación al Elo. Por eso los mismos límites no garantizan las mismas etiquetas. La precisión conserva su fórmula propia; cambiar el modelo de pérdidas también actualiza los porcentajes al abrir las revisiones antiguas.
- Las categorías comparan la jugada realizada con las alternativas de la misma búsqueda cuando está entre ellas. La primera elección no se degrada porque un nuevo cálculo de la posición siguiente cambie la evaluación. Si no existe esa candidata, se usa la evaluación posterior como estimación. Las reglas llevan su propia versión y las etiquetas antiguas se actualizan al abrir sin recalcular ni borrar las posiciones.
- En la barra lateral, Analizando muestra la partida abierta con el formato de los accesos recientes, incluidos resultados, antigüedad y estado de revisión; también incluye partidas antiguas fuera de las últimas cinco. Un fondo verde destaca la partida seleccionada. En escritorio hay tres columnas alineadas: tablero; Análisis y Resumen; Evaluación y Continuaciones. Resumen conserva las pestañas Revisión y Movimientos y aprovecha el espacio de la antigua tarjeta Explicación. Su encabezado muestra la jugada actual y la categoría, con un botón ⓘ para abrir la explicación bajo demanda. Se cierra con Escape, la ×, al pulsar fuera o al cambiar de posición; no desplaza tarjetas. Las flechas del tablero se desactivan cuando no existe destino en la dirección correspondiente, respetando la partida original, la variante y la rama elegida del modo libre. Los botones y el teclado usan los mismos límites. Revisión muestra precisión y recuentos solo al completar el análisis. Los errores aparecen en la campana y no desplazan las tarjetas.
- Explicación es una tarjeta independiente, con el mismo fondo que las otras tarjetas y altura estable de 160 px. Muestra únicamente la jugada seleccionada, su categoría y explicación; el texto aprovecha todo el alto disponible sin reservar una franja para acciones. La posición inicial muestra una indicación breve. El retorno único bajo el tablero usa solo una flecha, del mismo tamaño que los controles de navegación, en blanco al estar disponible y sin fondo ni parpadeo; su tooltip indica el contexto, la posición de destino y el atajo Esc. La lista y las explicaciones largas se desplazan en sus propias áreas, sin cambiar la altura exterior de las tarjetas. Los niveles de análisis se eligen mediante opciones en línea; solo la bola marca la selección y se conserva la opción personal configurada. Analizada y el nombre del nivel entre paréntesis aparecen en una sola línea, por ejemplo Analizada (Máximo). Al abrir la partida se selecciona su nivel guardado; Reanalizar queda desactivado mientras coincida y se activa al elegir otro. Las oportunidades perdidas usan una explicación breve también en revisiones guardadas, sin recalcular categorías ni evaluaciones. El conjunto de capturas permanece centrado en la barra del jugador al añadir piezas.
- Continuaciones muestra primero la jugada realizada, seguida de hasta cinco candidatas; cuando procede de la posición siguiente se identifica como Evaluación posterior. Una estrella identifica la primera elección del motor. Los fondos claros/oscuros de puntuación indican ventaja blanca/negra, usando los mismos colores que las tarjetas de precisión. La barra sitúa la puntuación en el lado favorecido. Las revisiones antiguas mantienen las líneas con las que se guardaron hasta reanalizar. Al pasar el ratón o enfocar una línea se muestra una sola flecha del acento del tema, más gruesa; al salir se restauran las flechas automáticas configuradas.
- Evaluación conserva puntos circulares al redimensionarse. Mínimo y máximo usan siempre la perspectiva blanca y excluyen mates. Tu ventaja cuenta posiciones con al menos medio peón a favor del jugador de la cuenta, incluyendo mates a favor; su tooltip explica el porcentaje.
- Los perfiles muestran las piezas capturadas en la rama actual y la ventaja material (peón 1, caballo/alfil 3, torre 5, dama 9). La posición inicial estándar no muestra flechas ni líneas del motor; aparecen tras la primera jugada de blancas y se ocultan al volver al inicio. Las posiciones iniciales personalizadas conservan sus sugerencias. Los controles de flecha 1 y 2 funcionan de forma independiente, también desde Ajustes: mejor opción verde, segunda del mismo verde más fina. Las flechas propias de clic derecho son naranjas y continuas, con casillas marcadas también en naranja; la vista previa de una continuación usa ese mismo verde con mayor grosor y sustituye temporalmente las flechas automáticas. Las variantes se conservan en el árbol local y se puede volver a la partida original; no hay una pestaña de gestión de variantes. Una revisión completa muestra Analizada y su nivel; permite repetirla mediante Reanalizar al elegir otro nivel.
- Las explicaciones se limitan a hechos obtenidos del motor. No se generan relatos tácticos no demostrados.
- Una revisión parcial se guarda después de cada posición. Si se repite una partida ya analizada, el progreso se escribe en review-drafts y la revisión completa anterior se conserva hasta finalizar; cancelar restaura también ese resumen en pantalla. Al repetirla, la caché compatible permite continuar sin recalcular las posiciones ya terminadas.

## Datos locales

En Windows, Tauri guarda `vienna.sqlite3` en `%APPDATA%\app.vienna.chess\`. En desarrollo web se utiliza `.vienna-dev/vienna.sqlite3`, separada de los datos de escritorio. Los ensayos de integración usan directorios aislados dentro de `test-results/`.

SQLite almacena partidas y PGN, árboles de variantes, configuración, usuario, revisiones, categorías, líneas y posiciones calculadas. No hay telemetría ni fuentes web remotas. Para una copia de seguridad, cierra Vienna y copia su carpeta de datos completa.

El estado «Analizada» de la biblioteca se obtiene con una consulta compacta de identificadores. No carga las líneas ni las posiciones de todos los análisis para actualizar los accesos recientes.

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

Vienna se distribuye bajo GPL-3.0-or-later por compatibilidad con Chessground. Las piezas Cburnett de Colin M. L. Burnett son abiertas. Stockfish es GPLv3 y su distribución oficial incluye el código correspondiente. Las fuentes son SIL OFL. Consulta `THIRD_PARTY_NOTICES.md` y `LICENSE`. Los iconos y el monograma de Vienna son originales. Los cuatro sonidos se basan en Impact Sounds de Kenney (CC0-1.0); las fuentes PCM, el generador, la procedencia y las licencias están incluidos. No se usan logos, piezas ni recursos gráficos de Chess.com.

La compilación normal (`npm run package`) contiene exclusivamente los sonidos de madera CC0. La compilación personal (`npm run package:personal`) usa recursos privados que quedan fuera del repositorio y de la exportación pública. Consulta [PUBLISHING.md](docs/PUBLISHING.md) para preparar la copia de GitHub sin datos de usuarios y [DISTRIBUTION.md](docs/DISTRIBUTION.md) para las condiciones de distribución.

Puedes [apoyar el desarrollo de Vienna en Buy Me a Coffee](https://buymeacoffee.com/magicnube). El enlace también está al pie de Ajustes y se abre en el navegador, sin enviar la cuenta ni las partidas a esa página.

Fuentes verificadas para esta implementación: [Tauri](https://v2.tauri.app/start/prerequisites/), [Stockfish 19](https://github.com/official-stockfish/Stockfish/releases/tag/sf_19), [documentación UCI](https://official-stockfish.github.io/docs/stockfish-wiki/UCI-&-Commands.html), [chess.js](https://github.com/jhlywa/chess.js), [Chessground](https://github.com/lichess-org/chessground) y [PubAPI](https://www.chess.com/news/view/published-data-api). Las versiones exactas quedan fijadas en `package-lock.json` y `src-tauri/Cargo.lock`.

## Primer inicio y cambio de cuenta

Solo hay apariencia oscura. Si una versión anterior guardó el modo claro, la preferencia se elimina al cargar los ajustes.

En una instalación nueva, Vienna solicita el nickname de Chess.com sin contraseña y descarga los dos archivos mensuales públicos más recientes. Descarga y análisis son procesos separados: el historial anterior no se encola automáticamente. Cada cuenta guarda la fecha de su primera activación automática; solo las partidas terminadas desde esa fecha son candidatas, incluyendo las jugadas mientras la app estaba cerrada que sigan dentro de los archivos descargados. Una revisión completa compatible se conserva y no vuelve a encolarse. Los análisis antiguos se pueden solicitar manualmente.

Al cambiar el nickname, las últimas cinco corresponden a la nueva cuenta y, tras descargar, se abre su partida más reciente. La biblioteca local conserva las partidas y análisis anteriores; Mis partidas, últimas cinco y Estadísticas muestran solo las partidas de la cuenta activa. El historial de la nueva cuenta no se interpreta como una nueva tanda de partidas para analizar. Los trabajos que ya estaban en cola continúan de uno en uno.

Para una prueba privada en Windows x64, el archivo preparado es `.vienna-private/builds/Vienna.exe`: instalador completo con motor y sonidos privados, sin base de datos, nickname ni partidas personales. No basta con copiar el `vienna.exe` de la carpeta de compilación. La compilación pública sigue siendo independiente de los recursos privados.

Los perfiles de procesamiento usan estos límites (los hilos efectivos pueden ser menores según el equipo):

| Perfil | Hilos hasta | Hash | Líneas | Interactivo | Profundidad máxima | Tiempo por posición |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Bajo | 1 | 64 MB | 2 | 150 ms | 16 | 150 ms |
| Medio | 2 | 128 MB | 3 | 500 ms | 20 | 500 ms |
| Alto | 4 | 256 MB | 4 | 1 s | 24 | 2 s |
| Máximo | 8 | 512 MB | 5 | 2 s | Sin límite | 5 s |

El perfil ajusta también el tiempo automático. La búsqueda termina al alcanzar su límite de tiempo o de profundidad. Personalizado conserva cualquier combinación editable. Los ajustes existentes no se sustituyen automáticamente al instalar esta versión.

## Ventana principal

En escritorio, la ventana principal usa una barra fina del color del tema, sin nombre ni icono visibles. Conserva el título Vienna para el sistema, los controles de minimizar/maximizar/restaurar/cerrar y una región de arrastre. Los controles permanecen disponibles con los diálogos abiertos; el visor de aperturas mantiene la barra nativa. La altura de la barra se descuenta del espacio del tablero. Esta barra no se muestra en el desarrollo web normal.
