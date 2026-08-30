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

## Estado actual (2026-08-30)

- Repo: <https://github.com/saydencinasfedi-creator/nur-islamic-app> (público)
- APK: adjunto al release **v1.0.1** como `nur.apk`. URL directa siempre-la-última:
  `https://github.com/saydencinasfedi-creator/nur-islamic-app/releases/latest/download/nur.apk`
  (sirve con `Content-Type: application/vnd.android.package-archive`).
- `index.html` ya apunta a esa URL.
- Página publicada con **GitHub Pages** desde `main` / carpeta `/download-page`.

## Publicar una versión nueva del APK

1. Sube `versionCode` en `android/app/build.gradle`, `npm run build && npx cap sync android`,
   `cd android && ./gradlew assembleRelease`.
2. `cp android/app/build/outputs/apk/release/app-release.apk download-page/nur.apk`
3. `gh release create vX.Y.Z download-page/nur.apk --title "Nur X.Y.Z" --notes "..."`
   (o `gh release upload vX.Y.Z download-page/nur.apk --clobber` sobre un release existente).
   La URL `releases/latest/download/nur.apk` pasa a servir la nueva automáticamente.

## Alternativa de hosting (Netlify / Cloudflare Pages)

`_headers` fija el MIME correcto para el `.apk` en Netlify y Cloudflare Pages. Despliega
**solo** la carpeta `download-page/`. En GitHub Pages el `.apk` ya se sirve bien y el
`_headers` se ignora (no molesta).

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
