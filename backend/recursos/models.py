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
