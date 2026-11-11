# Divertí Kids · Desarrollo e implementación de un ecosistema digital integral para la gestión y visualización 3D de servicios de eventos infantiles

Proyecto de título y práctica profesional de Abraham Zambrano Pérez (Ingeniería en Informática, Santo Tomás Arica).
Plataforma web para Divertí Kids (Entretenciones Francisco Javier Hernández Gibbs EIRL), empresa de arriendo de juegos y servicios para fiestas infantiles en el Valle de Azapa, Arica.

**Sitio publicado:** https://diverti-kids.up.railway.app (panel: `/admin.html`). Publicado el 9 de noviembre de 2026 en el período de prueba de Railway, con el pago en el ambiente de pruebas de Flow (sin cobros reales).

- **Sitio de clientes** (`index.html`): cinco páginas (Inicio, Juegos y servicios, Arma tu fiesta, Reservar y Contacto) con catálogo, disponibilidad por fecha y franja, simulador 3D de la parcela, cotización, reserva con pago del abono (30 %) a través del sitio, arriendo a domicilio, ofertas y chatbot.
- **Panel de administración** (`admin.html`): reservas, clientes, cumpleaños, balance mensual, ofertas, domicilio, servicios y terreno.
- **Tecnologías:** HTML, CSS y JavaScript sin framework; three.js; servidor en Node.js (`server/index.mjs`) con base de datos PostgreSQL, alojados en **Railway** (plan Hobby a contratar por la empresa); pago con Flow; SheetJS.

La instalación paso a paso está en [INSTRUCCIONES.md](INSTRUCCIONES.md). Si se abren los archivos sin el servidor, el sitio funciona en **modo demostración** (datos de ejemplo en el navegador y pago simulado).

## Avance por semana

| Semana | Fechas (2026) | Avance |
|---|---|---|
| 1 | 6 al 9 de octubre | Levantamiento de información, planificación (Scrumban), entorno de desarrollo, esqueleto inicial, catálogo y agenda. |
| 2 | 12 al 16 de octubre | Identidad Divertí Kids y diseño adaptable, panel de administración con acceso propio, base de datos con seguridad y guía de instalación. |
| 3 | 19 al 23 de octubre | Gestión de servicios, chatbot (30/30 en la prueba), pago del abono con Flow, fotos y modelos 3D por servicio, terreno editable con la parcela real. 122 comprobaciones automáticas. |
| 4 | 26 al 30 de octubre | A pedido de la empresa: datos del niño o niña con consentimiento, cartera de clientes, cumpleaños y propuestas por WhatsApp, balance mensual, exportación a Excel, ofertas, redes sociales y arriendo a domicilio. 189 comprobaciones automáticas. |
| 5 | 2 al 6 de noviembre | La empresa decidió pagar Railway: el sitio pasó de Supabase a un servidor propio con PostgreSQL (login del panel, archivos y pago con Flow en el servidor). Rediseño del sitio en cinco páginas con los colores del logo y carrusel con las fotos de los juegos. 256 comprobaciones automáticas. |
| 6 | 9 al 13 de noviembre | En curso. Sitio publicado en Railway con su base PostgreSQL. Flow conectado en ambiente de pruebas: pago aprobado de punta a punta (reserva confirmada por el servidor). Pruebas funcionales en el sitio publicado y corrección de lo que encontraron (formulario sin datos de ejemplo, mensajes claros si Flow rechaza un dato, fecha liberada si el pago no se inicia y página sin campos de tarjeta). 262 comprobaciones automáticas. |

El detalle de cada versión está en el historial de este repositorio.

## Pruebas funcionales en el sitio publicado (9 y 11 de noviembre)

| Caso | Resultado |
|---|---|
| Publicar con la base de datos y entrar al panel | Aprobado (el primer intento falló por falta de la base; se agregó PostgreSQL) |
| Activar el pago en línea y pagar el abono en el ambiente de pruebas de Flow | Aprobado: abono del 30 % y reserva confirmada con número de orden de Flow |
| Reservar como un cliente nuevo | Falló (traía datos de ejemplo) → corregido |
| Correo que Flow no acepta | Falló (mensaje genérico y fecha apartada) → corregido |
| Abrir el sitio en Chrome | Falló (Google lo marcó como engañoso por el simulador de tarjeta del modo demo) → corregido; falta pedir la revisión a Google |
| Publicación automática desde GitHub | Pendiente: permiso entre Railway y GitHub; mientras tanto se publica a mano |
| Uso en celulares Android e iOS | Pendiente |

## Próximos avances

**Semana 6**
- [x] Publicar en Railway (servidor + PostgreSQL) y conectar Flow en modo de pruebas; probar el pago de punta a punta.
- [ ] Pedir a Google la revisión del sitio (Search Console).
- [ ] Corregir el permiso de Railway en GitHub para que vuelva a publicar solo.
- [ ] Probar el sitio en celulares reales (Android e iOS) y abrir en Excel los archivos exportados.
- [ ] Cargar los servicios, fotos y tarifas de despacho reales de la empresa.
- [ ] Revisar la privacidad y el consentimiento con un especialista (Ley 21.719).

**Semanas 7 a 10** (según la inscripción del tema)
- [ ] Contratar el plan Hobby de Railway antes de que venza el período de prueba y abrir la cuenta comercial de Flow de la empresa.
- [ ] Publicar el sitio para los clientes (dominio definitivo).
- [ ] Pruebas de aceptación con la empresa (meta: al menos 90 % de los casos aprobados).
- [ ] Capacitación al personal y manual de usuario.
- [ ] Informe final y acta de cierre.

## Pruebas automáticas

Necesitan Node.js, Playwright y PGlite (PostgreSQL en memoria). Cada prueba se corre con `node pruebas/<nombre>.test.mjs`; la lista completa y su propósito están en [INSTRUCCIONES.md](INSTRUCCIONES.md#pruebas-automáticas-opcional-para-quien-programe). Son 13 suites con 262 comprobaciones; el servidor se prueba con una base PostgreSQL real en memoria y un Flow simulado que, como el real, rechaza correos no válidos.
