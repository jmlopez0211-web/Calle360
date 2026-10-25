CALLE360ONCE V15 · EDICIÓN DE LANZAMIENTO

Esta entrega amplía la base de CALLE360 conservando los módulos existentes: cartografía, agenda, rutas/visitas, compañeros, puntos de venta, incidencias, documentos, mensajes, informes, Parlanchín, accesibilidad y ayuda.

NOVEDADES V15
- Marca CALLE360ONCE y metadatos para dispositivos móviles.
- Aplicación web instalable (PWA) cuando el navegador y el alojamiento lo permiten.
- Caché de la interfaz local para abrir la carcasa de la app sin conexión después de una primera carga correcta.
- Aviso visible de conexión/desconexión y explicación de qué servicios necesitan Internet.
- Iconos de aplicación de 192 y 512 píxeles.
- Conserva las herramientas previas de cartografía y las consultas a fuentes públicas CDAU/DERA.
- Conserva migración de datos desde las claves antiguas c360_tasks, c360_visits, c360_contacts, c360_issues, c360_docs, c360_points y c360_messages hacia las claves nuevas, si no existen datos nuevos.
- Las copias JSON y las exportaciones de puntos siguen siendo locales; los datos no se envían a un servidor.

PUBLICACIÓN EN GITHUB PAGES
1. Descarga y descomprime el ZIP.
2. En el repositorio jmlopez0211-web/Calle360, conserva una copia de la versión actual.
3. Sube index.html, manifest.webmanifest, sw.js e icons/ a la raíz del repositorio main (mantén exactamente los nombres y la carpeta icons).
4. Espera a que GitHub Pages termine de desplegar.
5. Abre https://jmlopez0211-web.github.io/Calle360/ y prueba en móvil.
6. Si el navegador mantiene una versión antigua, recarga la página o borra los datos del sitio; el service worker puede conservar la interfaz anterior hasta actualizarse.

LIMITACIONES Y PRIVACIDAD
- La caché offline solo guarda la interfaz y los iconos. No almacena mapas externos, búsquedas, rutas ni datos en la nube.
- Los datos se guardan en el almacenamiento local del navegador. No existe sincronización multiusuario ni autenticación de servidor en esta edición.
- Los datos de compañeros y puntos de venta reales deben introducirse únicamente si se dispone de autorización. No se incluyen datos privados reales.
- Los mapas y las rutas dependen de proveedores externos; las rutas son orientativas, no certificadas para accesibilidad y sin tráfico en tiempo real.
- El uso del nombre CALLE360ONCE no implica afiliación oficial ni respaldo de la ONCE. Antes de distribuirla públicamente, verifica las autorizaciones de marca y uso institucional.
- La accesibilidad debe probarse con usuarios y tecnologías de asistencia; esta entrega no constituye certificación WCAG.

PRUEBAS DE ESTA ENTREGA
- Sintaxis JavaScript de todos los scripts inline.
- Identificadores HTML duplicados.
- Estructura e integridad del ZIP.
- Comprobación de carga en Chromium headless con recursos externos bloqueados; no equivale a una prueba completa de mapas, rutas, instalación ni lectores de pantalla.
