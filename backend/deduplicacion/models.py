from django.conf import settings
from django.db import models


class SugerenciaDuplicado(models.Model):
    """
    Registro de auditoría de una decisión de deduplicación RECHAZADA tomada
    por el reportante DURANTE la creación del reporte (paso 4 del wizard,
    ver bd.views.IncidenciaViewSet.verificar_duplicado y .create()). Si el
    reportante confirma que es el mismo caso, la Incidencia nueva se borra
    de inmediato (ver deduplicacion.services.descartar_duplicado) — no
    queda una Incidencia a la cual apuntar, así que ese caso nunca genera
    fila aquí (CONFIRMADA ya no se usa, se deja en ESTADO_CHOICES por si se
    retoma el historial de confirmaciones más adelante). Solo el rechazo
    deja constancia, para que el reporte quede como caso independiente sin
    perder de vista que el sistema sugirió (y el humano descartó) un
    candidato. Ver decision-tecnica-filtro-raza.md, punto 6: la decisión
    nunca la toma el sistema solo, la toma el humano.
    """
    ESTADO_CHOICES = [
        ('PENDIENTE', 'Pendiente de confirmación'),
        ('CONFIRMADA', 'Confirmada — mismo caso'),
        ('RECHAZADA', 'Rechazada — casos distintos'),
    ]

    incidencia_nueva = models.OneToOneField(
        'bd.Incidencia', on_delete=models.CASCADE, related_name='sugerencia_duplicado',
    )
    incidencia_candidata = models.ForeignKey(
        'bd.Incidencia', on_delete=models.CASCADE, related_name='sugerido_como_candidata',
    )
    score = models.FloatField()
    estado = models.CharField(max_length=20, choices=ESTADO_CHOICES, default='PENDIENTE')

    created_at = models.DateTimeField(auto_now_add=True)
    resuelto_at = models.DateTimeField(null=True, blank=True)
    resuelto_por = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
    )

    def __str__(self):
        return f"Sugerencia #{self.pk}: incidencia {self.incidencia_nueva_id} ~ {self.incidencia_candidata_id} ({self.estado})"
