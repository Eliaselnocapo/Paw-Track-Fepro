from django.db import models

from bd.models import Usuario, Incidencia


class ReporteFraude(models.Model):
    """Una denuncia de un usuario autenticado sobre una incidencia que
    considera falsa o de mal uso. Fuente de verdad para el conteo (el
    contador denormalizado vive en Incidencia.reportes_fraude_count) y para
    la auditoría que ve el admin en la cola de moderación."""

    incidencia = models.ForeignKey(
        Incidencia, on_delete=models.CASCADE, related_name='reportes_fraude',
    )
    usuario_reporta = models.ForeignKey(
        Usuario, on_delete=models.CASCADE, related_name='fraude_reportado',
    )
    motivo = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['incidencia', 'usuario_reporta'],
                name='un_reporte_fraude_por_usuario_por_incidencia',
            )
        ]

    def __str__(self):
        return f"Denuncia sobre {self.incidencia.folio} por usuario {self.usuario_reporta_id}"
