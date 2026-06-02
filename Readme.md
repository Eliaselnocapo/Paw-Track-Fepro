

## Estructura del Proyecto

Para evitar conflictos de código y mantener el orden, el repositorio se divide estrictamente en tres raíces funcionales. **Nadie debe mezclar dependencias fuera de su carpeta.**

* `frontend/` - Código de la interfaz (Territorio de Frontend).
* `backend/` - Lógica del servidor, APIs y reglas de negocio (Territorio de Backend).
* `database/` - Scripts, diagramas y migraciones base (Territorio de Base de Datos).
* `.gitignore` - El escudo protector del repositorio (Bloquea basura y credenciales).
* `README.md` - Este documento con las reglas del juego.

---

## Reglas del Repositorio

Debido a que el repositorio es **Privado**, GitHub no bloqueará físicamente los envíos accidentales por la terminal. Por lo tanto, la seguridad del proyecto depende de la disciplina de estos 5 pilares:

##  Flujo de Trabajo Diario (Paso a Paso)
Cada vez que vayas a trabajar en una nueva tarea, sigue este flujo exacto:

1. **Actualízate:** Asegúrate de tener lo último de tus compañeros.
    
        git checkout develop
        git pull origin develop

2. **Crea tu rama de trabajo:** Nómbrala según tu rol y la tarea.
    * *Frontend:* `git checkout -b front/login-pantalla`
    * *Backend:* `git checkout -b back/api-mascotas`

3. **Trabaja y haz commits locales:** Haz commits pequeños con mensajes claros.
    
        git add .
        git commit -m "Agrega endpoint de consulta de mascotas"

4. **Sube tu rama a GitHub:**
    
        git push origin tu-nombre-de-rama

5. **Crea el Pull Request (PR):** Ve a GitHub, abre un PR desde tu rama hacia `develop` y haz el merge tú mismo.
