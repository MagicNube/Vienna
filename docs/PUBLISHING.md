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

Sonidos de madera de Kenney editados para Vienna (CC0), código GPL-3.0-or-later y atribuciones incluidas. No contiene cuentas ni partidas guardadas de ningún usuario. El catálogo de aperturas y las posiciones aisladas de pruebas son recursos del programa, no bases de usuarios.

El empaquetado público ejecuta `build:public`: verifica los SHA-256 de los cuatro WAV CC0 y rechaza MP3, carpetas personales, bases de datos, claves y referencias a sonidos privados en el código compilado. El enlace voluntario de apoyo es https://buymeacoffee.com/magicnube; el permiso Opener de escritorio está limitado a esa URL.

La verificación exige una cuenta inicial vacía, sin foto predeterminada, y comprueba la lista autorizada de recursos del instalador. Una instalación nueva crea una base sin perfil, partidas ni análisis. Actualizar o reinstalar conserva la base local; al abrir con una cuenta guardada se pregunta si continuar con ella o introducir otro nombre. No se sincroniza ni se encolan partidas antes de elegir. El inicio del análisis automático pertenece a cada apertura, sin reutilizar fechas persistidas. `test:integration` comprueba el primer arranque con una base aislada nueva.

El formulario oficial de sugerencias lleva un identificador público de Web3Forms en `frontend/api/feedback.ts`; no es un secreto de cuenta. La compilación funciona sin copiar variables locales. Para usar otro formulario se puede establecer `VITE_WEB3FORMS_ACCESS_KEY`; un valor explícitamente vacío activa únicamente la alternativa por correo. `.env.example` documenta esta opción; `.env.local` y los demás archivos de entorno locales no se exportan. Al cambiar el destinatario en una bifurcación, revisar también el correo y asunto de `feedback.ts` y el permiso `mailto:` de Tauri.

## Compilación personal

`npm run package:personal` requiere los cuatro MP3 ya existentes en `.vienna-private/sounds/chesscom/`: move-self.mp3, capture.mp3, move-check.mp3 y game-end.mp3. Se incorporan solo al construir en modo personal. Si faltan, la compilación falla; no descarga sonidos de terceros. Esta compilación es de uso personal y no debe adjuntarse a una release pública. La compilación normal nunca incorpora esa carpeta.

Las preferencias del programa permiten cargar un sonido propio para cada efecto. Los archivos se validan y convierten a WAV mono local de hasta 3 segundos; se conservan en SQLite y no forman parte del código ni de su exportación. Restaurar elimina la selección propia y recupera el predeterminado de la edición instalada.
