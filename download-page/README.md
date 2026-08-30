# Página de descarga de Nur

Página estática para repartir el APK sin pasar por Google Play. Resuelve el problema de
«se descarga y al final falla»: sirve el `.apk` con el `Content-Type` correcto y da a la
gente las instrucciones para Samsung / Xiaomi / Play Protect.

## Archivos

| Archivo | Para qué |
|---|---|
| `index.html` | La página. Botón de descarga + instrucciones. |
| `_headers` | Cabeceras para Netlify / Cloudflare Pages (MIME `application/vnd.android.package-archive`). |
| `icon.png` | Logo / favicon (copia de `public/icon.png`). |

## Publicar (elige una)

### Opción 1 — GitHub Releases (recomendada como origen del APK)

1. `git init` en la raíz del proyecto si aún no es un repo, y súbelo a GitHub.
   Antes del primer `push` verifica que NO se suben secretos:
   - `.env.local` → cubierto por `*.local` y `.env*` en el `.gitignore` raíz.
   - `android/key.properties` y `android/app/*.keystore` → cubiertos por `android/.gitignore`.
   Comprueba con `git status` que ninguno aparece como «to be committed».
2. En GitHub → **Releases** → **Draft a new release** → tag `v1.0.1`.
3. Adjunta `app-release.apk` como **asset** y renómbralo a `nur.apk`.
4. La URL estable de descarga directa es:
   `https://github.com/USUARIO/REPO/releases/latest/download/nur.apk`
5. En `index.html`, cambia `href="nur.apk"` por esa URL. Ya puedes compartir el enlace a
   la página (o directamente el enlace del release).

### Opción 2 — Netlify / Cloudflare Pages / GitHub Pages

1. Sube el APK a esta carpeta como `nur.apk` (junto a `index.html`).
2. Despliega **solo esta carpeta** (`download-page/`) como sitio estático.
   - Netlify: arrastra la carpeta a app.netlify.com, o `netlify deploy --dir download-page`.
   - Cloudflare Pages / GitHub Pages: raíz de publicación = `download-page`.
3. `_headers` se aplica solo en Netlify y Cloudflare Pages. En GitHub Pages el `.apk` ya
   se sirve con el MIME correcto por defecto.

## Cómo repartirlo

- Comparte **el enlace** a la página o al release. Nunca el archivo `.apk` suelto.
- **WhatsApp no admite `.apk`**: si alguien lo reenvía por WhatsApp llega dañado y da
  «no se puede descargar / instalar». Manda el enlace.
- **Telegram** sí admite `.apk` como vía directa de reserva.

## Mensaje corto para pegar en el chat

> Descarga Nur desde aquí: <ENLACE>
> Ábrelo con Chrome. Si el navegador avisa, pulsa «Descargar de todos modos».
> Si ya la tenías instalada, desinstálala primero.
> Samsung: Ajustes → Seguridad y privacidad → Auto Blocker → desactívalo mientras instalas.
> Si sale «Bloqueada por Play Protect»: Más detalles → Instalar de todos modos.
