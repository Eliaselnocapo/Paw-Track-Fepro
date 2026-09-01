from unittest import mock

from django.contrib.gis.geos import Point
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase

from deduplicacion.tasks import calcular_embedding_borrador

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

class CalcularEmbeddingBorradorTests(TestCase):
    """Pruebas para la tarea de Celery que precarga el embedding en Redis."""

    @mock.patch("deduplicacion.tasks.os.remove")
    @mock.patch("django.core.cache.cache")
    @mock.patch("deduplicacion.tasks.VisionService")
    def test_calcula_embedding_guarda_en_cache_y_borra_temporal(self, MockVision, mock_cache, mock_remove):
        # Configuramos el mock para simular la respuesta de la IA
        instancia = MockVision.return_value
        mock_emb = mock.MagicMock()
        mock_emb.astype.return_value.tobytes.return_value = b"fake_vector_bytes"
        instancia._get_embedding.return_value = mock_emb

        borrador_id = "test-uuid-123"
        ruta = "/app/media/borradores_temp/foto.jpg"
        
        # Ejecutamos la tarea
        calcular_embedding_borrador(borrador_id, ruta, "PERRO")

        # Verificamos que se llamó a la IA con los datos correctos
        instancia._get_embedding.assert_called_once_with(ruta, "PERRO")
        
        # Verificamos que se guardó en Redis con un TTL de 30 mins (1800s)
        # La key incluye la especie (en minúsculas) para no mezclar
        # embeddings de distintas especies bajo el mismo borrador_id.
        mock_cache.set.assert_called_once_with(
            f"embedding_borrador:{borrador_id}:perro",
            b"fake_vector_bytes", 
            timeout=1800
        )
        
        # Verificamos que se limpió el archivo del disco para no saturar el servidor
        mock_remove.assert_called_once_with(ruta)

    @mock.patch("deduplicacion.tasks.os.remove")
    @mock.patch("django.core.cache.cache")
    @mock.patch("deduplicacion.tasks.VisionService")
    def test_falla_vision_service_pero_siempre_borra_archivo(self, MockVision, mock_cache, mock_remove):
        # Simulamos que el modelo de IA arroja un error (ej. especie no soportada)
        instancia = MockVision.return_value
        instancia._get_embedding.side_effect = ValueError("Error de IA")

        ruta = "/app/media/borradores_temp/error.jpg"
        calcular_embedding_borrador("error-uuid", ruta, "DRAGON")

        # Redis no debe ser llamado porque no hay embedding
        mock_cache.set.assert_not_called()
        
        # El archivo temporal DEBE borrarse de todas formas
        mock_remove.assert_called_once_with(ruta)