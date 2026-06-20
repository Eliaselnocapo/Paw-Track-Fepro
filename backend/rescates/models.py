from django.db import models
from bd.models import Usuario, Incidencia

class Rescate(models.Model):
    ESTADOS_RESCATE = [
        ('EN_CAMINO', 'En Camino'),
        ('COMPLETADO', 'Completado'),
        ('CANCELADO', 'Cancelado'),
    ]

    incidencia = models.OneToOneField(Incidencia, on_delete=models.CASCADE, related_name='rescate_activo')
    rescatista = models.ForeignKey(Usuario, on_delete=models.CASCADE, related_name='rescates_asignados')
    estado = models.CharField(max_length=20, choices=ESTADOS_RESCATE, default='EN_CAMINO')
    fecha_aceptacion = models.DateTimeField(auto_now_add=True)
    fecha_cierre = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"Rescate {self.id} - Incidencia: {self.incidencia.folio}"
