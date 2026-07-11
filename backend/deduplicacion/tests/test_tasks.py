from unittest import mock

from django.contrib.gis.geos import Point
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase

from bd.models import Animal, Incidencia
from deduplicacion.tasks import check_duplicados


def _fake_imagen(nombre):
    return SimpleUploadedFile(nombre, b"contenido-falso", content_type="image/jpeg")


class CheckDuplicadosPipelineTests(TestCase):
    def setUp(self):
        self.animal = Animal.objects.create(nombre="A", tipo="PERRO", tamano="mediano", color="cafe")
        self.punto = Point(-98.2062, 19.0414, srid=4326)

    def _incidencia(self, imagen=None, urgency_score=0, animal=None, ubicacion=None):
        return Incidencia.objects.create(
            tipo_incidencia="EXTRAVIADO", estado="PENDIENTE",
            animal=animal or self.animal, ubicacion=ubicacion or self.punto,
            imagen=imagen, urgency_score=urgency_score,
        )

    def test_sin_imagen_no_invoca_vision_service_y_queda_pendiente(self):
        incidencia = self._incidencia(imagen=None)

        with mock.patch("deduplicacion.tasks.VisionService") as MockVision:
            check_duplicados(incidencia.id)

        MockVision.assert_not_called()
        incidencia.refresh_from_db()
        self.assertEqual(incidencia.estado, "PENDIENTE")

    def test_score_final_alto_fusiona_y_cierra_el_duplicado(self):
        original = self._incidencia(imagen=_fake_imagen("original.jpg"), urgency_score=20)
        nueva = self._incidencia(imagen=_fake_imagen("nueva.jpg"))

        with mock.patch("deduplicacion.tasks.VisionService") as MockVision:
            instancia = MockVision.return_value
            instancia.get_similarity_scores.return_value = {str(original.id): 1.0}
            check_duplicados(nueva.id)
            instancia.aprender.assert_called_once()

        nueva.refresh_from_db()
        original.refresh_from_db()
        self.assertEqual(nueva.estado, "CERRADO")
        self.assertEqual(original.urgency_score, 30)  # +10 por confirmación

    def test_score_final_medio_manda_a_revision(self):
        original = self._incidencia(imagen=_fake_imagen("original.jpg"))
        nueva = self._incidencia(imagen=_fake_imagen("nueva.jpg"))

        with mock.patch("deduplicacion.tasks.VisionService") as MockVision:
            instancia = MockVision.return_value
            # geo + estructura ya matchean 100% (mismo punto, mismo animal);
            # con score_foto=0 el score_final queda en la banda de revisión.
            instancia.get_similarity_scores.return_value = {str(original.id): 0.0}
            check_duplicados(nueva.id)

        nueva.refresh_from_db()
        self.assertEqual(nueva.estado, "EN_REVISION")

    def test_score_final_bajo_deja_caso_nuevo_independiente(self):
        animal_lejano = Animal.objects.create(nombre="B", tipo="PERRO", tamano="", color="")
        punto_lejano = Point(-98.2062, 19.1134, srid=4326)  # ~8 km, dentro del radio pero lejos
        original = self._incidencia(
            imagen=_fake_imagen("original.jpg"), animal=animal_lejano, ubicacion=punto_lejano,
        )
        nueva = self._incidencia(imagen=_fake_imagen("nueva.jpg"))

        with mock.patch("deduplicacion.tasks.VisionService") as MockVision:
            instancia = MockVision.return_value
            instancia.get_similarity_scores.return_value = {str(original.id): 0.0}
            check_duplicados(nueva.id)

        nueva.refresh_from_db()
        self.assertEqual(nueva.estado, "PENDIENTE")
