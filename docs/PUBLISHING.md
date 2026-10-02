# Publicación del código

`npm run export:github` crea una carpeta nueva en `exports/` mediante una lista explícita de rutas de código. Esa carpeta es la que se debe subir al repositorio; el espacio de desarrollo original conserva los datos del usuario.

Se excluyen SQLite, cachés, preferencias, fotos y sonidos cargados por el usuario, `.vienna-private/`, instaladores, dependencias descargadas, capturas locales e informes con partidas personales. Los ejemplos de cuenta en pruebas se sustituyen por nombres ficticios. La regresión del sacrificio de alfil conserva solo posiciones/evidencia anónima, sin el PGN original. EXPORT-MANIFEST.json documenta los archivos y sus SHA-256. Antes de publicar una futura exportación, revisar también cualquier recurso nuevo añadido a las rutas públicas.

## Compilación pública

```text
npm ci
npm run engine:install
npm test
npm run package
```

Sonidos originales CC0, código GPL-3.0-or-later y atribuciones incluidas. No contiene cuentas ni partidas guardadas de ningún usuario. El catálogo de aperturas y las posiciones aisladas de pruebas son recursos del programa, no bases de usuarios.

## Compilación personal

`npm run package:personal` requiere los cuatro MP3 ya existentes en `.vienna-private/sounds/chesscom/`: move-self.mp3, capture.mp3, move-check.mp3 y game-end.mp3. Se incorporan solo al construir en modo personal. Si faltan, la compilación falla; no descarga sonidos de terceros. Esta compilación es de uso personal y no debe adjuntarse a una release pública. La compilación normal nunca incorpora esa carpeta.

Las preferencias del programa permiten cargar un sonido propio para cada efecto. Los archivos se validan y convierten a WAV mono local de hasta 3 segundos; se conservan en SQLite y no forman parte del código ni de su exportación. Restaurar elimina la selección propia y recupera el predeterminado de la edición instalada.
