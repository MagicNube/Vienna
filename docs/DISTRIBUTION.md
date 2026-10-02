# Distribución de Vienna

Revisión del 30 de septiembre de 2026. Estado técnico comprobado: Windows x64, instalador NSIS local; no publicación ni firma configuradas. El servidor de Vite y su puente Rust son herramientas de desarrollo, no un servicio para usuarios finales.

## Arquitectura y costes

El instalador ejecuta Stockfish y SQLite en el equipo de cada usuario. El número de usuarios no aumenta una factura de cálculo del desarrollador. No hay cuotas de partidas en el programa; CPU, memoria, espacio local y tiempo disponible son los límites prácticos. Las importaciones PGN y el análisis funcionan sin conexión. La descarga de partidas públicas necesita Internet.

Una distribución inicial puede alojar código e instaladores en [GitHub Free](https://github.com/pricing) y [GitHub Releases](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases), sin contratar un servidor de análisis. El dominio propio, firma de ejecutables, soporte y mantenimiento son costes separados. No se ha elegido ni contratado un proveedor de firma. [Tauri documenta la firma de Windows](https://v2.tauri.app/distribute/sign/windows/): firmar identifica al editor, pero un certificado nuevo tampoco garantiza ausencia inmediata de avisos de SmartScreen.

El consumo local depende de Ajustes. Hash es por proceso; revisión e interactivo pueden coexistir, cada uno con sus hilos, memoria y redes del motor. Las partidas de la cola se revisan secuencialmente. Un equipo modesto debe usar menos hilos y menor Hash; el valor automático de hilos ya se adapta al número de procesadores lógicos, con un máximo de ocho.

Subir solamente `dist/` a una web no convierte esta versión en una aplicación independiente: faltan los comandos nativos y SQLite. Una versión que funcione sin instalar requeriría motor WebAssembly, trabajadores del navegador y almacenamiento del navegador. Es un proyecto adicional, no una opción de despliegue de la compilación actual.

## Recursos y condiciones que revisar antes de publicar

- **Sonidos:** la compilación pública incluye cuatro efectos originales de síntesis, CC0-1.0, con generador y procedencia. No incluye sonidos de Chess.com. La edición personal utiliza una carpeta privada excluida de GitHub y lleva avisos específicos; no debe publicarse. Las [condiciones de Chess.com](https://www.chess.com/legal/user-agreement), sección 2, reservan los derechos de sus recursos. Los archivos cargados por cada usuario permanecen en su base local.
- **Interfaz:** código, logo e iconos de Vienna son locales; piezas, tablero y fuentes proceden de proyectos abiertos documentados en THIRD_PARTY_NOTICES.md. Esto no constituye una certificación jurídica de independencia visual; antes de un lanzamiento comercial conviene revisar también marcas y similitud del conjunto.
- **Datos:** la [PubAPI oficial](https://support.chess.com/en/articles/9650547-what-is-the-pubapi-and-how-do-i-use-it) permite consultar datos públicos y documenta caché y límites de solicitudes. No concede una garantía de acceso ilimitado ni resuelve por sí sola los usos competitivos o comerciales: las condiciones generales actuales restringen extracción automatizada para productos competidores. Aclarar por escrito el alcance de la integración si se publica con esa finalidad; conservar importación PGN como alternativa.
- **GPL:** el proyecto está declarado GPL-3.0-or-later por [Chessground](https://github.com/lichess-org/chessground#license). Publicar u ofrecer a los destinatarios el código fuente correspondiente de Vienna, con instrucciones y licencias. [Stockfish](https://github.com/official-stockfish/Stockfish#terms-of-use) exige conservar licencia y fuente correspondiente a su binario; ya se incluyen recursos y procedencia del paquete oficial. Las licencias abiertas no autorizan recursos privados de otras plataformas.

## Preparación técnica del primer lanzamiento

1. Resolver los recursos y condiciones anteriores.
2. Crear un repositorio y una versión identificable, sin bases de usuarios, resultados de pruebas, certificados ni secretos.
3. Ejecutar pruebas, compilación y empaquetado; probar instalación y actualización en Windows x64 independiente del equipo de desarrollo.
4. Publicar el código fuente correspondiente y el instalador de esa versión, sus licencias y una suma SHA-256 verificable.
5. Elegir firma de código y, si se desea, actualización automática. El plugin de actualizaciones de Tauri todavía no está instalado ni configurado; no prometerlo en la descarga.

Windows x64 es la única plataforma empaquetada y verificada. macOS, Linux, Windows ARM64, firma, actualización automática e instalación en un equipo externo no están verificados en esta revisión.
