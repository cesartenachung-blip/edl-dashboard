# Dashboard Escuela de Líderes — Sede Agua Viva Surco, Red García Montoya

Dashboard público (sin login) en Vercel. Lee y escribe los Excel de Google Drive:

- Equipo Principal: `Reporte de Avance Inscritos Equipo Principal.xlsx` (hoja `Adultos`)
- Equipo Next: `Reporte de Avance Inscritos Equipo Next.xlsx` (hoja `Next`)

## Cómo funciona

- Drive es la única fuente de datos. En la pestaña **Subir archivo**, un solo Excel o PDF actualiza los dos equipos.
- Formato principal: **Lista de Personas Matriculadas a Escuela** (PDF o Excel del sistema). El dashboard cuenta por código de grupo:
  - LIDER: el líder matriculado (aparece en el grupo C18, C28, C18J o C28J y se identifica por nombre).
  - DISC: matriculados del grupo del líder (ej. grupo C186 → DISC de C186). C18J y C28J del Equipo Principal suman además todos los subgrupos Next.
  - TOTAL = LIDER + DISC. Antes de guardar puedes corregir a qué líder corresponde cada matriculado.
- También acepta la tabla de avance (COD, LOGRO, LIDER, DISC, TOTAL).
- Flujo: subir archivo > revisar cambios por equipo > **Guardar en Drive** > **Actualizar dashboard**. No hay actualización programada.
- Solo se actualizan **LIDER, DISC y TOTAL** por código. LOGRO, nombres, formatos y fórmulas del Excel no se tocan.
- Equipo Principal: líderes C18x (hombres) y C28x (mujeres), ej. C181, C18A, C28J.
- Equipo Next: líderes C18Jx (hombres) y C28Jx (mujeres), ej. C18J1, C28JA.
- Cada código se envía al Excel de su equipo según su prefijo.
- Códigos que no existen en Drive no se agregan: se avisa para que primero crees la fila en el Excel.
- Drive guarda versiones anteriores del archivo (clic derecho > Administrar versiones) por si necesitas revertir.

## Detalle Inscritos
- Muestra solo **GRUPO, ALUMNO y CURSO** de la última lista de matriculados subida, con buscador y filtros.
- No se guarda el PDF, ni DNI, celulares o correos. El código de miembro al final del nombre también se quita.
- Se guarda en Vercel Blob (no en Drive) al presionar **Guardar en Drive**, y reemplaza la lista anterior.
- Configuración (una vez): Vercel > tu proyecto > **Storage** > **Create** > **Blob** > conectar al proyecto > **Redeploy**.
- `DETALLE_KEY` es opcional.

## Puesta en marcha (una sola vez)

### 1. Cuenta de servicio de Google
1. https://console.cloud.google.com > crea un proyecto (ej. `edl-dashboard`).
2. **APIs y servicios > Biblioteca** > habilita **Google Drive API**.
3. **IAM > Cuentas de servicio** > Crear > nombre `edl-dashboard` > Listo.
4. Entra a la cuenta > **Claves > Agregar clave > JSON**. Se descarga un archivo `.json`.
5. Copia el correo de la cuenta (`edl-dashboard@...iam.gserviceaccount.com`).

### 2. Compartir los 2 Excel
En Drive, comparte cada archivo con ese correo como **Editor**.

### 3. Vercel
1. Sube esta carpeta a un repositorio de GitHub.
2. https://vercel.com/new > importa el repo (framework: Next.js, sin cambios).
3. **Settings > Environment Variables**:
   - `GOOGLE_SERVICE_ACCOUNT_JSON` = contenido completo del `.json` descargado.
   - `UPLOAD_KEY` = opcional, ver abajo.
4. **Deploy**. Listo: el link `https://<proyecto>.vercel.app` es público.

### Clave de carga (recomendado)
Sin login, cualquiera con el link podría subir un archivo. Si defines `UPLOAD_KEY`, la pestaña de carga pide esa clave solo al momento de guardar. Ver el dashboard sigue siendo libre.

## Personalizar
- Logo: reemplaza `public/logo.png` (y `app/icon.png` para el ícono de la pestaña).
- Si editas el Excel directamente en Drive, el dashboard no lo verá hasta la siguiente carga (o un nuevo deploy en Vercel).
- Otro archivo u hoja: `FILE_ID_PRINCIPAL`, `SHEET_PRINCIPAL`, `FILE_ID_NEXT`, `SHEET_NEXT`.

## Desarrollo local
```
npm install
DEV_LOCAL_DIR=./local npm run dev   # usa ./local/<fileId>.xlsx en lugar de Drive
```
