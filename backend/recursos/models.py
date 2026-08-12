from django.db import models


class Recurso(models.Model):
    ESTADOS = (
        ('BLOQUEADO', 'Bloqueado'),
        ('LIBERADO', 'Liberado'),
    )

    incidencia = models.ForeignKey('bd.Incidencia', on_delete=models.CASCADE, related_name='recursos')
    patrocinador = models.ForeignKey('bd.PerfilPatrocinador', on_delete=models.CASCADE, related_name='recursos')
    tipo = models.CharField(max_length=50)
    descripcion = models.TextField(blank=True, default='')
    estado = models.CharField(max_length=15, choices=ESTADOS, default='BLOQUEADO')
    released_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['estado', 'incidencia']),
            models.Index(fields=['patrocinador']),
        ]
        constraints = [
            # LIBERADO siempre debe traer released_at, y BLOQUEADO nunca —
            # evita que un bug de servicio deje el par estado/released_at
            # incoherente (p.ej. liberar sin setear la fecha, o un rollback
            # parcial que deje released_at puesto pero el estado en BLOQUEADO).
            models.CheckConstraint(
                check=(
                    models.Q(estado='LIBERADO', released_at__isnull=False)
                    | models.Q(estado='BLOQUEADO', released_at__isnull=True)
                ),
                name='recurso_estado_released_at_coherente',
            ),
        ]


class HistorialRecurso(models.Model):
    """Trazabilidad append-only: un evento por asignacion/liberacion.

    Solo se crean filas nuevas (ver recursos/services.py) — nunca se
    actualizan ni se borran, a diferencia de Recurso.estado que sí cambia.
    """
    TIPOS_EVENTO = (
        ('ASIGNADO', 'Asignado'),
        ('LIBERADO', 'Liberado'),
    )

    recurso = models.ForeignKey(Recurso, on_delete=models.CASCADE, related_name='historial')
    tipo_evento = models.CharField(max_length=15, choices=TIPOS_EVENTO)
    actor = models.ForeignKey('bd.Usuario', on_delete=models.SET_NULL, null=True, related_name='+')
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['timestamp']
        indexes = [
            models.Index(fields=['recurso', 'timestamp']),
        ]