"""Extiende PerfilPatrocinador para que sea también el modelo de "centro de
apoyo" (veterinaria/refugio) que pide el frontend: renombra los campos que
ya teníamos (nombre_entidad->nombre, telefono_contacto->telefono,
ubicacion->direccion, tipo_entidad->tipo), agrega geolocalización real
(ubicacion_geo) y los campos del perfil público (banner, logo, mision,
vision, formas_ayuda, redes_sociales, sitio_web, descripcion), y convierte
aprobado (booleano) en estado (PENDIENTE/APROBADO/RECHAZADO) para poder
rechazar con motivo.
"""
import django.contrib.gis.db.models
import django.utils.timezone
from django.db import migrations, models


def poblar_estado_desde_aprobado(apps, schema_editor):
    PerfilPatrocinador = apps.get_model('bd', 'PerfilPatrocinador')
    PerfilPatrocinador.objects.filter(aprobado=True).update(estado='APROBADO')
    PerfilPatrocinador.objects.filter(aprobado=False).update(estado='PENDIENTE')


def revertir_estado_a_aprobado(apps, schema_editor):
    PerfilPatrocinador = apps.get_model('bd', 'PerfilPatrocinador')
    PerfilPatrocinador.objects.filter(estado='APROBADO').update(aprobado=True)
    PerfilPatrocinador.objects.exclude(estado='APROBADO').update(aprobado=False)


def normalizar_tipo(apps, schema_editor):
    PerfilPatrocinador = apps.get_model('bd', 'PerfilPatrocinador')
    mapa = {
        'EMPRESA': 'otro',
        'REFUGIO': 'refugio',
        'ASOCIACION': 'otro',
        'OTRO': 'otro',
    }
    for viejo, nuevo in mapa.items():
        PerfilPatrocinador.objects.filter(tipo=viejo).update(tipo=nuevo)


def revertir_tipo(apps, schema_editor):
    PerfilPatrocinador = apps.get_model('bd', 'PerfilPatrocinador')
    mapa = {'veterinaria': 'OTRO', 'refugio': 'REFUGIO', 'otro': 'OTRO'}
    for nuevo, viejo in mapa.items():
        PerfilPatrocinador.objects.filter(tipo=nuevo).update(tipo=viejo)


class Migration(migrations.Migration):

    dependencies = [
        ('bd', '0018_perfilpatrocinador_aprobado_and_more'),
    ]

    operations = [
        migrations.RemoveConstraint(
            model_name='perfilpatrocinador',
            name='datos_entidad_requeridos',
        ),
        migrations.RenameField(
            model_name='perfilpatrocinador',
            old_name='nombre_entidad',
            new_name='nombre',
        ),
        migrations.RenameField(
            model_name='perfilpatrocinador',
            old_name='telefono_contacto',
            new_name='telefono',
        ),
        migrations.RenameField(
            model_name='perfilpatrocinador',
            old_name='ubicacion',
            new_name='direccion',
        ),
        migrations.RenameField(
            model_name='perfilpatrocinador',
            old_name='tipo_entidad',
            new_name='tipo',
        ),
        migrations.RunPython(normalizar_tipo, revertir_tipo),
        migrations.AlterField(
            model_name='perfilpatrocinador',
            name='tipo',
            field=models.CharField(
                choices=[('veterinaria', 'Veterinaria'), ('refugio', 'Refugio Animal'), ('otro', 'Otro')],
                default='otro', max_length=50,
            ),
        ),
        migrations.AddField(
            model_name='perfilpatrocinador',
            name='ubicacion_geo',
            field=django.contrib.gis.db.models.PointField(blank=True, null=True, srid=4326),
        ),
        migrations.AddField(
            model_name='perfilpatrocinador',
            name='sitio_web',
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name='perfilpatrocinador',
            name='descripcion',
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name='perfilpatrocinador',
            name='formas_ayuda',
            field=models.JSONField(blank=True, default=list, help_text='Ej. ["dinero", "comida", "voluntariado"]'),
        ),
        migrations.AddField(
            model_name='perfilpatrocinador',
            name='redes_sociales',
            field=models.JSONField(blank=True, default=dict, help_text='Ej. {"facebook": "url", "whatsapp": "numero"}'),
        ),
        migrations.AddField(
            model_name='perfilpatrocinador',
            name='banner',
            field=models.ImageField(blank=True, null=True, upload_to='centros/banners/'),
        ),
        migrations.AddField(
            model_name='perfilpatrocinador',
            name='logo',
            field=models.ImageField(blank=True, null=True, upload_to='centros/logos/'),
        ),
        migrations.AddField(
            model_name='perfilpatrocinador',
            name='mision',
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name='perfilpatrocinador',
            name='vision',
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name='perfilpatrocinador',
            name='created_at',
            field=models.DateTimeField(auto_now_add=True, default=django.utils.timezone.now),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='perfilpatrocinador',
            name='updated_at',
            field=models.DateTimeField(auto_now=True, default=django.utils.timezone.now),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='perfilpatrocinador',
            name='estado',
            field=models.CharField(
                choices=[('PENDIENTE', 'Pendiente'), ('APROBADO', 'Aprobado'), ('RECHAZADO', 'Rechazado')],
                default='PENDIENTE', max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='perfilpatrocinador',
            name='motivo_rechazo',
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.RunPython(poblar_estado_desde_aprobado, revertir_estado_a_aprobado),
        migrations.RemoveField(
            model_name='perfilpatrocinador',
            name='aprobado',
        ),
        migrations.RemoveField(
            model_name='perfilpatrocinador',
            name='capacidad',
        ),
        migrations.RemoveField(
            model_name='perfilpatrocinador',
            name='redes',
        ),
        migrations.AddConstraint(
            model_name='perfilpatrocinador',
            constraint=models.CheckConstraint(check=models.Q(('nombre__isnull', False), models.Q(('nombre', ''), _negated=True)), name='datos_entidad_requeridos'),
        ),
    ]
