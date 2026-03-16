# Buscador de medicamentos (CIMA)

Aplicación web estática para consulta rápida de medicamentos autorizados en España usando la API pública de CIMA (AEMPS).

## ¿Qué hace esta web?

- Permite buscar medicamentos por:
  - **Nombre comercial**
  - **Principio activo**
  - **Código ATC**
- Muestra resultados en formato tarjeta con información clave:
  - Nombre del medicamento
  - Principio activo
  - Laboratorio titular
  - Vía de administración
  - Código ATC
  - Número de registro
- Incluye enlaces directos a documentos oficiales, cuando están disponibles:
  - **Ficha técnica**
  - **Prospecto**

## ¿Cómo funciona la búsqueda?

1. Selecciona el tipo de búsqueda.
2. Escribe un término (mínimo 2 caracteres).
3. Mientras escribes, se cargan sugerencias automáticas.
4. Pulsa **Buscar** para listar resultados.

### Detalles técnicos relevantes

- La aplicación usa `fetch` contra `https://cima.aemps.es/cima/rest/medicamentos`.
- Incorpora **debounce** en autocompletado para reducir llamadas innecesarias.
- Implementa una **caché en memoria** por consulta para reutilizar respuestas.
- Muestra estados de usuario claros:
  - "Buscando..."
  - "Sin resultados"
  - Errores de conexión/API

## Estructura del proyecto

- `index.html`: estructura y contenido accesible.
- `styles.css`: estilos responsive y diseño visual.
- `script.js`: lógica de búsqueda, renderizado, sugerencias y control de errores.

## Despliegue en GitHub Pages

1. Sube estos archivos a un repositorio de GitHub.
2. Ve a **Settings → Pages**.
3. En **Build and deployment**, selecciona:
   - **Source**: `Deploy from a branch`
   - **Branch**: `main` (o la rama que uses) y carpeta `/root`
4. Guarda la configuración.
5. GitHub publicará la web en una URL como:
   `https://tu-usuario.github.io/tu-repo/`

> Al ser una web estática, no necesita backend ni pasos de build.

---

Datos procedentes del Centro de Información online de Medicamentos de la Agencia Española de Medicamentos y Productos Sanitarios (CIMA).
