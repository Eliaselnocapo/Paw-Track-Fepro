from django.contrib.gis.db import models as gis_models
from django.db import models

from bd.models import Usuario, Incidencia


class Rescate(models.Model):
    ESTADOS_RESCATE = [
        ('EN_CAMINO',   'En Camino'),
        ('EN_SITIO',    'En Sitio'),
        ('EN_PROCESO',  'En Proceso'),
        ('EN_TRASLADO', 'En Traslado'),
        ('COMPLETADO',  'Completado'),
        ('CANCELADO',   'Cancelado'),
    ]

    incidencia = models.OneToOneField(
        Incidencia, on_delete=models.CASCADE, related_name='rescate_activo'
    )
    rescatista = models.ForeignKey(
        Usuario, on_delete=models.CASCADE, related_name='rescates_asignados'
    )
    estado = models.CharField(max_length=20, choices=ESTADOS_RESCATE, default='EN_CAMINO')
    fecha_aceptacion = models.DateTimeField(auto_now_add=True)
    fecha_cierre = models.DateTimeField(null=True, blank=True)

    # Campo inyectado para B2
    historial = models.JSONField(default=list)

    # ── Evidencia de cierre ───────────────────────────────────────────────
    # Antes la foto de cierre se escribía sobre incidencia.imagen, lo que
    # borraba la foto original del reportante. Ahora vive aquí: el reporte
    # conserva su "antes" y el rescate guarda su "después".
    closure_photo = models.ImageField(
        upload_to='cierres/%Y/%m/',
        null=True,
        blank=True,
        help_text='Foto de evidencia tomada al cerrar el rescate.',
    )

    # Dónde se cerró el caso. NO se valida contra la ubicación del reporte:
    # el animal se mueve y el voluntario lo traslada (clínica, refugio, su
    # casa). Este punto es dato del expediente, no un candado.
    closure_location = gis_models.PointField(
        srid=4326,
        null=True,
        blank=True,
        geography=True,
        help_text='Ubicación GPS del voluntario al momento del cierre.',
    )

    class Meta:
        indexes = [
            models.Index(fields=['rescatista', 'estado']),
            models.Index(fields=['estado', '-fecha_aceptacion']),
        ]

    def __str__(self):
        return f"Rescate {self.id} - Incidencia: {self.incidencia.folio}"