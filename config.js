/* Configuración de Divertí Kids.
   Mientras SUPABASE_URL y SUPABASE_ANON_KEY estén vacíos, el sitio funciona en MODO DEMO
   (datos guardados solo en el navegador, pago simulado). Ver INSTRUCCIONES.md. */
window.DK_CONFIG={
  SUPABASE_URL:"",       // ejemplo: "https://abcdxyz.supabase.co"
  SUPABASE_ANON_KEY:"",  // la clave "anon public" (es pública, la seguridad la dan las reglas de la base)

  PAGO_ONLINE:false,     // true = el abono se paga en Flow (requiere el paso 7 de INSTRUCCIONES.md)
  PAGO_PRUEBAS:true      // true = se muestra "ambiente de pruebas"; ponlo en false cuando uses las claves reales de Flow
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
