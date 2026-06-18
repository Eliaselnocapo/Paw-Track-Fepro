import django.utils.timezone
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('bd', '0003_alter_incidencia_usuario_reporta'),
    ]

    operations = [
        # --- Usuario: reemplazar rol_principal por roles JSONField ---
        migrations.RemoveField(
            model_name='usuario',
            name='rol_principal',
        ),
        migrations.AddField(
            model_name='usuario',
            name='roles',
            field=models.JSONField(
                default=list,
                help_text='Lista de roles: REPORTERO, RESCATISTA, PATROCINADOR',
            ),
        ),

        # --- Incidencia: campos calculados nuevos ---
        migrations.AddField(
            model_name='incidencia',
            name='urgency_score',
            field=models.FloatField(default=0),
        ),
        migrations.AddField(
            model_name='incidencia',
            name='trust_score',
            field=models.FloatField(default=50),
        ),
        migrations.AddField(
            model_name='incidencia',
            name='created_at',
            field=models.DateTimeField(auto_now_add=True, default=django.utils.timezone.now),
            preserve_default=False,
        ),

        # --- Incidencia: defaults que faltaban en campos existentes ---
        migrations.AlterField(
            model_name='incidencia',
            name='caracteristicas',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.AlterField(
            model_name='incidencia',
            name='estado',
            field=models.CharField(default='PENDIENTE', max_length=50),
        ),
        migrations.AlterField(
            model_name='incidencia',
            name='tipo_incidencia',
            field=models.CharField(default='EMERGENCIA', max_length=50),
        ),
    ]
