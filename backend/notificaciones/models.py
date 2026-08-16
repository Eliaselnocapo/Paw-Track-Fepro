from django.db import models

from bd.models import Usuario


class Notificacion(models.Model):
    """Notificación persistida para un usuario.

    El WebSocket (notify_user) solo alcanza a quien está conectado en ese
    momento. Esto guarda el aviso para que aparezca la próxima vez que entre.
    """

    TIPO_CHOICES = [
        ('reporte_aceptado',  'Tu reporte fue aceptado'),
        ('reporte_cerrado',   'Tu reporte fue cerrado'),
        ('reporte_cancelado', 'El rescate de tu reporte fue cancelado'),
        ('centro_publicacion','Publicación de un centro que sigues'),
        ('centro_aprobado',   'Tu centro fue aprobado'),
        ('centro_rechazado',  'Tu centro fue rechazado'),
    ]

    usuario = models.ForeignKey(
        Usuario, on_delete=models.CASCADE, related_name='notificaciones'
    )
    tipo = models.CharField(max_length=40, choices=TIPO_CHOICES)
    titulo = models.CharField(max_length=150)
    mensaje = models.CharField(max_length=300, blank=True, default='')

    # A dónde lleva al tocarla. Se guarda la ruta del front, no un id suelto:
    # así cada tipo de notificación decide su destino sin que el front tenga
    # que saber la regla de cada uno.
    enlace = models.CharField(max_length=255, blank=True, default='')

    leida = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            # La consulta más frecuente: las no leídas de un usuario.
            models.Index(fields=['usuario', 'leida', '-created_at']),
        ]

    def __str__(self):
        return f"{self.get_tipo_display()} -> {self.usuario_id}"