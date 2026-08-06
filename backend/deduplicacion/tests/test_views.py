from unittest import mock
from django.test import TestCase
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

def _fake_imagen(nombre):
    return SimpleUploadedFile(nombre, b"contenido-falso", content_type="image/jpeg")

class PrecargarImagenEndpointTests(TestCase):
    """Pruebas para el endpoint de pre-embedding dividido en 2 fases."""

    def setUp(self):
        self.client = APIClient()

    @mock.patch("django.core.cache.cache")                    
    @mock.patch("django.core.files.storage.default_storage")
    def test_modo_1_sube_imagen_y_regresa_id(self, mock_storage, mock_cache):
        # Simulamos el guardado en el disco local
        mock_storage.save.return_value = "borradores_temp/test.jpg"
        mock_storage.path.return_value = "/app/media/borradores_temp/test.jpg"

        # Petición solo con imagen (Usuario saliendo de la Fase 1 del Wizard)
        res = self.client.post("/api/incidencias/precargar-imagen/", {
            "imagen": _fake_imagen("foto.jpg")
        })
        
        self.assertEqual(res.status_code, 202)
        self.assertIn("imagen_borrador_id", res.json())
        
        # Verificamos que la ruta absoluta se guardó temporalmente en caché
        mock_cache.set.assert_called_once()
        args, kwargs = mock_cache.set.call_args
        self.assertTrue(args[0].startswith("imagen_borrador_path:"))
        self.assertEqual(args[1], "/app/media/borradores_temp/test.jpg")

    @mock.patch("deduplicacion.tasks.calcular_embedding_borrador.delay")
    @mock.patch("bd.views.os.path.exists")
    @mock.patch("django.core.cache.cache")
    def test_modo_2_activa_celery_al_recibir_especie(self, mock_cache, mock_exists, mock_task):
        # Simulamos que la imagen ya fue subida y existe en el sistema
        mock_cache.get.return_value = "/app/media/borradores_temp/test.jpg"
        mock_exists.return_value = True

        # Petición con ID y especie (Usuario seleccionando el animal en Fase 2)
        res = self.client.post("/api/incidencias/precargar-imagen/", {
            "imagen_borrador_id": "test-id-previo",
            "tipo_animal": "GATO"
        })

        self.assertEqual(res.status_code, 202)
        
        datos = res.json()
        self.assertIn("borrador_id", datos)
        
        # Verificamos que se disparó la tarea asíncrona hacia Celery
        mock_task.assert_called_once_with(
            datos["borrador_id"], 
            "/app/media/borradores_temp/test.jpg", 
            "GATO"
        )

    @mock.patch("django.core.cache.cache")
    def test_modo_2_falla_si_cache_expiro(self, mock_cache):
        # Simulamos que el TTL expiró o el ID es inválido
        mock_cache.get.return_value = None

        res = self.client.post("/api/incidencias/precargar-imagen/", {
            "imagen_borrador_id": "id-invalido",
            "tipo_animal": "PERRO"
        })

        self.assertEqual(res.status_code, 404)
        self.assertEqual(res.json()["error"], "Borrador de imagen no encontrado o expirado.")