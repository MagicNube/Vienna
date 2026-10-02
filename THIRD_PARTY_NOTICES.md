# Componentes y atribuciones

- **Stockfish 19**, autores y colaboradores de Stockfish. GPL-3.0. Binario sin modificaciones del lanzamiento oficial `sf_19`. El instalador incluye el paquete descomprimido con `Copying.txt`, `AUTHORS`, `src/` y la documentación de compilación. Fuente: https://github.com/official-stockfish/Stockfish/tree/sf_19. La procedencia y el SHA-256 del archivo oficial se conservan en `provenance.json`.
- **Chessground**, Lichess contributors. GPL-3.0-or-later. Se usa el paquete mantenido `@lichess-org/chessground`, no el paquete obsoleto `chessground`. https://github.com/lichess-org/chessground
- **Piezas Cburnett**, Colin M. L. Burnett. SVG del conjunto distribuido por Chessground. Disponibles bajo GPL y otras licencias libres a elección del autor; Vienna las utiliza bajo GPL. https://commons.wikimedia.org/wiki/Category:SVG_chess_pieces
- **chess.js**, Jeff Hlywa y colaboradores. BSD-2-Clause. https://github.com/jhlywa/chess.js
- **Chess opening names**, Lichess contributors. CC0-1.0. https://github.com/lichess-org/chess-openings. El catálogo local conserva la revisión exacta en `frontend/chess/data/provenance.json`; licencia en `licenses/chess-openings-CC0.txt`.
- **React / React DOM**, Meta y colaboradores. MIT. https://github.com/facebook/react
- **Tauri**, The Tauri Programme within the Commons Conservancy y colaboradores. MIT/Apache-2.0. https://github.com/tauri-apps/tauri
- **DM Sans**, DM Sans Project Authors. SIL Open Font License 1.1. Se distribuye localmente mediante Fontsource. https://github.com/googlefonts/dm-fonts
- **Manrope**, Manrope Project Authors. SIL Open Font License 1.1. Se distribuye localmente mediante Fontsource. https://github.com/sharanda/manrope
- **SQLite**, dominio público; **rusqlite**, MIT; **Tokio**, MIT; **Serde**, MIT/Apache-2.0; **Reqwest**, MIT/Apache-2.0; **RustCrypto sha2**, MIT/Apache-2.0. Las dependencias exactas figuran en Cargo.lock.
- **Vite**, MIT; **TypeScript**, Apache-2.0; **Vitest**, MIT; **Fontsource**, MIT para el empaquetado (las tipografías conservan OFL). Herramientas de desarrollo, no servicios de análisis.

Los avisos de licencia completos de las dependencias frontend se conservan en `licenses/`, junto con la licencia de Vienna. Las partidas de Chess.com son datos públicos solicitados a su PubAPI; las marcas identifican únicamente el origen de los datos. Vienna es un proyecto independiente, sin afiliación con Chess.com.

Los cuatro sonidos predeterminados son síntesis original creada para Vienna, sin grabaciones ni muestras de otros servicios. Se dedican mediante CC0-1.0. Generador: `scripts/generate-sounds.mjs`; procedencia y SHA-256: `public/sounds/default/provenance.json`; licencia completa: `licenses/Vienna-Sounds-CC0.txt`.

Las compilaciones personales pueden incorporar recursos privados que no forman parte de este repositorio ni de la GPL/CC0. Sus avisos específicos se adjuntan exclusivamente a esa compilación. Los sonidos cargados por cada usuario tampoco forman parte de esta distribución.
