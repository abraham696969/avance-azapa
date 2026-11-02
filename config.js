/* Configuración de Divertí Kids.
   No hay claves aquí: cuando el sitio lo entrega el servidor de Railway, el servidor agrega solo
   SERVIDOR:true (base de datos conectada) y activa el pago con Flow si sus claves están en Railway.
   Si abres los archivos sin el servidor, el sitio funciona en MODO DEMO (datos solo en el navegador,
   pago simulado). Ver INSTRUCCIONES.md. */
window.DK_CONFIG={
  SERVIDOR:false,        // lo pone el servidor; no lo cambies a mano
  PAGO_ONLINE:false,     // lo pone el servidor según las claves de Flow
  PAGO_PRUEBAS:true      // lo pone el servidor: true mientras Flow esté en su ambiente de pruebas
};

/* Datos del negocio que usa el chatbot. Lo que dejes vacío ("") el chatbot lo deriva a una persona.
   Contacto y redes de Divertí Kids. */
window.DK_NEGOCIO={
  whatsapp:"56962237619",            // solo números, con código de país (ejemplo: 56912345678)
  whatsappVisible:"+56 9 6223 7619", // cómo se muestra el número
  instagram:"https://www.instagram.com/diverti_.kids/",
  facebook:"https://www.facebook.com/diverti.kids.714",
  tiktok:"",                         // opcional: enlace de TikTok
  correo:"",                         // ej.: "contacto@divertikids.cl"
  direccion:"",                      // ej.: "Camino X, km 8, Valle de Azapa"
  atencion:"",                       // ej.: "Lunes a sábado de 9:00 a 19:00"
  cancelacion:"",                    // política de cancelación y devoluciones
  montaje:"",                        // cómo y cuándo se montan y retiran los juegos
  electricidad:"",                   // requisitos de electricidad/agua para los juegos
  boleta:"",                         // boleta o factura
  edades:"",                         // edades recomendadas y supervisión
  comidaPropia:"",                   // si se puede llevar comida, torta, música, decoración
  descuentos:""                      // promociones o descuentos vigentes
};
