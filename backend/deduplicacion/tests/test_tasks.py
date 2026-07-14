from unittest import mock

from django.contrib.gis.geos import Point
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase

from bd.models import Animal, Incidencia
from deduplicacion.tasks import aprender_incidencia


def _fake_imagen(nombre):
    return SimpleUploadedFile(nombre, b"contenido-falso", content_type="image/jpeg")


class AprenderIncidenciaTests(TestCase):
    """aprender_incidencia (Celery) — la mitad "aprendizaje" que queda del
    pipeline viejo. La detección de duplicados en sí se movió a
    bd.views.IncidenciaViewSet.verificar_duplicado (síncrono, antes de crear
    la Incidencia) — esta task solo mete el embedding al índice HNSW para que
    futuros chequeos puedan encontrar esta incidencia como candidato."""

    def setUp(self):
        self.animal = Animal.objects.create(nombre="A", tipo="PERRO", tamano="mediano")
        self.punto = Point(-98.2062, 19.0414, srid=4326)

    def test_sin_imagen_no_llama_a_vision_service(self):
        incidencia = Incidencia.objects.create(
            tipo_incidencia="EXTRAVIADO", estado="PENDIENTE", animal=self.animal, ubicacion=self.punto,
        )
        with mock.patch("deduplicacion.tasks.VisionService") as MockVision:
            aprender_incidencia(incidencia.id)
            MockVision.assert_not_called()

    def test_con_imagen_llama_aprender_con_la_especie_correcta(self):
        incidencia = Incidencia.objects.create(
            tipo_incidencia="EXTRAVIADO", estado="PENDIENTE", animal=self.animal, ubicacion=self.punto,
            imagen=_fake_imagen("foto.jpg"),
        )
        with mock.patch("deduplicacion.tasks.VisionService") as MockVision:
            instancia = MockVision.return_value
            aprender_incidencia(incidencia.id)

        instancia.aprender.assert_called_once_with(incidencia.imagen.path, "PERRO", incidencia.id)

    def test_incidencia_inexistente_no_truena(self):
        resultado = aprender_incidencia(999999)
        self.assertEqual(resultado, "Incidencia no encontrada")
