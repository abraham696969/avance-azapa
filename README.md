# Divertí Kids · Plataforma web de reservas con simulador 3D

Proyecto de título y práctica profesional de Abraham Zambrano Pérez (Ingeniería en Informática, Santo Tomás Arica).
Plataforma web para Divertí Kids, empresa de arriendo de juegos y servicios para fiestas infantiles en el Valle de Azapa, Arica.

- **Sitio de clientes** (`index.html`): catálogo, disponibilidad por fecha y franja, simulador 3D de la parcela, cotización, reserva con pago del abono (30 %) a través del sitio, arriendo a domicilio, ofertas y chatbot.
- **Panel de administración** (`admin.html`): reservas, clientes, cumpleaños, balance mensual, ofertas, domicilio, servicios y terreno.
- **Tecnologías** (todas gratuitas): HTML, CSS y JavaScript sin framework; three.js; Supabase (PostgreSQL, Auth, Storage, Edge Functions); Flow; SheetJS.

La instalación paso a paso está en [INSTRUCCIONES.md](INSTRUCCIONES.md). Sin claves en `config.js`, el sitio funciona en **modo demostración** (datos en el navegador y pago simulado).

## Avance por semana

| Semana | Fechas (2026) | Avance |
|---|---|---|
| 1 | 6 al 9 de octubre | Levantamiento de información, planificación (Scrumban), entorno de desarrollo, esqueleto inicial, catálogo y agenda. |
| 2 | 12 al 16 de octubre | Identidad Divertí Kids y diseño adaptable, panel de administración con acceso propio, base de datos con seguridad y guía de instalación. |
| 3 | 19 al 23 de octubre | Gestión de servicios, chatbot (30/30 en la prueba), pago del abono con Flow, fotos y modelos 3D por servicio, terreno editable con la parcela real. 122 comprobaciones automáticas. |
| 4 | 26 al 30 de octubre | A pedido de la empresa: datos del niño o niña con consentimiento, cartera de clientes, cumpleaños y propuestas por WhatsApp, balance mensual, exportación a Excel, ofertas, redes sociales y arriendo a domicilio. 189 comprobaciones automáticas. |
| 5 | 2 al 6 de noviembre | En curso. |

El detalle de cada versión está en el historial de este repositorio.

## Próximos avances

**Semanas 5 y 6**
- [ ] Conectar Supabase y Flow en modo de pruebas (sandbox) y probar todo de punta a punta.
- [ ] Probar el sitio en celulares reales (Android e iOS) y abrir en Excel los archivos exportados.
- [ ] Cargar los servicios y las tarifas de despacho reales de la empresa.
- [ ] Revisar la privacidad y el consentimiento con un especialista (Ley 21.719).

**Semanas 7 a 10** (según la inscripción del tema)
- [ ] Publicar el sitio en internet.
- [ ] Pruebas de aceptación con la empresa (meta: al menos 90 % de los casos aprobados).
- [ ] Capacitación al personal y manual de usuario.
- [ ] Informe final y acta de cierre.

## Pruebas automáticas

Necesitan Node.js y Playwright. Cada prueba se corre con `node pruebas/<nombre>.test.mjs`; la lista completa y su propósito están en [INSTRUCCIONES.md](INSTRUCCIONES.md#pruebas-automáticas-opcional-para-quien-programe). Usan servicios simulados: todavía falta verificarlas contra Supabase y Flow reales.
