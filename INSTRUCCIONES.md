# Divertí Kids · Guía de instalación (paso a paso)

## Qué contiene esta carpeta

| Archivo | Para qué sirve |
|---|---|
| `index.html` | Sitio de **clientes** (servicios, fecha, simulador 3D, reserva, pago y chatbot). |
| `admin.html` | Panel de **administración** con su propio login: reservas, clientes, cumpleaños, balance, ofertas, domicilio, servicios y terreno. |
| `config.js` | Datos del negocio para el chatbot y las redes sociales. **No lleva claves.** |
| `server/index.mjs` | El **servidor**: entrega el sitio, guarda los datos en PostgreSQL, maneja el login del panel y cobra el abono con Flow. |
| `schema.sql` | Tablas, reglas y funciones de la base de datos. El servidor lo aplica solo al arrancar. |
| `package.json`, `railway.json` | Le dicen a Railway cómo instalar y arrancar el servidor. |
| `pruebas/` | Pruebas automáticas y el resultado de la prueba del chatbot. |
| `shared.js`, `app.js`, `admin.js`, `styles.css` | Código y estilos del sitio. No necesitas tocarlos. |

Sitio de clientes: `https://tu-sitio/` · Panel admin: `https://tu-sitio/admin.html`

---

## Modo demo (sin servidor ni pago real)

Si abres `index.html` directamente (sin el servidor), todo funciona en **modo demo**: los datos se guardan solo en ese navegador y el pago es simulado. En `admin.html` entras con **admin@divertikids.cl** y clave **admin1234** (solo es un trámite de la demo, no protege nada).

---

## Publicar en Railway (hosting + base de datos)

Railway aloja el servidor y la base de datos PostgreSQL en el mismo proyecto. **Tiene costo:** el plan Hobby incluye un crédito de uso mensual y cobra el uso adicional. Revisa el precio vigente en https://railway.com/pricing antes de contratarlo.

### Paso 1 · Cuenta
1. Entra a **https://railway.com** e inicia sesión con la cuenta de **GitHub** donde está el repositorio del sitio.
2. Activa el plan **Hobby** con el medio de pago de la empresa.

### Paso 2 · Crear el proyecto desde GitHub
1. **New Project** > **Deploy from GitHub repo**.
2. Elige el repositorio del sitio (por ejemplo `avance-azapa`). Si no aparece, da permiso a Railway para ver ese repositorio (es privado).
3. Railway detecta `package.json` e instala y arranca el servidor solo (`npm start`). El primer intento va a fallar porque aún falta la base de datos: es normal.

### Paso 3 · Agregar la base de datos
1. En el mismo proyecto: **+ New** (o **Create**) > **Database** > **PostgreSQL**.
2. Espera a que quede en verde.

### Paso 4 · Variables del servidor
Entra al servicio del sitio (no al de PostgreSQL) > **Variables** y agrega:

| Variable | Valor |
|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (es una referencia a la base del paso 3; si tu base tiene otro nombre, cámbialo) |
| `ADMIN_EMAIL` | el correo con que entrarás al panel |
| `ADMIN_PASSWORD` | una clave de **al menos 10 caracteres**. Para cambiarla más adelante, cambia esta variable: al reiniciar, la clave anterior deja de servir y se cierran las sesiones abiertas. |

Guarda: Railway vuelve a desplegar. Al arrancar, el servidor **crea las tablas solo** (`schema.sql`) con los 11 servicios de ejemplo; no hay que pegar SQL a mano.

### Paso 5 · Dirección pública
1. Servicio del sitio > **Settings** > **Networking** > **Generate Domain**. Railway entrega una dirección como `https://algo.up.railway.app`.
2. Comprueba que funciona: abre `https://tu-direccion/api/salud`; debe decir `{"ok":true}`.
3. Abre `https://tu-direccion/admin.html` y entra con `ADMIN_EMAIL` y `ADMIN_PASSWORD`. Arriba debe decir **Base de datos conectada**.
4. (Opcional) Si la empresa tiene un dominio propio, agrégalo en la misma sección y crea la variable `SITE_URL` con esa dirección, **sin** `/` al final.

