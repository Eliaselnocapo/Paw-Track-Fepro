import os
import shutil
import glob
import json
import threading
import numpy as np
from django.test import TransactionTestCase  # Cambiado a TransactionTestCase para soportar multi-threading en BD
from django.conf import settings
from deduplicacion.services import VisionService

class VisionServiceTestCase(TransactionTestCase):
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

        # ---- AJUSTE MATEMÁTICO: GENERAR Y NORMALIZAR CON NORMA L2 ----
        raw_base = np.random.rand(dim_real).astype(np.float32)
        raw_distinto = np.random.rand(dim_real).astype(np.float32)

        self.emb_base = raw_base / np.linalg.norm(raw_base)
        self.emb_clon = self.emb_base.copy()
        self.emb_distinto = raw_distinto / np.linalg.norm(raw_distinto)

    def tearDown(self):
        VisionService._instance = None
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
        _, index, _, _, _ = self.vision_service._index_para('PERRO')
        conteo_inicial = index.get_current_count()

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
        """Regresión: buscar_similares() debe ignorar ids no numéricos del índice sin tronar con ValueError"""
        _, index, mapping, _, _ = self.vision_service._index_para('PERRO')

        id_valido = 999920
        self.vision_service.aprender_embedding(self.emb_base, 'PERRO', id_valido)

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

    def test_concurrencia_misma_especie_cache_lock_consistente(self):
        """
        [P0 - S6 Hardening Test]
        Simula dos hilos concurrentes tratando de escribir al mismo índice HNSW
        de perros al mismo milisegundo. Valida que `cache.lock` funcione, el índice
        sea consistente y contenga ambos elementos sin corromperse.
        """
        _, index, _, _, _ = self.vision_service._index_para('PERRO')
        conteo_inicial = index.get_current_count()

        id_hilo_1 = 999931
        id_hilo_2 = 999932

        emb_hilo_1 = np.random.rand(index.dim).astype(np.float32)
        emb_hilo_2 = np.random.rand(index.dim).astype(np.float32)

        def worker(emb, id_incidencia):
            # Llama al servicio real que implementa cache.lock internamente
            self.vision_service.aprender_embedding(emb, 'PERRO', id_incidencia)

        t1 = threading.Thread(target=worker, args=(emb_hilo_1, id_hilo_1))
        t2 = threading.Thread(target=worker, args=(emb_hilo_2, id_hilo_2))

        # Disparo simultáneo
        t1.start()
        t2.start()
        t1.join()
        t2.join()

        # Recargar el índice del estado persistido en el disco temporal de pruebas
        VisionService._instance = None
        nuevo_servicio = VisionService()
        _, index_validar, mapping_validar, _, _ = nuevo_servicio._index_para('PERRO')

        # Ambos elementos debieron ser secuenciados correctamente por el lock en lugar de pisarse
        self.assertEqual(index_validar.get_current_count(), conteo_inicial + 2)
        self.assertIn(str(id_hilo_1), mapping_validar.values())
        self.assertIn(str(id_hilo_2), mapping_validar.values())
