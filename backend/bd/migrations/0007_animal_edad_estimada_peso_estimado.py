from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('bd', '0006_email_unique'),
    ]

    operations = [
        migrations.AddField(
            model_name='animal',
            name='edad_estimada',
            field=models.CharField(blank=True, default='', max_length=50),
        ),
        migrations.AddField(
            model_name='animal',
            name='peso_estimado',
            field=models.CharField(blank=True, default='', max_length=50),
        ),
    ]
