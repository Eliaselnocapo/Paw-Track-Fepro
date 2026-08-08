from rest_framework import serializers

from .models import Recurso


class RecursoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Recurso
        fields = [
            'id',
            'incidencia',
            'patrocinador',
            'tipo',
            'descripcion',
            'estado',
            'released_at',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'patrocinador',
            'estado',
            'released_at',
            'created_at',
            'updated_at',
        ]
