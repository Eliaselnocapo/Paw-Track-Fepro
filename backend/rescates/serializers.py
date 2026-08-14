from rest_framework import serializers

from bd.serializers import IncidenciaSerializer
from .models import Rescate


class RescateSerializer(serializers.ModelSerializer):
    rescate_id = serializers.IntegerField(source='id', read_only=True)
    incidencia = IncidenciaSerializer(read_only=True)

    # Evidencia de cierre. Van como SerializerMethodField porque:
    #  - closure_photo necesita URL absoluta (el front la usa tal cual en <img>)
    #  - closure_location es un PointField; sin esto saldría como WKT
    #    ("SRID=4326;POINT (-98.2 19.3)"), inservible para Leaflet.
    closure_photo = serializers.SerializerMethodField()
    closure_location = serializers.SerializerMethodField()

    class Meta:
        model = Rescate
        fields = (
            'rescate_id',
            'estado',
            'historial',
            'fecha_aceptacion',
            'fecha_cierre',
            'incidencia',
            'closure_photo',
            'closure_location',
        )

    def get_closure_photo(self, obj):
        if not obj.closure_photo:
            return None
        url = obj.closure_photo.url
        request = self.context.get('request')
        return request.build_absolute_uri(url) if request else url

    def get_closure_location(self, obj):
        if not obj.closure_location:
            return None
        # x = longitud, y = latitud. Formato que ya consume Leaflet en el front.
        return {'lat': obj.closure_location.y, 'lng': obj.closure_location.x}