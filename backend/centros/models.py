from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


class PublicacionCentro(models.Model):
    """Entrada del mini-blog de un centro de apoyo (perfil publico)."""
    centro = models.ForeignKey('bd.PerfilPatrocinador', on_delete=models.CASCADE, related_name='publicaciones')
    contenido = models.TextField()
    imagen = models.ImageField(upload_to='centros/publicaciones/', blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'Publicacion #{self.pk} de {self.centro_id}'


class ResenaCentro(models.Model):
    """Resena de un usuario sobre un centro de apoyo, con respuesta
    opcional del dueno. Un usuario solo puede resenar un mismo centro una
    vez (constraint a nivel BD, ver Meta.constraints)."""
    centro = models.ForeignKey('bd.PerfilPatrocinador', on_delete=models.CASCADE, related_name='resenas')
    usuario = models.ForeignKey('bd.Usuario', on_delete=models.CASCADE, related_name='resenas_centros')
    calificacion = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    comentario = models.TextField(blank=True, default='')
    respuesta = models.TextField(blank=True, default='')
    respuesta_fecha = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(fields=['centro', 'usuario'], name='resena_unica_por_usuario_y_centro'),
        ]

    def __str__(self):
        return f'Resena #{self.pk} ({self.calificacion}*) de {self.centro_id}'


class SeguidorCentro(models.Model):
    """Relacion de 'seguir' entre un usuario y un centro de apoyo."""
    centro = models.ForeignKey('bd.PerfilPatrocinador', on_delete=models.CASCADE, related_name='seguidores')
    usuario = models.ForeignKey('bd.Usuario', on_delete=models.CASCADE, related_name='centros_seguidos')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['centro', 'usuario'], name='seguidor_unico_por_centro'),
        ]

    def __str__(self):
        return f'usuario {self.usuario_id} sigue a centro {self.centro_id}'