

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

## 🤝 El "Pacto de Honor" (Los 5 Pilares)

Debido a que el repositorio es **Privado**, GitHub no bloqueará físicamente los envíos accidentales por la terminal. Por lo tanto, la seguridad del proyecto depende de la disciplina de nuestro equipo basada en estos 5 pilares:

### 1. Las Ramas Sagradas son Intocables
Las ramas `main` (Producción) y `develop` (Integración) son intocables desde la terminal. **PROHIBIDO** hacer `git push` directo a ellas.

### 2. Todo entra por Pull Request (PR)
Cualquier cambio se trabaja en una rama individual (ej. `front/login` o `back/api`) y se integra a `develop` exclusivamente creando un Pull Request en GitHub.

### 3. Fusión Responsable
No tenemos bloqueos de aprobación para ir rápido. Tú mismo puedes darle al botón verde de "Merge" en tu propio PR, pero **debes probar tu código localmente antes de fusionarlo**. 

### 4. Aislamiento de Territorios
Respetamos la arquitectura del Monorepo. El equipo de frontend solo toca la carpeta `/frontend` y el de backend solo `/backend`. 

### 5. Cero Secretos en la Nube
Absolutamente prohibido subir contraseñas de bases de datos o tokens de APIs. Las credenciales viven solo en las computadoras locales. 

---

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