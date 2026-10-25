# Recordar hoy

Una intención cada día y recordatorios para vivirla con Dios.

- Cada mañana, entre 6:30 y 9:00 (hora de cada persona), llega la pregunta "¿Qué quieres recordar hoy?".
- La persona escribe su intención y recibe esa frase 4 veces en horas al azar, hasta las 9:30 p. m.
- Su camino (intenciones, reflexiones y días seguidos) se guarda en su propio teléfono.

## Publicarla en Netlify (gratis)

1. Crea un repositorio nuevo en GitHub y sube todo el contenido de esta carpeta (menos `node_modules`, si existe).
2. En Netlify: **Add new site → Import an existing project → GitHub** y elige el repositorio.
3. Deja todo como viene (Netlify lee `netlify.toml`) y toca **Deploy**.

No hay que configurar llaves ni variables: la app crea sola sus llaves de notificación la primera vez.

## Cómo la usa la gente

- **iPhone (iOS 16.4 o más reciente):** abrir el enlace en Safari → Compartir → Agregar a inicio → abrir desde el ícono → Activar notificaciones. Apple exige este paso para permitir notificaciones de una web.
- **Android:** abrir el enlace en Chrome → Activar notificaciones. (Opcional: instalarla en la pantalla de inicio.)

## Archivos

- `public/` — la app (página, service worker, íconos, manifest).
- `netlify/functions/api.mjs` — guarda suscripciones e intenciones.
- `netlify/functions/tick.mjs` — corre cada 5 minutos y envía las notificaciones que ya tocan.
- `netlify/lib/core.mjs` — utilidades compartidas (llaves, zonas horarias).
