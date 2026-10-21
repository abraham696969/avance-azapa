# Divertí Kids · Guía de instalación (paso a paso)

## Qué contiene esta carpeta

| Archivo | Para qué sirve |
|---|---|
| `index.html` | Sitio de **clientes** (servicios, fecha, simulador 3D, reserva y pago). |
| `admin.html` | Panel de **administración**, con su propio login. Es otra página distinta. |
| `config.js` | Aquí pegas los datos de tu base de datos (paso 3). |
| `schema.sql` | Crea las tablas, reglas de seguridad y funciones en la base de datos (paso 2). |
| `shared.js`, `app.js`, `admin.js`, `styles.css` | Código y estilos. No necesitas tocarlos. |

Dirección del sitio de clientes: `https://tu-sitio.com/`
Dirección del panel admin: `https://tu-sitio.com/admin.html` (solo el equipo; el sitio de clientes tiene un enlace discreto "Administración" en el pie).

---

## Modo demo (sin base de datos)

Si `config.js` está vacío, todo funciona en **modo demo**: los datos se guardan solo en el navegador de quien lo prueba.
En `admin.html` entras con **admin@divertikids.cl** y clave **admin1234**. Sirve para probar y mostrar, **no protege nada**.

Para que cliente y admin compartan datos en modo demo, ábrelos desde el mismo lugar (por ejemplo, ya publicados, o con un servidor local). No es para uso real.

---

## Base de datos real con Supabase (gratis para empezar)

### Paso 1 · Crear el proyecto
1. Entra a **https://supabase.com** y crea una cuenta (puedes usar Google o GitHub).
2. Pulsa **New project**. Ponle nombre `diverti-kids`.
3. En **Database Password** escribe una clave fuerte y **guárdala** en un lugar seguro.
4. En **Region** elige la más cercana a Chile: **South America (São Paulo)**.
5. Pulsa **Create new project** y espera 1 o 2 minutos.

### Paso 2 · Crear las tablas
1. En el menú izquierdo abre **SQL Editor** y pulsa **New query**.
2. Abre el archivo `schema.sql`, copia **todo** su contenido y pégalo.
3. Pulsa **Run**. Debe decir "Success. No rows returned".
4. Para comprobar, abre **Table Editor**: verás `reservas`, `catalogo`, `fechas_bloqueadas` y `admins`. `catalogo` ya trae los 11 servicios.

Se puede volver a ejecutar sin borrar tus datos.

### Paso 3 · Conectar el sitio
1. En Supabase abre **Project Settings** (engranaje) > **API**.
2. Copia **Project URL** (algo como `https://abcdxyz.supabase.co`).
3. Copia la clave **anon public** (empieza con `eyJ...`). Esta clave es pública: la seguridad la dan las reglas del paso 2.
   **Nunca** pegues la clave `service_role`.
4. Abre `config.js` con el Bloc de notas y pega ambos valores entre las comillas:

```js
window.DK_CONFIG={
  SUPABASE_URL:"https://abcdxyz.supabase.co",
  SUPABASE_ANON_KEY:"eyJ...tu clave anon..."
};
```

### Paso 4 · Crear el usuario administrador
1. En Supabase abre **Authentication** > **Users** > **Add user** > **Create new user**.
2. Escribe el correo y una contraseña. Marca **Auto Confirm User** y pulsa **Create user**.
3. Vuelve a **SQL Editor**, nueva consulta, pega esto cambiando el correo por el tuyo, y pulsa **Run**:

```sql
insert into public.admins (user_id)
select id from auth.users where email = 'tu-correo@ejemplo.cl';
```

Solo los usuarios que estén en la tabla `admins` pueden entrar al panel. Para agregar a otra persona, repite los pasos 1 a 3 con su correo.

### Paso 5 · Cerrar los registros públicos
Para que nadie más pueda crear cuentas:
1. **Authentication** > **Sign In / Providers** (en algunas versiones, **Providers**) > **Email**.
2. Desactiva **Allow new users to sign up** y guarda.

(Aunque alguien se registrara, no vería reservas: no está en `admins`. Igual conviene cerrarlo.)

### Paso 6 · Publicar el sitio
Elige una opción gratuita y sube **toda la carpeta**:
- **Netlify:** entra a https://app.netlify.com/drop y arrastra la carpeta. Te da una dirección al instante.
- **Cloudflare Pages:** *Workers & Pages* > *Create* > *Pages* > *Upload assets*.
- **GitHub Pages:** sube la carpeta a un repositorio y activa Pages en *Settings*.

Después, en Supabase abre **Authentication** > **URL Configuration** y pon tu dirección en **Site URL**.

### Paso 7 · Probar
1. Abre `https://tu-sitio/` desde el celular, agrega un servicio y haz una reserva de prueba (tarjeta ya cargada).
2. Abre `https://tu-sitio/admin.html`, entra con el usuario del paso 4 y verás la reserva con su distribución.
3. Cambia su estado a **confirmada**, bloquea una fecha o cambia un precio, y recarga el sitio de clientes para ver el efecto.

---

## Cómo funciona la seguridad
- Los clientes **no pueden leer** reservas ni datos de otras personas. Solo ven qué fechas y servicios están ocupados.
- Al reservar, el **servidor recalcula el precio y revisa la disponibilidad**. Si alguien manipula el navegador, la base lo rechaza.
- El panel solo muestra datos a usuarios de la tabla `admins`.
- Las reservas nuevas quedan **pendientes**. El equipo las pasa a **confirmada** cuando valida el abono.

## Pagos reales (importante)
El pago de esta versión es **simulado**: no cobra dinero. Para cobrar de verdad se necesita un componente en servidor (Webpay Plus, Flow o Mercado Pago no se pueden llamar directo desde el navegador porque exigen claves secretas). La vía recomendada con Supabase es una **Edge Function** que cree el pago y, al recibir la confirmación del proveedor, cambie la reserva a `confirmada`. Si quieres, ese es el siguiente paso.

Tampoco se envían correos todavía: la "vista previa del correo" es solo ilustrativa.

## Instalar como app en el celular
- **iPhone (Safari):** botón Compartir > **Agregar a pantalla de inicio**.
- **Android (Chrome):** menú ⋮ > **Instalar app** o **Agregar a pantalla de inicio**.

## Si algo falla
| Síntoma | Qué revisar |
|---|---|
| "No se pudo conectar con la base de datos" | Que `config.js` tenga la URL y la clave anon completas, sin espacios, y que hayas corrido `schema.sql`. |
| "Este usuario no tiene permisos de administración" | Falta el paso 4.3 (insertar el correo en `admins`). |
| "Correo o contraseña incorrectos" | Revisa el usuario en Authentication > Users; que tenga **Auto Confirm** y la clave correcta. |
| El pago dice que "ya no quedan..." | Otra persona reservó antes; elige otra fecha o franja. |
| El simulador 3D no aparece | Falta conexión a internet para cargar la librería 3D. El resto del sitio y el pago siguen funcionando. |
| Quiero ver errores | En el navegador: F12 > pestaña **Consola**. |

## Respaldo de los datos
En Supabase: **Table Editor** > tabla `reservas` > **Export** a CSV. En el plan gratuito, haz esto cada cierto tiempo.
