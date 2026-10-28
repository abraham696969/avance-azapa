# Divertí Kids · Guía de instalación (paso a paso)

## Qué contiene esta carpeta

| Archivo | Para qué sirve |
|---|---|
| `index.html` | Sitio de **clientes** (servicios, fecha, simulador 3D, reserva, pago y chatbot). |
| `admin.html` | Panel de **administración** con su propio login: reservas, fechas bloqueadas y servicios. |
| `config.js` | Aquí pegas las claves de la base de datos y los datos del negocio para el chatbot. |
| `schema.sql` | Crea las tablas, reglas de seguridad y funciones de la base de datos (paso 2). |
| `supabase/functions/` | Tres funciones de servidor para cobrar con Flow (paso 7). |
| `pruebas/` | Pruebas automáticas y el resultado de la prueba del chatbot. |
| `shared.js`, `app.js`, `admin.js`, `styles.css` | Código y estilos. No necesitas tocarlos. |

Sitio de clientes: `https://tu-sitio.com/` · Panel admin: `https://tu-sitio.com/admin.html`

---

## Modo demo (sin base de datos ni pago real)

Si `SUPABASE_URL` y `SUPABASE_ANON_KEY` están vacíos en `config.js`, todo funciona en **modo demo**: los datos se guardan solo en el navegador y el pago es simulado. En `admin.html` entras con **admin@divertikids.cl** y clave **admin1234** (solo es un trámite de la demo, no protege nada).

---

## Base de datos real con Supabase (gratis para empezar)

### Paso 1 · Crear el proyecto
1. Entra a **https://supabase.com**, crea una cuenta y pulsa **New project**. Nombre: `diverti-kids`.
2. En **Database Password** escribe una clave fuerte y **guárdala**.
3. En **Region** elige **South America (São Paulo)** y pulsa **Create new project** (1 a 2 minutos).

### Paso 2 · Crear las tablas
1. Menú izquierdo > **SQL Editor** > **New query**.
2. Copia **todo** el contenido de `schema.sql`, pégalo y pulsa **Run**. Debe decir "Success".
3. En **Table Editor** verás `reservas`, `catalogo`, `fechas_bloqueadas` y `admins`. El catálogo trae los 11 servicios de ejemplo.

Si ya habías ejecutado una versión anterior, vuelve a ejecutar este archivo: **actualiza sin borrar** tus reservas ni los precios que hayas cambiado.

### Paso 3 · Conectar el sitio
1. **Project Settings** (engranaje) > **API**. Copia **Project URL** y la clave **anon public** (empieza con `eyJ...`). **Nunca** pegues la clave `service_role` en `config.js`.
2. Abre `config.js` con el Bloc de notas y pégalas:

```js
window.DK_CONFIG={
  SUPABASE_URL:"https://abcdxyz.supabase.co",
  SUPABASE_ANON_KEY:"eyJ...tu clave anon...",
  PAGO_ONLINE:false,   // se activa en el paso 7
  PAGO_PRUEBAS:true
};
```

### Paso 4 · Crear el usuario administrador
1. **Authentication** > **Users** > **Add user** > **Create new user**: correo y contraseña, marca **Auto Confirm User**.
2. En **SQL Editor** ejecuta (cambia el correo por el tuyo):

```sql
insert into public.admins (user_id)
select id from auth.users where email = 'tu-correo@ejemplo.cl';
```

Solo quienes estén en `admins` entran al panel. Para otra persona, repite con su correo.

### Paso 5 · Cerrar los registros públicos
**Authentication** > **Sign In / Providers** > **Email**: desactiva **Allow new users to sign up** y guarda. (El nombre del menú puede variar un poco entre versiones.)

### Paso 6 · Publicar el sitio
Sube **toda la carpeta** a una opción gratuita:
- **Netlify:** https://app.netlify.com/drop y arrastra la carpeta.
- **Cloudflare Pages:** *Workers & Pages* > *Create* > *Pages* > *Upload assets*.
- **GitHub Pages:** sube la carpeta a un repositorio y activa Pages.

Anota la dirección final (por ejemplo `https://divertikids.netlify.app`). En Supabase, **Authentication** > **URL Configuration**, ponla en **Site URL**.

Con esto ya funciona todo, y las reservas nuevas quedan **pendientes** para que el equipo valide el abono a mano. Para cobrar en línea, sigue el paso 7.

---

## Paso 7 · Cobrar en línea con Flow (modo pruebas primero)

