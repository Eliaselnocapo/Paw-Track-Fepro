from rest_framework import serializers

from .models import HistorialRecurso, Recurso


class HistorialRecursoSerializer(serializers.ModelSerializer):
    actor_nombre = serializers.SerializerMethodField()

    class Meta:
        model = HistorialRecurso
        fields = ['id', 'tipo_evento', 'actor', 'actor_nombre', 'timestamp']

    def get_actor_nombre(self, obj):
        if obj.actor is None:
            return None
        return f'{obj.actor.first_name} {obj.actor.last_name}'.strip() or obj.actor.email


class RecursoSerializer(serializers.ModelSerializer):
    historial = HistorialRecursoSerializer(many=True, read_only=True)

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
            'historial',
        ]
        read_only_fields = [
            'id',
            'patrocinador',
            'estado',
            'released_at',
            'created_at',
            'updated_at',
            'historial',
        ]


class RecursoDeIncidenciaSerializer(serializers.ModelSerializer):
    """Version solo-lectura para el rescatista asignado — mismo shape,
    sin exponer el `id` interno del patrocinador (no necesita saber quien
    es el donante especifico, solo que hay recursos disponibles/liberados
    para su caso)."""
    historial = HistorialRecursoSerializer(many=True, read_only=True)

    class Meta:
        model = Recurso
        fields = ['id', 'tipo', 'descripcion', 'estado', 'released_at', 'created_at', 'historial']