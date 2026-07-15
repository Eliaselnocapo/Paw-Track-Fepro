from django.conf import settings
from django.db import models


class SugerenciaDuplicado(models.Model):
    """
    Registro de auditoría de una decisión de deduplicación tomada por el
    reportante DURANTE la creación del reporte (paso 4 del wizard, ver
    bd.views.IncidenciaViewSet.verificar_duplicado y .create()). El chequeo
    corre de forma síncrona ANTES de guardar nada: si el sistema encuentra
    un candidato, se le pregunta al reportante ahí mismo, y esta fila se crea
    ya resuelta (CONFIRMADA o RECHAZADA) en el mismo request que crea la
    Incidencia — nunca queda en PENDIENTE esperando una acción posterior.
    Sirve como historial para calibrar UMBRAL_REVISION más adelante (¿cuántas
    sugerencias se confirman vs. se rechazan?), no como cola de trabajo.
    Ver decision-tecnica-filtro-raza.md, punto 6: la fusión nunca la decide
    el sistema solo, la decide el humano — aquí solo se deja constancia de
    lo que decidió.
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
