# LA SALA — prototipo de álbum-concierto

Prototipo visual estático en español, preparado para personalizar y subir a un repositorio de GitHub. No necesita Node ni instalar dependencias: abre `index.html` en el navegador.

## Poner tu portada y canción

Copia los archivos definitivos en `assets/` con estos nombres exactos:

- `assets/portada.jpg` — portada del álbum. Se muestra con recorte adaptado al marco.
- `assets/cancion-prueba.mp3` — canción de prueba.

Si la portada o la canción no están presentes, se verá una cubierta provisional y el reproductor mostrará un aviso. Puedes cambiar el título del tema y añadir canciones editando el objeto `tracks` de `app.js` y las opciones de `#trackSelect` en `index.html`.

## Qué funciona en esta primera maqueta

- Diseño responsive con estilo de álbum/concierto.
- Reproductor HTML de audio con play/pause, búsqueda, volumen y visualizador animado.
- Flujo visual para crear una sala, entrar mediante código, copiar invitación y salir.
- Mesa de mezclas de anfitrión y un minijuego de reacción de demostración.

## Importante: las salas son todavía una simulación local

Esta maqueta no sincroniza a varias personas ni impide que alguien abra la página sin invitación. El botón de crear sala genera un código en el navegador, pero no existe aún un servidor que comparta el estado. No la anuncies como privada ni como un directo real en esta fase.

Para implementar las funciones reales, la propuesta es:

1. **Supabase Auth** para que solo tus amigos autorizados puedan entrar.
2. **Supabase Realtime** para presencia de participantes y eventos de sala (cambio de canción, pausa, salto y estado del juego).
3. **Base de datos con políticas RLS** para asegurar que solo el anfitrión controle la reproducción.
4. **Almacenamiento privado o URLs firmadas** para los MP3 si no quieres que cualquiera con un enlace pueda escucharlos.
5. **GitHub Pages** para servir el frontend; la visibilidad y la autenticación deben configurarse por separado.

No pongas una clave `service_role` ni secretos del servidor en archivos del frontend o en el repositorio.

## Publicarlo en GitHub Pages

Sube el contenido del proyecto a la rama principal. En GitHub ve a **Settings → Pages** y elige la fuente de despliegue apropiada para tu repositorio. GitHub Pages sirve ficheros estáticos; no proporciona por sí solo sesiones, una base de datos ni sincronización en tiempo real.
