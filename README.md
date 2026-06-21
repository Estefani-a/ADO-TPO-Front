# 🎮 eSports Scrims Frontend

**Proyecto npm independiente** (React + Vite + TypeScript). No incluye ni importa código del backend: solo hace `fetch` a una API HTTP que exponga las rutas bajo `/api/...`.

Podés copiar **solo esta carpeta (frontend)** a otro directorio o repo, ejecutar `npm install` y `npm run dev`; no hace falta clonar el proyecto Java.

## Requisitos

- Node 20+ (recomendado)
- Una API REST accesible por HTTP (por defecto se asume `http://localhost:8080` vía proxy en desarrollo).

## 💡 Conectividad con el Backend (Importante)

El backend de este proyecto se encuentra en [este repositorio](https://github.com/Estefani-a/ADO-TPO-Back.git). Para que el frontend funcione correctamente y pueda consumir los datos, la API de Java debe estar corriendo en paralelo.

### Cómo ejecutar el Backend Java:
1. Asegurate de tener instalado **Java JDK 21** y **Maven 3.8+**.
2. Cloná o abrí la carpeta del proyecto backend.
3. El servidor se inicia ejecutando el archivo principal **`ApiServer.java`**, el cual se encuentra dentro del paquete `api` (`src/main/java/api/ApiServer.java`).
4. Podés levantarlo de dos formas:
    - **Desde la terminal:**
      ```bash
      cd backend
      mvn compile exec:java -Dexec.mainClass="api.ApiServer"
      ```
    - **Desde IntelliJ / Eclipse:** Abrí el proyecto backend, esperá que Maven descargue las dependencias y dale *Run* directamente al archivo `api.ApiServer`.

El backend quedará escuchando en **http://localhost:8080**, que es el puerto que el proxy de este frontend buscará por defecto.

---

## Configuración

Copiá `.env.example` a `.env` y ajustá:

| Variable | Uso |
|----------|-----|
| `VITE_PROXY_TARGET` | En `npm run dev`, adónde reenvía Vite las rutas `/api/*` (default `http://localhost:8080`). |
| `VITE_API_BASE` | Si la definís (p. ej. `http://localhost:8080`), las peticiones van directo a esa URL y **no** usan el proxy. Dejala vacía para usar proxy en dev. |
| `VITE_API_DEBUG` | `true`: en build/preview también se loguea cada llamada API en la consola. `false`: desactiva logs aunque estés en dev. Si no la definís, en `npm run dev` los logs están **activos** (método, URL, cabeceras, payload y respuesta; el token Bearer se muestra oculto). |

El archivo `.npmrc` fija el registry público de npm para evitar depender de mirrors corporativos al instalar.

## Desarrollo
Una vez que el backend de Java (`ApiServer.java`) ya esté corriendo, ejecutá en esta carpeta del frontend:

```bash
npm install
npm run dev
```

Abrí la URL que muestra Vite (suele ser `http://localhost:5173`).

## Build / preview

```bash
npm run build
npm run preview
```

Para producción, normalmente definís `VITE_API_BASE` con la URL pública del backend en el momento del build o servís front y API bajo el mismo origen.

## Contrato de API

La UI espera endpoints como `GET /api/health`, `POST /api/auth/login`, `GET /api/auth/session`, `POST /api/scrims`, etc. El login valida contra **cuentas mock** en el backend y devuelve un `sessionToken` guardado en `sessionStorage` para las demás llamadas (`Authorization: Bearer`).

## Cuentas demo (misma lista que `GET /api/auth/demo-accounts`)

| Email | Contraseña | Rol |
|--------|------------|-----|
| `admin@escrims.com` | `1234` | Organizador |
| `coach@escrims.com` | `coach2024` | Coach |
| `ana@escrims.com` | `scrim24` | Capitana |
| `org@uade.edu.ar` | `uade2025` | Institucional |

## Flujo sugerido en la UI

1. **Ingresar** con email y contraseña (o “Usar” en la tabla demo).
2. **Comprobar API** si querés validar conectividad.
3. **Cargar jugadores** y opcionalmente **verificar email**.
4. **Crear sala** → **Buscar jugadores** (lista candidatos) → **Roles**: elegís jugador/candidato y **Asignar** para sumarlo o cambiar rol → **Deshacer** (solo último cambio de rol en sala).
5. **Confirmar** → **Iniciar** → **Finalizar** o **Cancelar**.
6. **Notificaciones** y canales.
7. **Salir** cierra sesión en servidor y borra el token local.
