from unittest import mock

from django.contrib.gis.geos import Point
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase

from bd.models import Animal, Incidencia
from deduplicacion.tasks import aprender_incidencia


def _fake_imagen(nombre):
    return SimpleUploadedFile(nombre, b"contenido-falso", content_type="image/jpeg")


class AprenderIncidenciaTests(TestCase):
    """aprender_incidencia (Celery) — la mitad "aprendizaje + índice de
    similares" que queda del pipeline viejo (check_duplicados, eliminado).
    La detección/confirmación de duplicados en sí se movió a
    bd.views.IncidenciaViewSet.verificar_duplicado (síncrono, antes de crear
    la Incidencia) — esta task solo mete el embedding al índice HNSW
    (aprender_embedding, API de Manuel post-P0s) para que futuros chequeos
    puedan encontrar esta incidencia como candidato, y guarda
    coincidencias_visuales_ids para el serializer (Fix P0-5)."""

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

    def test_con_imagen_aprende_el_embedding_con_la_especie_correcta(self):
        incidencia = Incidencia.objects.create(
            tipo_incidencia="EXTRAVIADO", estado="PENDIENTE", animal=self.animal, ubicacion=self.punto,
            imagen=_fake_imagen("foto.jpg"),
        )
        with mock.patch("deduplicacion.tasks.VisionService") as MockVision:
            instancia = MockVision.return_value
            instancia._get_embedding.return_value = "fake_embedding_vector"
            aprender_incidencia(incidencia.id)

        instancia.aprender_embedding.assert_called_once_with(
            "fake_embedding_vector", "PERRO", incidencia.id
        )

    def test_con_candidatos_cercanos_guarda_coincidencias_visuales_ids(self):
        original = Incidencia.objects.create(
            tipo_incidencia="EXTRAVIADO", estado="PENDIENTE", animal=self.animal,
            ubicacion=self.punto, imagen=_fake_imagen("original.jpg"),
        )
        nueva = Incidencia.objects.create(
            tipo_incidencia="EXTRAVIADO", estado="PENDIENTE", animal=self.animal,
            ubicacion=self.punto, imagen=_fake_imagen("nueva.jpg"),
        )

        with mock.patch("deduplicacion.tasks.VisionService") as MockVision:
            instancia = MockVision.return_value
            instancia._get_embedding.return_value = "fake_embedding_vector"
            instancia.buscar_similares.return_value = {str(original.id): 1.0}
            aprender_incidencia(nueva.id)

        nueva.refresh_from_db()
        self.assertEqual(nueva.coincidencias_visuales_ids, [original.id])
        instancia.aprender_embedding.assert_called_once_with(
            "fake_embedding_vector", "PERRO", nueva.id
        )

    def test_sin_candidatos_cercanos_no_toca_coincidencias_visuales_ids(self):
        incidencia = Incidencia.objects.create(
            tipo_incidencia="EXTRAVIADO", estado="PENDIENTE", animal=self.animal,
            ubicacion=self.punto, imagen=_fake_imagen("sola.jpg"),
        )
        with mock.patch("deduplicacion.tasks.VisionService") as MockVision:
            instancia = MockVision.return_value
            instancia._get_embedding.return_value = "fake_embedding_vector"
            aprender_incidencia(incidencia.id)
            instancia.buscar_similares.assert_not_called()

        incidencia.refresh_from_db()
        self.assertEqual(incidencia.coincidencias_visuales_ids, [])

    def test_incidencia_inexistente_no_truena(self):
        resultado = aprender_incidencia(999999)
        self.assertEqual(resultado, "Incidencia no encontrada")
