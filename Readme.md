
## 1. Arquitectura del Repositorio (Monorepo)
El proyecto opera bajo un modelo de Monorepo estructurado por dominios de responsabilidad. La regla fundamental es el aislamiento estricto de dependencias. Ningún entorno virtual ni gestor de paquetes debe inicializarse en la raíz del proyecto.

/frontend: Contiene exclusivamente el código cliente, interfaces y dependencias de UI (ej. node_modules).

/backend: Contiene la lógica de negocio, APIs, configuración de servidores (ej. Django) y dependencias aisladas (ej. venv).

/database: Contiene diagramas de entidad-relación, scripts de inicialización SQL y esquemas.

.gitignore: Configurado a nivel raíz para bloquear la subida de entornos virtuales (venv), carpetas de módulos, archivos compilados y credenciales/variables de entorno (.env). Cero secretos en la nube.

## 2. Gestión de Ramas (Branching Model)
El ciclo de vida del código se administra mediante un modelo basado en ramas protegidas por políticas de equipo (Pacto de Honor, dado que el repositorio es privado en plan gratuito).

main (Producción): Es la fuente de la verdad. Contiene código 100% probado y desplegable. Queda estrictamente prohibido realizar un git push directo a esta rama.

develop (Integración): Actúa como el entorno de pruebas unificado. Aquí convergen las ramas de los 5 desarrolladores. Queda estrictamente prohibido realizar un git push directo a esta rama.

Ramas de Funcionalidad (Feature Branches): Ramas efímeras creadas a partir de develop para desarrollar una tarea específica. Deben seguir una convención de nomenclatura basada en el rol:

front/nombre-de-tarea

back/nombre-de-tarea

db/nombre-de-tarea

## 3. Protocolo Diario de Desarrollo (Subida de Cambios)
Todo desarrollador debe apegarse al siguiente ciclo de trabajo para introducir nuevo código al proyecto:

Sincronización: Actualizar el entorno local con los últimos cambios de integración.

Bash
git checkout develop
git pull origin develop
Aislamiento: Crear la rama de trabajo específica.

Bash
git checkout -b rol/nombre-tarea
Desarrollo y Commits: Realizar confirmaciones atómicas y descriptivas.

Bash
git add .
git commit -m "Descripción clara de la funcionalidad o corrección"
Publicación de la Rama: Subir la rama de trabajo al repositorio remoto.

Bash
git push origin rol/nombre-tarea
Integración (Pull Request): Acceder a GitHub y abrir un Pull Request desde la rama de trabajo hacia develop.

Política de Aprobación: Para mantener agilidad, el mismo autor puede aprobar y fusionar (Merge) su propio PR, bajo la responsabilidad ineludible de haber probado el código localmente sin detectar errores.

## 4. Despliegue a Producción (develop hacia main)
La promoción de código de integración a producción no es un proceso diario. Se realiza únicamente cuando el equipo define que hay una versión estable.

Un responsable (Tech Lead o encargado de despliegue) se sitúa en GitHub.

Abre un Pull Request desde la rama develop hacia la rama main.

A diferencia del código diario, este PR sí requiere revisión del equipo. Los líderes de frontend y backend deben confirmar que todo es funcional.

Una vez verificado, se realiza el Merge a main.

(Opcional pero recomendado) Se genera un "Release" o un "Tag" en GitHub (ej. v1.0.0) para marcar el hito de producción.

## 5. Protocolo de Mitigación de Daños (Recuperación de Errores)
Los errores humanos ocurrirán. La política establece que nunca se debe utilizar git push --force para reescribir la historia pública. Se utilizarán métodos seguros de reversión:

Escenario A: Un error ya se fusionó en develop o main
No se debe borrar el commit defectuoso. Se debe generar un commit inverso que anule los cambios, preservando el registro histórico.

Bash
git log # (Para buscar el identificador/hash del commit problemático)
git revert <HASH_DEL_COMMIT>
git push origin develop

Escenario B: Desastre en el entorno local (antes de subir a GitHub)
Si un desarrollador elimina archivos, rompe su código o hace un git reset destructivo en su máquina, se debe utilizar el registro de movimientos del cabezal para viajar en el tiempo.

Bash
git reflog # (Lista todo el historial local, incluso lo borrado)
git reset --hard HEAD@{numero_de_paso_previo_al_error}
