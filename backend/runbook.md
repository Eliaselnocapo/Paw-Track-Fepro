# Runbook de Recuperacion y Diagnostico

Los comandos se ejecutan desde `backend/`. Para pruebas aisladas se usa un nombre de
proyecto Compose unico; no reutilizar el entorno de desarrollo activo.

## Salud de dependencias

```bash
docker compose -p pawtrack-s8 exec db pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"
docker compose -p pawtrack-s8 exec redis redis-cli ping
```

La respuesta esperada es `accepting connections` para PostGIS y `PONG` para Redis.

## Migraciones y workers

```bash
docker compose -p pawtrack-s8 exec backend python manage.py makemigrations --check
docker compose -p pawtrack-s8 exec backend python manage.py migrate
docker compose -p pawtrack-s8 restart celery-worker celery-beat
docker compose -p pawtrack-s8 logs --tail=200 celery-worker celery-beat backend
```

El servicio `backend` y los workers deben esperar a PostGIS antes de iniciar. Si un
worker procesa una incidencia creada recientemente, el signal agenda el aprendizaje del
embedding con `transaction.on_commit()`, por lo que no se debe reintentar mientras la
transaccion de creacion siga abierta.

## Recurso sin liberar

1. Revisar el recurso y su incidencia desde la shell:

```bash
docker compose -p pawtrack-s8 exec backend python manage.py shell
```

```python
from recursos.models import Recurso
recurso = Recurso.objects.select_related('incidencia').get(id=RECURSO_ID)
print(recurso.estado, recurso.incidencia.estado, recurso.released_at)
```

2. Si la incidencia no esta en `CERRADO`, no liberar manualmente el recurso: completar el
flujo de rescate primero.
3. Si esta cerrada y el recurso permanece `BLOQUEADO`, repetir `PATCH
/api/recursos/{id}/liberar/` con el JWT del patrocinador propietario. La operacion es
idempotente y protege la fila con una transaccion y `select_for_update()`.