Flow (https://www.flow.cl) procesa tarjetas y otros medios en Chile. El pago **no puede hacerse solo desde el navegador** porque exige una clave secreta, por eso se usan 3 funciones de servidor incluidas en `supabase/functions/`.

**Cómo funciona:** el cliente reserva y su cupo queda guardado **30 minutos** (estado `por_pagar`) > lo llevamos a Flow > Flow avisa a nuestro servidor > el servidor consulta a Flow el estado real del pago y, solo si está pagado y el monto coincide, pasa la reserva a `confirmada`. Si no paga en 30 minutos, el cupo se libera solo. El monto lo calcula el servidor; el navegador nunca lo decide.

### 7.1 · Cuenta de pruebas en Flow
1. Crea una cuenta en **https://sandbox.flow.cl** (ambiente de pruebas, no cobra dinero).
2. Obtén tu **API Key** y tu **Secret Key** de pruebas (ver "Credenciales de prueba" en https://developers.flow.cl). Son dos textos largos; la Secret Key **no se comparte con nadie ni va en `config.js`**.

### 7.2 · Publicar las 3 funciones (elige una forma)

**Forma A, desde la web de Supabase (sin instalar nada):**
1. **Edge Functions** > **Deploy a new function** > **Via Editor**.
2. Nombre exacto `flow-crear-pago`; pega el contenido de `supabase/functions/flow-crear-pago/index.ts` y **Deploy**.
3. Repite con `flow-confirmacion` y `flow-retorno`.
4. En estas dos últimas, desactiva **Verify JWT** / **Enforce JWT verification** (en los ajustes de cada función), porque las llama Flow y el navegador sin sesión. Deja activado en `flow-crear-pago`.

**Forma B, con la terminal** (necesita Node.js; desde la carpeta del sitio):
```
npx supabase login
npx supabase link --project-ref TU_REFERENCIA
npx supabase functions deploy flow-crear-pago
npx supabase functions deploy flow-confirmacion --no-verify-jwt
npx supabase functions deploy flow-retorno --no-verify-jwt
```
(La "referencia" es el texto de `https://TU_REFERENCIA.supabase.co`.)

### 7.3 · Guardar las claves como secretos
En **Edge Functions** > **Secrets** (o con `npx supabase secrets set NOMBRE=valor`) crea:

| Secreto | Valor |
|---|---|
| `FLOW_API_KEY` | tu API Key de pruebas de Flow |
| `FLOW_SECRET_KEY` | tu Secret Key de pruebas de Flow |
| `SITE_URL` | la dirección de tu sitio **sin** `/` al final, ej. `https://divertikids.netlify.app` |

(`FLOW_API_URL` es opcional: por defecto usa el sandbox `https://sandbox.flow.cl/api`.)

### 7.4 · Activar en el sitio
En `config.js` cambia `PAGO_ONLINE:false` por `PAGO_ONLINE:true` y vuelve a subir el sitio.

### 7.5 · Probar
1. En el sitio, agrega un servicio, completa tus datos y pulsa **Pagar abono** > **Ir a pagar a Flow**.
2. Paga con los datos de prueba que Flow muestra en su ambiente de pruebas.
3. Al volver verás "¡Pago recibido! Reserva R-xxxx confirmada". En `admin.html` la reserva aparece **confirmada**.
4. Prueba también cancelar el pago en Flow: la reserva sigue `por_pagar` y se libera a los 30 minutos.

### 7.6 · Pasar a pagos reales
Pide a Flow habilitar tu cuenta comercial para producción, cambia los secretos `FLOW_API_KEY` y `FLOW_SECRET_KEY` por los reales, agrega el secreto `FLOW_API_URL` = `https://www.flow.cl/api`, y en `config.js` pon `PAGO_PRUEBAS:false` (quita el aviso de "ambiente de pruebas").

> **Importante:** la firma de las llamadas y los avisos de Flow los verifiqué con la documentación de Flow y con un Flow simulado, pero **no pude probar contra el sandbox real** (este entorno no tiene acceso). Haz el paso 7.5 antes de publicar. Los códigos de estado de pago que usa el sistema son los de Flow: 1 pendiente, 2 pagada, 3 rechazada, 4 anulada; confírmalo con tu primer pago de prueba.

---

## Administrar servicios y precios (panel admin)
En `admin.html`, sección **Agregar servicio** y **Servicios y precios**:
- **Agregar:** nombre, categoría, tipo en el simulador 3D, descripción, precio, unidades, medidas reales (ancho, largo, alto) y color. Aparece al instante en el catálogo, la cotización y el simulador 3D.
- **Editar:** botón *Editar* en la lista. Precio y unidades también se cambian directo en la tabla.
- **Eliminar:** lo oculta del sitio. Las reservas antiguas lo siguen mostrando con su nombre.
- El arriendo de la parcela no se puede eliminar.

## Clientes, cumpleaños, balance y ofertas (panel admin)

El panel tiene seis pestañas:

- **Reservas:** lo de siempre (estados, distribución 3D, bloqueo de fechas).
- **Clientes:** la cartera. Cada reserva del sitio agrega sola al apoderado, al niño, su nacimiento, el celular y lo que arrendó. También puedes **agregar a mano** clientes anteriores (formulario de abajo). Botón **Descargar Excel**: hojas *Clientes*, *Eventos* (ordenados por fecha, con el mes) y *Cumpleaños*.
- **Cumpleaños:** arriba, los cumpleañeros **destacados** (los que cumplen en los próximos 30 días o cumplieron hace menos de 15 y ya arrendaron algo). Abajo, las **propuestas por enviar**: aparecen hasta 35 días antes del cumpleaños. El botón *Enviar por WhatsApp* abre WhatsApp con el mensaje ya escrito (apoderado, niño, edad, ofertas vigentes y enlace al sitio); tú solo lo envías y luego pulsas *Marcar enviada* para que no se repita ese año. El texto del mensaje se puede editar (se guarda en ese navegador).
- **Balance:** por mes y año, según la fecha del evento: eventos, contratado, abonos, saldos cobrados, cobrado y por cobrar, con un Excel descargable. Regla: **Confirmada** = abono cobrado; **Finalizada** = el evento se hizo y el saldo se cobró (cámbiala a mano en *Reservas* cuando cobres el saldo); **Pendiente** = el abono aún no se valida; **Cancelada** no cuenta.
- **Ofertas:** el tablón de ofertas. Las activas y no vencidas se muestran en una sección del sitio (con botón a WhatsApp) y se incluyen en las propuestas de cumpleaños.
- **Servicios y terreno:** el catálogo y el editor del terreno.

**Importante al actualizar una base ya creada:** vuelve a pegar el `schema.sql` completo en Supabase (es seguro repetirlo). Agrega los datos del niño a las reservas y las tablas de clientes, ofertas y propuestas.

**Datos personales:** el sitio pide el nombre y la fecha de nacimiento del niño y una casilla de aceptación para guardarlos. Los datos solo los ve el equipo con sesión iniciada. Si un apoderado pide que borren sus datos, hazlo desde Supabase (tabla *reservas* o *clientes_extra*). Conviene revisar con alguien de confianza el aviso de privacidad según la Ley 19.628 (y la Ley 21.719, que la reemplaza).

**Sobre el "agente" de cumpleaños:** el envío automático de WhatsApp sin que nadie pulse un botón solo existe con la API oficial de WhatsApp Business, que tiene costo. Por eso el panel deja el mensaje listo para enviarlo con un clic. Si más adelante quieren automatizarlo, solo hay que cambiar ese botón por una llamada a la API.

**Redes y WhatsApp:** se configuran en `config.js` (`instagram`, `facebook`, `tiktok` y `whatsapp`). Si dejas uno vacío, su ícono se oculta.

## Fotos y modelos 3D reales de los servicios

En `admin.html` > **Agregar servicio** (o *Editar*) hay dos campos nuevos:

- **Foto del servicio:** se muestra en el catálogo del sitio. Sirve JPG, PNG o WebP; la página la reduce sola a un tamaño liviano. Funciona también en modo demo.
- **Modelo 3D real (.glb):** reemplaza la figura simple del simulador por el modelo de verdad. Se ajusta solo al **ancho y largo reales** que escribiste (sin deformarse) y se apoya en el suelo. Si queda de lado, usa **Girar el modelo** (90°, 180° o 270°). Si el modelo falla al cargar, el simulador usa la figura simple y no se rompe nada.
  Requiere la base de datos real (Supabase); en modo demo el campo aparece bloqueado.

**Importante si ya habías instalado una versión anterior:** vuelve a ejecutar `schema.sql` completo (Supabase > SQL Editor > Run). Agrega las columnas y las carpetas de archivos `servicios` y `modelos` sin borrar tus datos.

### Cómo conseguir modelos 3D que se parezcan a tus juegos
El simulador no puede "adivinar" cómo es tu castillo o tu tobogán: necesita un modelo 3D. Tres caminos, del más fiel al más rápido:
1. **Escanear tus propios juegos con el celular.** Hay aplicaciones que arman un modelo 3D desde fotos o video, por ejemplo Polycam, Luma AI o Kiri Engine (algunas cobran por exportar). Se infla el juego, se le da la vuelta grabando y se exporta como `.glb`. Es lo que más se parece a lo que realmente arriendas.
2. **Encargarlo a un modelador 3D** (freelance). Pídele: formato `.glb`, menos de 10 MB, colores y medidas de tus juegos reales, con la base del modelo apoyada en el suelo.
3. **Bajar modelos gratis o de pago** de bibliotecas como Sketchfab o Poly Pizza. Filtra por *descargable* y **revisa la licencia**: debe permitir uso comercial, y varias exigen citar al autor. Rara vez habrá uno idéntico al tuyo.

Consejos: el archivo debe ser `.glb` (no `.obj`, `.fbx` ni `.gltf` suelto); ideal menos de **10 MB** (máximo permitido 30 MB) porque en el celular carga por internet móvil. Si pesa mucho, se puede reducir gratis en la página gltf.report. Si tienes Blender: *File > Export > glTF 2.0 > formato "glb"*.

## El terreno (parcela) en el simulador
En el panel de administración, sección **Terreno**, puedes dejar el simulador igual a tu parcela real. Se guarda en la base (tabla `terreno`) y lo ven todos los clientes. **Si ya tenías el proyecto armado, vuelve a pegar `schema.sql` completo en el SQL Editor de Supabase** (es seguro repetirlo): crea la tabla `terreno`.

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

**Importante:** en modo demo (sin base de datos) la foto aérea sí se guarda, pero el archivo 3D del terreno solo se puede subir con la base conectada.

## Chatbot
Responde **28 temas** (precios, disponibilidad por fecha, ubicación, horarios, pagos, cancelaciones, montaje, etc.) y deriva a una persona por WhatsApp.
- En `config.js`, bloque `DK_NEGOCIO`, escribe tu WhatsApp real, dirección, horario de atención, política de cancelación, etc. **Lo que dejes vacío, el chatbot lo deriva a una persona** en vez de inventar una respuesta. Cambia el WhatsApp de ejemplo antes de publicar.
- **Prueba de calidad:** `pruebas/chatbot.test.mjs` lanza 30 consultas y mide el % de aciertos (resultado en `pruebas/resultados-chatbot.md`). Las 30 consultas iniciales las escribí yo, así que **agrega las que de verdad hace tu gente** (están al inicio del archivo) y vuelve a medir.

## Pruebas automáticas (opcional, para quien programe)
Necesitan Node.js 22 y Playwright (`npm i playwright`):
```
node --experimental-strip-types pruebas/flow-mock.test.mjs   # funciones de pago contra un Flow simulado
node pruebas/chatbot.test.mjs                                # 30 consultas del chatbot
node pruebas/ajuste-modelo.test.mjs                          # cómo se ajusta un modelo 3D real al ancho y largo
node pruebas/sitio-demo.test.mjs                             # recorrido completo en modo demo
node pruebas/sitio-flow.test.mjs                             # recorrido con pago en línea (base simulada)
node pruebas/terreno.test.mjs                                # editor del terreno, guardado y uso en el sitio
node pruebas/parcela-diverti.test.mjs                        # botón "Cargar mi parcela"
node pruebas/texturas.test.mjs                               # texturas y sólido/intangible
node pruebas/cartera.test.mjs                                # clientes, cumpleaños, balance, Excel, ofertas y redes
node pruebas/terreno-3d.test.mjs                             # qué se dibuja en el 3D según el terreno (con 3D simulado)
```

## Cómo funciona la seguridad
- Los clientes **no pueden leer** reservas ni datos de otras personas; solo ven qué está ocupado.
- Al reservar, el **servidor recalcula el precio y revisa la disponibilidad**; si alguien manipula el navegador, la base lo rechaza.
- El pago solo lo confirma el servidor tras consultar a Flow; el navegador no puede marcar una reserva como pagada.
- El panel solo muestra datos a usuarios de la tabla `admins`.

## Instalar como app en el celular
- **iPhone (Safari):** Compartir > **Agregar a pantalla de inicio**.
- **Android (Chrome):** menú ⋮ > **Instalar app**.

## Si algo falla
| Síntoma | Qué revisar |
|---|---|
| "No se pudo conectar con la base de datos" | `config.js` con URL y clave anon completas; que hayas corrido `schema.sql`. |
| "Este usuario no tiene permisos de administración" | Falta el paso 4.2 (insertar el correo en `admins`). |
| Al pagar dice "No se pudo iniciar el pago" | Revisa los 3 secretos del 7.3 y que `flow-crear-pago` esté publicada. Mira los registros en Edge Functions > *Logs*. |
| Pagué en Flow pero sigue "por_pagar" | `flow-confirmacion` debe tener **Verify JWT desactivado** y `SITE_URL`/claves correctas; Flow reintenta el aviso. |
| "El plazo para pagar venció" | Pasaron más de 30 minutos; hay que reservar de nuevo. |
| Una reserva quedó "pendiente" con una nota en rojo | Flow cobró un monto distinto o el cupo se perdió: revísala en el panel (y reembolsa si corresponde). |
| El simulador 3D no aparece | Falta internet para cargar la librería 3D; el resto del sitio y el pago siguen funcionando. |
| Quiero ver errores | En el navegador: F12 > pestaña **Consola**. |

## Respaldo de los datos
Supabase: **Table Editor** > `reservas` > **Export** a CSV. En el plan gratuito, hazlo cada cierto tiempo.
