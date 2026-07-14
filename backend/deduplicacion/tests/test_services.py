import io

from django.test import TestCase
from PIL import Image

from deduplicacion.services import VisionService


def _fake_imagen_bytes():
    buffer = io.BytesIO()
    Image.new("RGB", (32, 32), color=(120, 80, 40)).save(buffer, format="JPEG")
    buffer.seek(0)
    return buffer


class GetSimilarityScoresIndiceCorruptoTests(TestCase):
    """Regresión: el índice HNSW de perros trae entradas de entrenamiento/seed
    con ids no numéricos (ej. slugs de dataset como
    "69709-robby-kleiner-schwarzer-diaman"), y get_similarity_scores tronaba
    con ValueError al intentar int(db_id) sobre esas entradas — bloqueaba
    CUALQUIER creación/listado de incidencias de perro con imagen, no solo
    el chequeo de duplicados. No es parte del trabajo de deduplicación de
    esta sesión, pero se encontró y arregló al probar el flujo end-to-end."""

    def test_ignora_labels_no_numericos_sin_tronar(self):
        vision = VisionService()
        if vision.dog_index.get_current_count() == 0:
            self.skipTest("Índice de perros vacío en este ambiente — nada que forzar.")

        # Forzamos una entrada no numérica en el mapping (singleton
        # compartido: se restaura al terminar para no afectar otros tests),
        # igual que la que ya trae el índice real de perros en este
        # ambiente de desarrollo.
        valor_original = vision.dog_map.get(0)
        vision.dog_map[0] = "69709-robby-kleiner-schwarzer-diaman"
        try:
            scores = vision.get_similarity_scores(_fake_imagen_bytes(), "perro", [1, 2, 3])
        except ValueError:
            self.fail("get_similarity_scores no debe tronar con ids no numéricos en el índice")
        finally:
            vision.dog_map[0] = valor_original

        self.assertIsInstance(scores, dict)
