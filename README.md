# Family Tasks

Aplicación web sencilla para coordinar y gestionar tareas familiares. Permite a los miembros de la familia añadir, completar, editar, eliminar y reordenar tareas.

## Características

- Autenticación de usuarios con Google OAuth.
- Gestión de tareas (CRUD: Crear, Leer, Actualizar, Eliminar).
- Reordenamiento de tareas mediante arrastrar y soltar.
- Interfaz de usuario simple y responsive (gracias a Tailwind CSS y DaisyUI).

## Tecnologías Utilizadas

- **Frontend:**
    - HTML, CSS (Tailwind CSS, DaisyUI)
    - JavaScript modular
    - Font Awesome (iconos)
    - SortableJS (arrastrar y soltar)
- **Backend:**
    - Supabase (Base de datos, Autenticación)

## Configuración y Ejecución

1.  **Clonar el repositorio:**
    ```bash
    git clone [URL del repositorio]
    cd family-todo
    ```

2.  **Instalar dependencias (si `package.json` tuviera dependencias):**
    Actualmente, las dependencias de frontend se cargan vía CDN. Si se añadieran dependencias de Node.js en el futuro, ejecutar:
    ```bash
    npm install
    ```

3.  **Configurar Supabase:**
    - Crea un proyecto en [Supabase](https://supabase.com/).
    - Configura la autenticación de Google OAuth en tu proyecto de Supabase.
    - Crea una tabla llamada `tasks` con las columnas necesarias (ej: `id`, `task_text`, `is_complete`, `owner_user_id`, `created_by_user_id`, `last_modified_by_user_id`, `created_at`, `updated_at`, `order`).
    - Configura las políticas de Row Level Security (RLS) para controlar el acceso a los datos de la tabla `tasks` basándote en el usuario autenticado.
    - **Importante:** Reemplaza `supabaseUrl` y `supabaseKey` en `script.js` con las claves de tu proyecto Supabase. Considera usar variables de entorno para mayor seguridad en un entorno de producción.
    - **Lista Blanca:** La aplicación incluye una lista blanca básica de correos electrónicos en `script.js` (`userDisplayNameMap`). Para restringir el acceso, deberás implementar la lógica de lista blanca adecuada, posiblemente utilizando RLS en Supabase.

4.  **Ejecutar el proyecto con Browser-Sync:**
    Asegúrate de tener Browser-Sync instalado globalmente (`npm install -g browser-sync`).
    ```bash
    browser-sync start --server --files "index.html,./**/*.js,./**/*.css"
    ```
    Esto iniciará un servidor local y observará los cambios en los archivos HTML, JS y CSS para recargar automáticamente el navegador.

5.  **Abrir la aplicación:**
    Abre tu navegador en la dirección proporcionada por Browser-Sync (normalmente `http://localhost:3000/`).

## Próximas Mejoras

Aquí hay algunas ideas para futuras iteraciones de la aplicación:

-   **Generalizar la aplicación:** Permitir que cualquier usuario se registre y cree su propia lista de tareas privada.
-   **Colaboración en listas:** Implementar la funcionalidad para que el creador de una lista pueda invitar a otros usuarios a ver y editar su lista.
-   **Control de acceso:** Asegurar que el creador de la lista mantenga la propiedad y el control total sobre quién tiene acceso a su lista, con la capacidad de revocar el acceso.

## Contribuciones

Las contribuciones son bienvenidas. Por favor, abre un "issue" o envía un "pull request".

## Licencia

[Especificar licencia, ej: MIT]

## Contacto

[Tu información de contacto o perfil de GitHub]
