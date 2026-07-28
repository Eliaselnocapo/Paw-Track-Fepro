from django.db import transaction
from django.utils import timezone
from .models import Recurso
from bd.models import PerfilPatrocinador, Incidencia # Ajustar al import real

def asignar_recurso(patrocinador_id, incidencia_id, tipo, descripcion):
    patrocinador = PerfilPatrocinador.objects.get(id=patrocinador_id)
    incidencia = Incidencia.objects.get(id=incidencia_id)
    
    if not patrocinador.aprobado: # PATROCINADOR requiere aprobación
        raise ValueError({"code": "patrocinador_invalido", "detail": "El patrocinador no está aprobado."})
        
    return Recurso.objects.create(
        patrocinador=patrocinador,
        incidencia=incidencia,
        tipo=tipo,
        descripcion=descripcion
    )

@transaction.atomic
def liberar_recurso(recurso_id, usuario_solicitante):
    # Bloqueo de fila para evitar condiciones de carrera
    recurso = Recurso.objects.select_for_update().get(id=recurso_id)

    # Comprobar ownership
    if recurso.patrocinador.usuario != usuario_solicitante:
        raise PermissionError({"code": "forbidden", "detail": "No eres propietario del recurso."})

    # Validación de estado CERRADO
    if recurso.incidencia.estado != 'CERRADO':
        raise ValueError({"code": "incidencia_abierta", "detail": "La incidencia debe estar CERRADO."})

    # Idempotencia: si ya está liberado, devolver sin alterar
    if recurso.estado == 'LIBERADO':
        return recurso

    # Cambio de estado
    recurso.estado = 'LIBERADO'
    recurso.released_at = timezone.now()
    recurso.save(update_fields=['estado', 'released_at'])
    
    return recurso