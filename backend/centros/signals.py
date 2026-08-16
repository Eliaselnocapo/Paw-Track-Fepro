"""Avisa al dueño cuando su solicitud de centro cambia de estado.

Va por signal y no en una vista porque la aprobación se hace desde el admin
de Django, no por API: no hay un endpoint donde poner el aviso.
"""
from django.db.models.signals import pre_save, post_save
from django.dispatch import receiver

from bd.models import PerfilPatrocinador


@receiver(pre_save, sender=PerfilPatrocinador)
def _guardar_estado_anterior(sender, instance, **kwargs):
    if not instance.pk:
        instance._estado_anterior = None
        return
    anterior = PerfilPatrocinador.objects.filter(pk=instance.pk).values_list('estado', flat=True).first()
    instance._estado_anterior = anterior


@receiver(post_save, sender=PerfilPatrocinador)
def _notificar_cambio_de_estado(sender, instance, created, **kwargs):
    if created:
        return

    anterior = getattr(instance, '_estado_anterior', None)
    if anterior == instance.estado:
        return

    from notificaciones.services import crear_notificacion

    if instance.estado == 'APROBADO':
        crear_notificacion(
            instance.usuario_id,
            tipo='centro_aprobado',
            titulo='Tu centro fue verificado',
            mensaje='Ya aparece en el directorio con el distintivo de verificado.',
            enlace='/mi-centro',
        )
    elif instance.estado == 'RECHAZADO':
        crear_notificacion(
            instance.usuario_id,
            tipo='centro_rechazado',
            titulo='Tu solicitud no fue aprobada',
            mensaje=instance.motivo_rechazo or 'Revisa los datos y vuelve a intentarlo.',
            enlace='/registrar-centro',
        )