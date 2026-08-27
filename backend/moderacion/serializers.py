from rest_framework import serializers

from bd.models import PerfilPatrocinador, Incidencia
from .models import ReporteFraude


class ReporteFraudeSerializer(serializers.ModelSerializer):
    usuario_reporta_email = serializers.CharField(source='usuario_reporta.email', read_only=True)

    class Meta:
        model = ReporteFraude
        fields = ('id', 'usuario_reporta', 'usuario_reporta_email', 'motivo', 'created_at')


class IncidenciaDenunciaSerializer(serializers.ModelSerializer):
    """Fila de la cola de denuncias del admin — no se expone públicamente,
    a diferencia de IncidenciaSerializer, que a propósito no incluye estos
    campos (evita que un usuario cualquiera vea cuántas denuncias tiene un
    caso ajeno)."""
    tipo_animal = serializers.CharField(source='animal.tipo', read_only=True, default=None)
    usuario_reporta_email = serializers.CharField(source='usuario_reporta.email', read_only=True, default=None)
    reportes = ReporteFraudeSerializer(source='reportes_fraude', many=True, read_only=True)

    class Meta:
        model = Incidencia
        fields = (
            'id', 'folio', 'estado', 'tipo_animal', 'usuario_reporta_email',
            'reportes_fraude_count', 'oculto_por_fraude', 'created_at', 'reportes',
        )


class CentroPendienteSerializer(serializers.ModelSerializer):
    usuario_email = serializers.CharField(source='usuario.email', read_only=True)

    class Meta:
        model = PerfilPatrocinador
        fields = (
            'id', 'nombre', 'tipo', 'correo', 'telefono', 'direccion',
            'usuario_email', 'estado', 'created_at',
        )
