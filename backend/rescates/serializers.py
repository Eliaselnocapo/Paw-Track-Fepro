from rest_framework import serializers

from bd.serializers import IncidenciaSerializer
from .models import Rescate


class RescateSerializer(serializers.ModelSerializer):
    rescate_id = serializers.IntegerField(source='id', read_only=True)
    incidencia = IncidenciaSerializer(read_only=True)

    class Meta:
        model = Rescate
        fields = (
            'rescate_id',
            'estado',
            'historial',
            'fecha_aceptacion',
            'fecha_cierre',
            'incidencia',
        )
