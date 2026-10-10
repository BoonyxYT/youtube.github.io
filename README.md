# LA SALA

Web de álbum/concierto para amigos: una portada, reproductor sincronizado, salas por código y control de reproducción reservado al anfitrión. Frontend estático (GitHub Pages) + Supabase para identidad anónima, base de datos, presencia y archivos privados.

## 1. Archivos del proyecto

- `index.html`: estructura de la web.
- `styles.css`: diseño responsive.
- `app.js`: reproductor, salas, sincronización y minijuego de reflejos.
- `supabase-config.js`: URL del proyecto y clave pública de Supabase.
- `supabase/schema.sql`: tablas, políticas RLS, funciones RPC, bucket privado y Realtime.
- `assets/portada.jpg`: portada del álbum mostrada en la web.

## 2. Preparar Supabase una sola vez

1. Crea un proyecto en [Supabase](https://supabase.com/).
2. En **Authentication → Sign In / Providers**, activa **Anonymous Sign-Ins**. La web usa identidades anónimas para no exigir correo a tus amigos.
3. Abre **SQL Editor**, pega y ejecuta el archivo `supabase/schema.sql`.
4. En SQL Editor, ejecuta esta consulta por separado después de reemplazar `PON_AQUI_UNA_CLAVE_LARGA_Y_UNICA` por una clave propia. Usa esa misma clave en el campo **Clave de anfitrión** cuando crees una sala.

```sql
insert into private.app_config (setting_key, setting_value)
values (
  'host_password_hash',
  extensions.crypt('PON_AQUI_UNA_CLAVE_LARGA_Y_UNICA', extensions.gen_salt('bf'))
)
on conflict (setting_key)
do update set setting_value = excluded.setting_value;
```

**No guardes la clave real en `README.md`, `app.js`, `supabase-config.js` ni en GitHub.** La base de datos conserva solo un hash. Solo tú necesitas esta clave para crear salas; los amigos entran con su código.

5. En **Project Settings / API** copia la Project URL y la **Publishable key** (o la clave `anon` heredada si tu proyecto todavía la usa). Pégalas en `supabase-config.js`:

```js
window.LASALA_CONFIG = {
  supabaseUrl: "https://TU-PROYECTO.supabase.co",
  supabaseAnonKey: "TU_PUBLISHABLE_O_ANON_KEY"
};
```

La publishable/anon key está diseñada para usarse desde el navegador. La seguridad depende de las políticas RLS y las funciones SQL de este proyecto. **Nunca** uses una `service_role` key en el frontend.

## 3. Subir audio y portada

- Sube la portada final a `assets/portada.jpg` en el repositorio.
- En **Storage**, abre el bucket privado `album-audio` que crea el SQL y sube la canción de prueba con el nombre exacto `demo.mp3`.
- El reproductor solicita una URL firmada temporal para el MP3 cuando un miembro entra en una sala; el audio no se sirve desde una ruta pública de GitHub Pages.
- Para añadir canciones, sube cada MP3 al bucket `album-audio` y añade una entrada al objeto `TRACKS` en `app.js`, por ejemplo:

```js
tema02: {
  title: 'Tema 02',
  subtitle: 'Segundo single',
  storagePath: 'tema02.mp3',
  game: {
    type: 'QUIZ',
    emoji: '？',
    title: '¿Te sabes <em>la letra?</em>',
    description: 'Responde antes que el resto.'
  }
}
```

El `storagePath` debe coincidir exactamente con el nombre/ruta del objeto en Storage. Cada tema puede definir su propio tipo, icono, título y descripción de minijuego.

## 4. Probarlo y publicarlo

1. Sube la carpeta `album-sala` al repositorio de GitHub.
2. Activa **Settings → Pages** en ese repositorio.
3. Abre la URL publicada. Si cambiaste el nombre del repositorio o la ruta base, asegúrate de que las rutas relativas (`styles.css`, `app.js`, `assets/...`) se conservan.
4. Para probar localmente, ejecuta desde la carpeta del proyecto `python -m http.server 8000` y abre `http://localhost:8000`.
5. Introduce tu nombre y clave de anfitrión para crear una sala. Copia el código/enlace y envíaselo al grupo. Tus amigos introducen su nombre y el código, sin necesitar la clave del anfitrión.

## Qué hace esta versión

- Crea salas compartidas con códigos de 10 caracteres.
- Muestra participantes conectados mediante Supabase Realtime Presence.
- Permite elegir la siguiente canción en directo mientras el tema actual sigue sonando; al terminar, la sala cambia al tema elegido. El anfitrión también puede reproducir, pausar, volver al inicio y buscar en la canción.
- Propaga el tema y el estado de reproducción a los invitados, con corrección periódica de desfases.
- Protege las filas de salas con RLS: los miembros solo pueden leer su sala y únicamente el anfitrión puede actualizar la reproducción.
- Conserva los MP3 en un bucket privado y entrega URLs firmadas temporales a los miembros.
- Incluye un minijuego de reflejos cuyo texto/tipo se define por canción.

## Límites que conviene saber

- Los navegadores pueden bloquear el audio iniciado a distancia hasta que cada invitado pulse **Activar audio** una vez. El anfitrión debe iniciar la reproducción desde su navegador.
- La web estática publicada en GitHub Pages sigue siendo accesible públicamente y la portada de `assets/portada.jpg` también. Las salas y los MP3 están protegidos, pero si necesitas ocultar incluso la portada y toda la web, tendrás que usar una capa de acceso antes de servir el frontend (GitHub Pages por sí solo no es una barrera de autenticación).
- El código de invitación funciona como credencial para unirse: compártelo solo con tus amigos. La clave de anfitrión protege la creación de salas; guárdala en privado.
- Las URLs firmadas del audio expiran. Para una sesión muy larga, vuelve a cargar el tema si un archivo deja de reproducirse.
- Si Supabase Realtime no conecta, comprueba que las tablas `rooms` y `room_members` estén incluidas en la publicación `supabase_realtime`.