Con esto ya funciona todo, y las reservas nuevas quedan **pendientes** para que el equipo valide el abono a mano. Para cobrar en línea, sigue el paso 6.

---

## Paso 6 · Cobrar en línea con Flow (modo pruebas primero)

Flow (https://www.flow.cl) procesa tarjetas y otros medios en Chile. La clave secreta de Flow vive **solo en el servidor** (variables de Railway), nunca en el sitio.

**Cómo funciona:** el cliente reserva y su cupo queda guardado **30 minutos** (estado `por_pagar`) > lo llevamos a Flow > Flow avisa al servidor > el servidor consulta a Flow el estado real del pago y, solo si está pagado y el monto coincide, pasa la reserva a `confirmada`. Si no paga en 30 minutos, el cupo se libera solo. El monto lo calcula el servidor; el navegador nunca lo decide.

### 6.1 · Cuenta de pruebas en Flow
1. Crea una cuenta en **https://sandbox.flow.cl** (ambiente de pruebas, no cobra dinero).
2. Obtén tu **API Key** y tu **Secret Key** de pruebas (ver "Credenciales de prueba" en https://developers.flow.cl). La Secret Key **no se comparte con nadie**.

### 6.2 · Variables en Railway
En el servicio del sitio > **Variables**:

| Variable | Valor |
|---|---|
| `FLOW_API_KEY` | tu API Key de pruebas |
| `FLOW_SECRET_KEY` | tu Secret Key de pruebas |

(`FLOW_API_URL` es opcional: por defecto usa el sandbox `https://sandbox.flow.cl/api`.)

Al guardar, el sitio activa solo el botón **Ir a pagar a Flow**: no hay que editar archivos. Flow avisará los pagos a `https://tu-direccion/api/flow/confirmacion`, que el servidor ya tiene listo.

### 6.3 · Probar
1. En el sitio, agrega un servicio, completa tus datos y pulsa **Pagar abono** > **Ir a pagar a Flow**.
2. Paga con los datos de prueba que Flow muestra en su ambiente de pruebas.
3. Al volver verás "¡Pago recibido! Reserva R-xxxx confirmada". En `admin.html` la reserva aparece **confirmada**.
4. Prueba también cancelar el pago en Flow: la reserva sigue `por_pagar` y se libera a los 30 minutos.

### 6.4 · Pasar a pagos reales
Pide a Flow habilitar tu cuenta comercial para producción y en Railway cambia `FLOW_API_KEY` y `FLOW_SECRET_KEY` por las reales y agrega `FLOW_API_URL` = `https://www.flow.cl/api`. El aviso de "ambiente de pruebas" desaparece solo.

> **Importante:** la firma de las llamadas y los avisos de Flow están verificados con la documentación de Flow y con un Flow simulado, pero **no contra el sandbox real** todavía. Haz el paso 6.3 antes de publicar. Los códigos de estado de pago que usa el sistema son los de Flow: 1 pendiente, 2 pagada, 3 rechazada, 4 anulada; confírmalo con tu primer pago de prueba.

---

## Actualizar el sitio
Cada cambio que se sube a la rama `main` del repositorio en GitHub se publica solo en Railway. Si el cambio trae tablas o columnas nuevas, el servidor actualiza la base al arrancar **sin borrar datos**.

## Administrar servicios y precios (panel admin)
En `admin.html`, sección **Agregar servicio** y **Servicios y precios**:
- **Agregar:** nombre, categoría, tipo en el simulador 3D, descripción, precio, unidades, medidas reales (ancho, largo, alto) y color. Aparece al instante en el catálogo, la cotización y el simulador 3D.
- **Editar:** botón *Editar* en la lista. Precio y unidades también se cambian directo en la tabla.
- **Eliminar:** lo oculta del sitio. Las reservas antiguas lo siguen mostrando con su nombre.
- El arriendo de la parcela no se puede eliminar.

## Clientes, cumpleaños, balance y ofertas (panel admin)

El panel tiene siete pestañas:

- **Reservas:** lo de siempre (estados, distribución 3D, bloqueo de fechas).
- **Clientes:** la cartera. Cada reserva del sitio agrega sola al apoderado, al niño, su nacimiento, el celular y lo que arrendó. También puedes **agregar a mano** clientes anteriores (formulario de abajo). Botón **Descargar Excel**: hojas *Clientes*, *Eventos* (ordenados por fecha, con el mes) y *Cumpleaños*.
- **Cumpleaños:** arriba, los cumpleañeros **destacados** (los que cumplen en los próximos 30 días o cumplieron hace menos de 15 y ya arrendaron algo). Abajo, las **propuestas por enviar**: aparecen hasta 35 días antes del cumpleaños. El botón *Enviar por WhatsApp* abre WhatsApp con el mensaje ya escrito (apoderado, niño, edad, ofertas vigentes y enlace al sitio); tú solo lo envías y luego pulsas *Marcar enviada* para que no se repita ese año. El texto del mensaje se puede editar (se guarda en ese navegador).
- **Balance:** por mes y año, según la fecha del evento: eventos, contratado, abonos, saldos cobrados, cobrado y por cobrar, con un Excel descargable. Regla: **Confirmada** = abono cobrado; **Finalizada** = el evento se hizo y el saldo se cobró (cámbiala a mano en *Reservas* cuando cobres el saldo); **Pendiente** = el abono aún no se valida; **Cancelada** no cuenta.
- **Ofertas:** el tablón de ofertas. Las activas y no vencidas se muestran en una sección del sitio (con botón a WhatsApp) y se incluyen en las propuestas de cumpleaños.
- **Domicilio:** zonas y precios de despacho, y los pedidos a domicilio próximos con los datos del lugar y sus alertas (ver «Arriendo a domicilio» más abajo).
- **Servicios y terreno:** el catálogo y el editor del terreno.

**Datos personales:** el sitio pide el nombre y la fecha de nacimiento del niño y una casilla de aceptación para guardarlos. Los datos solo los ve el equipo con sesión iniciada en el panel. Si un apoderado pide que borren sus datos, hay que eliminarlos en la base de datos de Railway (tablas *reservas* o *clientes_extra*); pídeselo a quien administre el sistema. Conviene revisar con alguien de confianza el aviso de privacidad según la Ley 19.628 (y la Ley 21.719, que la reemplaza).

**Sobre el "agente" de cumpleaños:** el envío automático de WhatsApp sin que nadie pulse un botón solo existe con la API oficial de WhatsApp Business, que tiene costo. Por eso el panel deja el mensaje listo para enviarlo con un clic. Si más adelante quieren automatizarlo, solo hay que cambiar ese botón por una llamada a la API.

**Redes y WhatsApp:** se configuran en `config.js` (`instagram`, `facebook`, `tiktok` y `whatsapp`). Si dejas uno vacío, su ícono se oculta.

## Arriendo a domicilio (juegos y servicios en la casa del cliente)

El sitio ofrece dos modalidades: **En nuestra parcela** (con simulador 3D) y **En tu casa o local**. En domicilio el cliente elige servicios con cantidades, la zona de despacho y llena los datos del lugar: tipo de lugar, tipo de suelo, ancho × largo, altura libre, acceso, piso, terreno plano o con pendiente, enchufe de 220 V, agua y observaciones.

1. **Zonas y precios de despacho**: panel admin → pestaña **Domicilio**. Los precios iniciales (Arica urbana, Azapa, Lluta) son **ejemplos**: cámbialos por tus tarifas reales. El servidor calcula el flete; el cliente no puede alterarlo.
2. **Servicios solo de parcela**: en la pestaña *Servicios y terreno*, desmarca "Disponible a domicilio" en lo que no se pueda llevar (piscina, quincho, etc.).
3. **Bloqueos por tipo**: al bloquear una fecha elige si aplica a todo, solo parcela o solo domicilio.
4. **Stock compartido**: las unidades de un juego se comparten entre parcela y domicilio el mismo día. Un pedido a domicilio no ocupa la parcela.
5. **Alertas**: el sitio avisa si los servicios no caben en el espacio indicado, si falta enchufe, si hay pendiente o acceso angosto. Solo impide reservar cuando físicamente no caben; el resto son avisos para que tú confirmes con el cliente. Los datos del lugar se ven en cada reserva y en la pestaña Domicilio.

## Fotos y modelos 3D reales de los servicios

En `admin.html` > **Agregar servicio** (o *Editar*) hay dos campos:

- **Foto del servicio:** se muestra en el catálogo del sitio. Sirve JPG, PNG o WebP (hasta 5 MB); la página la reduce sola a un tamaño liviano. Funciona también en modo demo.
- **Modelo 3D real (.glb):** reemplaza la figura simple del simulador por el modelo de verdad (hasta 30 MB). Se ajusta solo al **ancho y largo reales** que escribiste (sin deformarse) y se apoya en el suelo. Si queda de lado, usa **Girar el modelo** (90°, 180° o 270°). Si el modelo falla al cargar, el simulador usa la figura simple y no se rompe nada.
  Requiere el servidor con base de datos (Railway); en modo demo el campo aparece bloqueado.

Las fotos y los modelos se guardan **en la base de datos** y el servidor los entrega en `/archivos/...`, así que se respaldan junto con los demás datos.

### Cómo conseguir modelos 3D que se parezcan a tus juegos
El simulador no puede "adivinar" cómo es tu castillo o tu tobogán: necesita un modelo 3D. Tres caminos, del más fiel al más rápido:
1. **Escanear tus propios juegos con el celular.** Hay aplicaciones que arman un modelo 3D desde fotos o video, por ejemplo Polycam, Luma AI o Kiri Engine (algunas cobran por exportar). Se infla el juego, se le da la vuelta grabando y se exporta como `.glb`. Es lo que más se parece a lo que realmente arriendas.
2. **Encargarlo a un modelador 3D** (freelance). Pídele: formato `.glb`, menos de 10 MB, colores y medidas de tus juegos reales, con la base del modelo apoyada en el suelo.
3. **Bajar modelos gratis o de pago** de bibliotecas como Sketchfab o Poly Pizza. Filtra por *descargable* y **revisa la licencia**: debe permitir uso comercial, y varias exigen citar al autor. Rara vez habrá uno idéntico al tuyo.

Consejos: el archivo debe ser `.glb` (no `.obj`, `.fbx` ni `.gltf` suelto); ideal menos de **10 MB** (máximo permitido 30 MB) porque en el celular carga por internet móvil. Si pesa mucho, se puede reducir gratis en la página gltf.report. Si tienes Blender: *File > Export > glTF 2.0 > formato "glb"*.

## El terreno (parcela) en el simulador
En el panel de administración, sección **Terreno**, puedes dejar el simulador igual a tu parcela real. Se guarda en la base (tabla `terreno`) y lo ven todos los clientes.

**Qué puedes configurar**
- **Medidas:** ancho y largo en metros (de 8 a 80 y de 6 a 60). El precio de la parcela y las medidas que ve el cliente se actualizan solos.
- **Suelo:** pasto, tierra, cemento o arena. **Cerco:** con o sin.
- **Elementos fijos** (quincho, casa o bodega, baños, árboles, piscina fija, otros): se agregan con el botón, se **arrastran en el plano** hasta su lugar y se ajustan con medidas y giro. Los juegos no se pueden poner encima de ellos.
- **Textura y sólido/intangible (cada elemento):** elige textura (pasto, pasto sintético, tierra, madera, cemento, arena o agua) y si es **sólido** (los juegos no se pueden poner encima, como una casa) o **intangible** (solo decora, los juegos sí se pueden poner encima, como una zona de pasto). El tipo **Zona de suelo** sirve para pintar áreas de pasto, madera, etc.; nace intangible. En el plano, lo intangible se ve con borde punteado.
- **Entrada:** siempre es la parte de abajo del plano.

**Atajo para Divertí Kids:** el botón **Cargar mi parcela (según foto satelital)** deja el plano dibujado desde tu foto satelital (48 × 44 m aprox., tierra, cerco, mini canchas, quincho, casa y cocina, baños, piscina, zona de helados y el acceso de vehículos donde no van juegos). Las medidas son aproximadas: ajusta cada elemento arrastrándolo o con sus medidas y pulsa **Guardar terreno**. Los juegos suelen ir en el pasto sintético, que queda libre.

**Con las fotos o el video que tienes de la parcela (de menor a mayor esfuerzo)**
1. **Medir y dibujar:** mide con huincha o con un mapa (Google Maps → clic derecho → *Medir distancia*) el ancho y largo, y la posición de quincho, baños y árboles. Es lo más rápido y suele bastar.
2. **Foto aérea:** una foto tomada desde arriba (dron, o captura de satélite de Google Maps) que se estira sobre el suelo. Recórtala justo en los bordes del terreno, con **la parte de arriba de la foto = el fondo de la parcela y la parte de abajo = la entrada**. Si queda al revés, gírala antes de subirla. Es la forma más fiel sin 3D.
3. **Escaneo 3D (.glb):** con el video de la parcela, una app como Polycam, Luma AI o Kiri Engine arma un modelo que se exporta como `.glb` (menos de 30 MB, ideal menos de 10). Al subirlo reemplaza al terreno dibujado y se ajusta solo a las medidas que pusiste; el campo de giro sirve si queda de lado. Si no carga, el sitio sigue mostrando el terreno dibujado.

**Importante:** en modo demo (sin servidor) la foto aérea sí se guarda, pero el archivo 3D del terreno solo se puede subir con el servidor y la base conectados.

## Chatbot
Responde **28 temas** (precios, disponibilidad por fecha, ubicación, horarios, pagos, cancelaciones, montaje, etc.) y deriva a una persona por WhatsApp.
- En `config.js`, bloque `DK_NEGOCIO`, escribe tu WhatsApp real, dirección, horario de atención, política de cancelación, etc. **Lo que dejes vacío, el chatbot lo deriva a una persona** en vez de inventar una respuesta. Cambia el WhatsApp de ejemplo antes de publicar.
- **Prueba de calidad:** `pruebas/chatbot.test.mjs` lanza 30 consultas y mide el % de aciertos (resultado en `pruebas/resultados-chatbot.md`). Las 30 consultas iniciales las escribí yo, así que **agrega las que de verdad hace tu gente** (están al inicio del archivo) y vuelve a medir.

## Pruebas automáticas (opcional, para quien programe)
Necesitan Node.js 20 o superior, Playwright con Chromium y PGlite (PostgreSQL en memoria, para probar el servidor sin Railway):
```
npm i --no-save playwright @electric-sql/pglite
```
```
node pruebas/servidor.test.mjs          # servidor: sitio, reservas, seguridad del panel, archivos (base PostgreSQL en memoria)
node pruebas/flow-mock.test.mjs         # pago del abono con Flow a través del servidor (Flow simulado)
node pruebas/sitio-flow.test.mjs        # recorrido en el navegador con el servidor: pagar en Flow, volver y usar el panel
node pruebas/chatbot.test.mjs           # 30 consultas del chatbot
node pruebas/ajuste-modelo.test.mjs     # cómo se ajusta un modelo 3D real al ancho y largo
node pruebas/sitio-demo.test.mjs        # recorrido completo en modo demo
node pruebas/terreno.test.mjs           # editor del terreno, guardado y uso en el sitio
node pruebas/parcela-diverti.test.mjs   # botón "Cargar mi parcela"
node pruebas/texturas.test.mjs          # texturas y sólido/intangible
node pruebas/domicilio.test.mjs         # modalidad domicilio, lugar, zonas y flete
node pruebas/cartera.test.mjs           # clientes, cumpleaños, balance, Excel, ofertas y redes
node pruebas/terreno-3d.test.mjs        # qué se dibuja en el 3D según el terreno (con 3D simulado)
```
Si Chromium no está en `/opt/pw-browsers/chromium`, indica tu navegador con la variable `CHROMIUM` (por ejemplo, la ruta de Google Chrome).

## Cómo funciona la seguridad
- El navegador **nunca se conecta a la base de datos**: todo pasa por el servidor, que solo acepta las operaciones previstas.
- Los clientes **no pueden leer** reservas ni datos de otras personas; solo ven qué está ocupado.
- Al reservar, la **base recalcula el precio y revisa la disponibilidad**; si alguien manipula el navegador, se rechaza.
- El pago solo lo confirma el servidor tras consultar a Flow; el navegador no puede marcar una reserva como pagada.
- El panel exige iniciar sesión. La clave se guarda cifrada (scrypt), la sesión vive en una cookie protegida (HttpOnly, SameSite) y vence en 12 horas, y tras 8 intentos fallidos el login se bloquea 15 minutos.
- Las fotos y modelos se revisan por su contenido real (JPG, PNG, WebP o .glb) antes de guardarse.

## Instalar como app en el celular
- **iPhone (Safari):** Compartir > **Agregar a pantalla de inicio**.
- **Android (Chrome):** menú ⋮ > **Instalar app**.

## Si algo falla
| Síntoma | Qué revisar |
|---|---|
| El despliegue falla con "Falta la variable DATABASE_URL" | Paso 4: falta `DATABASE_URL` o la referencia apunta a otro nombre de base. |
| El servidor no arranca: "ADMIN_PASSWORD debe tener al menos 10 caracteres" | Usa una clave más larga en `ADMIN_PASSWORD`. |
| "No se pudo conectar con el servidor" | Revisa en Railway que el servicio esté activo (en verde) y mira sus registros (*Deployments* > *View logs*). |
| "Correo o contraseña incorrectos" en el panel | Usa exactamente `ADMIN_EMAIL` y `ADMIN_PASSWORD` de Railway. |
| Al pagar dice "No se pudo iniciar el pago" | Revisa `FLOW_API_KEY` y `FLOW_SECRET_KEY` (y `FLOW_API_URL` si estás en producción). Mira los registros del servicio en Railway. |
| Pagué en Flow pero sigue "por_pagar" | Flow debe poder llegar a `https://tu-direccion/api/flow/confirmacion`; si usas dominio propio, revisa `SITE_URL`. Flow reintenta el aviso. |
| "El plazo para pagar venció" | Pasaron más de 30 minutos; hay que reservar de nuevo. |
| Una reserva quedó "pendiente" con una nota en rojo | Flow cobró un monto distinto o el cupo se perdió: revísala en el panel (y reembolsa si corresponde). |
| El simulador 3D no aparece | Falta internet para cargar la librería 3D; el resto del sitio y el pago siguen funcionando. |
| Quiero ver errores | En el navegador: F12 > pestaña **Consola**. En el servidor: registros del servicio en Railway. |

## Respaldo de los datos
Descarga cada cierto tiempo los Excel del panel (pestañas *Clientes* y *Balance*). Además, revisa en Railway qué respaldos automáticos ofrece la base PostgreSQL en el plan contratado (Por verificar).
