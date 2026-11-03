# CALLE360 COMMAND CENTER — fase de rediseño personal

Fecha: 3 de noviembre de 2026  
Rama: `development/personal-app-audit`  
Rama principal: `main` — sin cambios ni despliegue.

## Objetivo

Convertir CALLE360 en un centro de operaciones de uso individual para gestionar contactos, ubicaciones y visitas. No se incorporan cuentas, colaboración, perfiles públicos ni sincronización entre usuarios.

## Cambios incluidos en esta fase

- Interfaz oscura de centro de operaciones: azul noche, cian, paneles compactos y mapa protagonista.
- Distribución adaptable: navegación lateral y paneles de indicadores en escritorio; navegación compacta y mapa optimizado en móvil.
- Panel superior de actividad: contactos, ubicaciones guardadas, visitas realizadas y pendientes.
- Importación voluntaria de contactos desde el selector del navegador cuando esté soportado y mediante archivo VCF como alternativa.
- Búsqueda local de contactos por nombre, teléfono, correo o dirección.
- Creación de una ficha de compañero desde un contacto importado.
- Colocación de marcador: el usuario selecciona el punto exacto en el mapa; no se inventan coordenadas.
- Marcadores visualmente diferenciados para compañeros y otros puntos.
- Planificación de visita desde la ficha del contacto.
- Acciones para llamar y abrir navegación externa cuando exista una ubicación guardada.
- Caché PWA v16 con los nuevos módulos CSS y JavaScript.
- Pruebas estáticas automatizadas con Node.js en GitHub Actions. El flujo no contiene pasos de despliegue.

## Privacidad y datos

Los contactos y registros se guardan en `localStorage` del navegador. La importación requiere selección explícita. No se envía la agenda a un servidor propio ni se añade sincronización remota. El mapa usa OpenStreetMap y, al buscar direcciones o abrir navegación, se contacta con proveedores externos; sus políticas de privacidad se aplican a esas consultas.

## Verificaciones realizadas en esta revisión

- Sin IDs HTML duplicados.
- Sin referencias estáticas a IDs inexistentes en el HTML principal.
- Los cuatro bloques JavaScript inline pasan la comprobación de sintaxis.
- `personal.js` y `sw.js` pasan la comprobación de sintaxis.
- Los recursos personales están enlazados desde el HTML y declarados en el service worker.
- La versión de caché cambió a `calle360once-shell-v16`.
- Manifiesto PWA enlazado una sola vez.
- La rama principal no ha sido modificada.

## Pendiente de validación real

No se puede certificar desde una comprobación estática el selector nativo de contactos, permisos de geolocalización, teselas del mapa, instalación/actualización PWA, modo sin conexión ni el diseño en todos los tamaños de pantalla. El selector de contactos depende del navegador y de HTTPS; el VCF es la alternativa. Estas pruebas requieren abrir la aplicación desde un navegador real en Android y en iOS.

## Estado

Rediseño y mejoras implementadas en rama aislada. No publicar ni fusionar hasta que las pruebas automatizadas y las comprobaciones manuales estén completadas.


## Fase de mejora: Málaga y mapa claro

- Málaga se coloca al principio de los selectores de provincia y de la guía turística.
- La vista inicial del mapa se centra en Málaga (36.7213, -4.4214), con zoom 12.
- La cartografía vuelve a su color natural: se elimina el filtro de inversión y oscurecimiento de las teselas. Los paneles de control conservan el azul noche.
- Al volver a la pestaña del mapa, Leaflet recalcula su tamaño y redibuja los marcadores.
- Los marcadores de compañeros permiten preparar una visita planificada y registrar una visita realizada.
- Las visitas planificadas guardan el identificador del compañero y desde el historial se puede volver a localizarlo.
- El registro de visita realizada escribe visita y contador del compañero con reversión si falla el almacenamiento.
- El service worker pasa a caché v17.
- Se amplían las pruebas de humo para cubrir Málaga, cartografía clara y vínculo de visitas.

## Verificación pendiente

La revisión de sintaxis y de referencias no demuestra que los mosaicos cartográficos, la geolocalización ni los eventos Leaflet funcionen en todos los navegadores. El mapa debe probarse en el teléfono después de actualizar la PWA. No se debe fusionar ni publicar la rama hasta completar la prueba visual y el flujo de contacto → marcador → visita planificada → visita realizada → historial.
