from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('bd', '0019_perfilpatrocinador_centro_apoyo'),
        ('recursos', '0001_initial'),
    ]

    operations = [
        migrations.AddConstraint(
            model_name='recurso',
            constraint=models.CheckConstraint(
                check=(
                    models.Q(('estado', 'LIBERADO'), ('released_at__isnull', False))
                    | models.Q(('estado', 'BLOQUEADO'), ('released_at__isnull', True))
                ),
                name='recurso_estado_released_at_coherente',
            ),
        ),
        migrations.CreateModel(
            name='HistorialRecurso',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('tipo_evento', models.CharField(choices=[('ASIGNADO', 'Asignado'), ('LIBERADO', 'Liberado')], max_length=15)),
                ('timestamp', models.DateTimeField(auto_now_add=True)),
                ('actor', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='+', to=settings.AUTH_USER_MODEL)),
                ('recurso', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='historial', to='recursos.recurso')),
            ],
            options={
                'ordering': ['timestamp'],
            },
        ),
        migrations.AddIndex(
            model_name='historialrecurso',
            index=models.Index(fields=['recurso', 'timestamp'], name='recursos_hi_recurso_faa0f8_idx'),
        ),
    ]