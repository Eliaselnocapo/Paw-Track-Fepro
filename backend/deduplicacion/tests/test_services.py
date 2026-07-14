import os
import shutil
import glob
import json
import numpy as np
from django.test import TestCase
from django.conf import settings
from deduplicacion.services import VisionService
from unittest.mock import patch

class VisionServiceTestCase(TestCase):
    def setUp(self):
        VisionService._instance = None

        real_models_dir = os.path.join(settings.BASE_DIR, 'deduplicacion', 'ml_models')
        self.test_models_dir = os.path.join(settings.BASE_DIR, 'deduplicacion', 'ml_models_test')

        if os.path.exists(self.test_models_dir):
            shutil.rmtree(self.test_models_dir)

        shutil.copytree(real_models_dir, self.test_models_dir)

        settings.DEDUP_MODELS_DIR = self.test_models_dir

        self.vision_service = VisionService()

        _, index, _, _, _ = self.vision_service._index_para('PERRO')
        dim_real = index.dim

        self.emb_base = np.random.rand(dim_real).astype(np.float32)
        self.emb_clon = self.emb_base.copy()
        self.emb_distinto = np.random.rand(dim_real).astype(np.float32)

    def tearDown(self):

        VisionService._instance = None

        # Limpiar la basura
        if os.path.exists(self.test_models_dir):
            shutil.rmtree(self.test_models_dir)

    def test_especie_no_soportada(self):
        """Valida la regresión #4: Especie no soportada lanza error"""
        with self.assertRaises(ValueError):
            self.vision_service.aprender_embedding(self.emb_base, 'DRAGON', 99)

        with self.assertRaises(ValueError):
            self.vision_service.buscar_similares(self.emb_base, 'DRAGON', [99])

    def test_aprender_y_buscar_similares(self):
        """Valida que aprender() guarde y buscar_similares() encuentre (regresión #3)"""
        from django.core.cache import cache
        from unittest.mock import MagicMock

        cache.lock = MagicMock()


        _, index, _, _, _ = self.vision_service._index_para('PERRO')
        conteo_inicial = index.get_current_count()

        # Usamos IDs altísimos para no sobreescribir los datos reales copiados
        id_base = 999910
        id_distinto = 999911

        self.vision_service.aprender_embedding(self.emb_base, 'PERRO', id_base)
        self.vision_service.aprender_embedding(self.emb_distinto, 'PERRO', id_distinto)

        self.assertEqual(index.get_current_count(), conteo_inicial + 2)

        scores = self.vision_service.buscar_similares(self.emb_clon, 'PERRO', candidatos_ids=[id_base, id_distinto])

        str_base = str(id_base)
        str_distinto = str(id_distinto)

        self.assertIn(str_base, scores)
        self.assertIn(str_distinto, scores)
        self.assertTrue(scores[str_base] > scores[str_distinto], "El clon debe tener mayor score con su base")
        self.assertAlmostEqual(scores[str_base], 1.0, places=4)

    def test_buscar_similares_ignora_ids_no_numericos_sin_tronar(self):
        """Regresión: el índice HNSW de perros puede traer entradas de
        entrenamiento/seed con ids no numéricos (ej. slugs de dataset como
        "69709-robby-kleiner-schwarzer-diaman") mezcladas con incidencias
        reales. Esto ya rompía GET /api/incidencias/ (listado) y cualquier
        serialización con coincidencias_visuales antes de que buscar_similares
        reemplazara a get_similarity_scores — no es exclusivo del chequeo de
        duplicados. buscar_similares() debe ignorar esas entradas (try/except
        al parsear cada id de mapping), nunca tronar con ValueError."""
        _, index, mapping, _, _ = self.vision_service._index_para('PERRO')

        id_valido = 999920
        self.vision_service.aprender_embedding(self.emb_base, 'PERRO', id_valido)

        # Forzamos una entrada no numérica junto a la válida, igual que las
        # que ya trae el índice real de perros en este ambiente de desarrollo.
        label_extra = index.get_current_count()
        index.add_items([self.emb_distinto], [label_extra])
        mapping[label_extra] = "69709-robby-kleiner-schwarzer-diaman"

        try:
            scores = self.vision_service.buscar_similares(
                self.emb_clon, 'PERRO', candidatos_ids=[id_valido]
            )
        except ValueError:
            self.fail("buscar_similares no debe tronar con ids no numéricos en el índice")

        self.assertIn(str(id_valido), scores)
