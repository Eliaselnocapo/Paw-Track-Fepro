import os
import json
import logging
import numpy as np
from PIL import Image
import onnxruntime as ort
from torchvision import transforms
import hnswlib
from django.conf import settings

logger = logging.getLogger(__name__)


class VisionService:
    _instance = None

    def __new__(cls):
        # Patrón Singleton: Garantiza que los modelos se carguen a la RAM una sola vez
        if cls._instance is None:
            cls._instance = super(VisionService, cls).__new__(cls)
            cls._instance._initialize_models()
        return cls._instance
    
    def _parse_json_map(self, file_path):
        """Lee el JSON y extrae la lista de animal_ids para mapearla a índices enteros."""
        with open(file_path, 'r') as f:
            data = json.load(f)
            
        # Si el JSON tiene la estructura {"animal_ids": [...], "img_paths": [...]}
        if isinstance(data, dict) and "animal_ids" in data:
            animal_ids_list = data["animal_ids"]
            
            # Convertimos la lista plana ["0005", "0005"] a un diccionario {0: "0005", 1: "0005"}
            # HNSW necesita llaves enteras (0, 1, 2...)
            return {i: str(v) for i, v in enumerate(animal_ids_list)}
            
        # Si por alguna razón el archivo no tiene "animal_ids", devolvemos un diccionario vacío para no crashear
        print(f"[VisionService] Advertencia: Formato no reconocido en {file_path}")
        return {}

    def _initialize_models(self):
        logger.info("VisionService: cargando modelos ONNX y HNSW a la memoria...")
        base_dir = os.path.join(settings.BASE_DIR, 'deduplicacion', 'ml_models')

        # 1. Cargar el motor ONNX (Perros y Gatos)
        self.dog_session = ort.InferenceSession(
            os.path.join(base_dir, 'embedding_model_pruned_v4.onnx'), 
            providers=['CPUExecutionProvider']
        )
        self.cat_session = ort.InferenceSession(
            os.path.join(base_dir, 'cat_embedding_model_pruned_v1.onnx'), 
            providers=['CPUExecutionProvider']
        )
        
        self.input_name = self.dog_session.get_inputs()[0].name

        # 2. Configurar el preprocesamiento visual
        self.transform = transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
        ])

        # 3. Cargar Índices HNSW (Perros)
        self.dog_map = self._parse_json_map(os.path.join(base_dir, 'embedding_index_v4_map.json'))
        self.dog_index = hnswlib.Index(space='l2', dim=128)
        # Usamos max(..., 1) por si el mapa viene vacío, HNSW no truene al recibir un 0
        self.dog_index.load_index(os.path.join(base_dir, 'embedding_index_v4.bin'), max_elements=100000)

        # 4. Cargar Índices HNSW (Gatos)
        self.cat_map = self._parse_json_map(os.path.join(base_dir, 'cat_embedding_index_v1_map.json'))
        self.cat_index = hnswlib.Index(space='l2', dim=128)
        self.cat_index.load_index(os.path.join(base_dir, 'cat_embedding_index_v1.bin'), max_elements=100000)

        logger.info("VisionService: modelos listos para producción.")

    def _index_para(self, especie):
        """Resuelve session/index/mapping/nombres de archivo según especie. None si no es perro/gato."""
        if especie.lower() == 'perro':
            return self.dog_session, self.dog_index, self.dog_map, 'embedding_index_v4.bin', 'embedding_index_v4_map.json'
        if especie.lower() == 'gato':
            return self.cat_session, self.cat_index, self.cat_map, 'cat_embedding_index_v1.bin', 'cat_embedding_index_v1_map.json'
        return None

    def aprender(self, image_file, especie, db_id):
        """
        Inserta el embedding de un reporte nuevo en el índice HNSW y persiste
        el índice a disco. Es la única función que MUTA el índice — no debe
        llamarse desde rutas de lectura (serializers, vistas), solo desde el
        task de Celery, una vez por reporte.
        """
        recursos = self._index_para(especie)
        if recursos is None:
            return  # especie no soportada, se ignora

        _, index, mapping, bin_name, map_name = recursos
        emb = self._get_embedding(image_file, especie)
        base_dir = os.path.join(settings.BASE_DIR, 'deduplicacion', 'ml_models')

        new_label = index.get_current_count()
        # HNSW necesita saber si nos pasamos del límite para expandir la RAM
        if new_label >= index.get_max_elements():
            index.resize_index(index.get_max_elements() + 1000)

        index.add_items([emb], [new_label])
        mapping[new_label] = str(db_id)  # Enlazamos el número entero con el ID real de PostgreSQL

        index.save_index(os.path.join(base_dir, bin_name))

        # Guardamos manteniendo la estructura esperada por _parse_json_map
        final_data = {"animal_ids": list(mapping.values())}
        with open(os.path.join(base_dir, map_name), 'w') as f:
            json.dump(final_data, f)

        logger.info("VisionService: reporte %s aprendido y guardado en disco (%s).", db_id, bin_name)

    def _get_embedding(self, image_file, especie):
        """Método auxiliar interno para evitar repetir código."""
        img = Image.open(image_file).convert("RGB")
        tensor = self.transform(img).unsqueeze(0).numpy()
        
        session = self.dog_session if especie.lower() == 'perro' else self.cat_session
        return session.run(None, {self.input_name: tensor})[0][0]

    def get_similarity_scores(self, image_file, especie, candidatos_ids):
        """
        Retorna un diccionario {db_id: score_normalizado} de los candidatos.
        """
        emb = self._get_embedding(image_file, especie)
        session, index, mapping = (self.dog_session, self.dog_index, self.dog_map) \
                                  if especie.lower() == 'perro' else \
                                  (self.cat_session, self.cat_index, self.cat_map)

        # Hacemos la consulta vectorial
        k_search = min(len(candidatos_ids), index.get_current_count())
        if k_search == 0: return {}

        labels, distances = index.knn_query(emb, k=k_search)
        
        # Convertimos las distancias (L2) a un score normalizado de 0 a 1
        # L2 es distancia euclidiana, a menor distancia, mayor similitud.
        # Una fórmula simple de normalización: 1 / (1 + distancia)
        scores = {}
        for i, label in enumerate(labels[0]):
            db_id = mapping[label]
            # El índice puede traer entradas de entrenamiento/seed que no
            # corresponden a ninguna Incidencia real (ids no numéricos, ej.
            # slugs de dataset) — nunca van a matchear candidatos_ids, así
            # que se ignoran en vez de tronar con ValueError.
            if not str(db_id).isdigit():
                continue
            if int(db_id) in candidatos_ids:
                distancia = distances[0][i]
                scores[str(db_id)] = 1 / (1 + distancia)

        return scores


def fusionar(original, duplicado):
    """
    Marca `duplicado` como CERRADO (es el reporte nuevo que resultó ser el
    mismo caso), confirma `original` con un boost de urgencia, y enriquece
    los datos de `original.animal` con lo que haya capturado `duplicado` y
    el original no tenga (más gente reportando el mismo animal suele traer
    mejores datos con el tiempo, no solo confirmación). Ver
    SYSTEM_CONTRACT.md > Algoritmo: Deduplicación.
    """
    duplicado.estado = 'CERRADO'
    duplicado.save(update_fields=['estado'])

    original.urgency_score = (original.urgency_score or 0) + 10
    original.save(update_fields=['urgency_score'])

    _enriquecer_animal(original.animal, duplicado.animal)

    logger.info("Deduplicación: incidencia %s fusionada como duplicado de %s.", duplicado.id, original.id)


def _enriquecer_animal(animal_original, animal_duplicado):
    """Copia a `animal_original` los campos que tiene vacíos y que
    `animal_duplicado` sí trae. Nunca sobreescribe un dato que el original
    ya tenía — un reporte nuevo puede estar equivocado, así que solo llena
    huecos, no reemplaza confirmaciones previas."""
    if animal_original is None or animal_duplicado is None:
        return

    campos = ['color', 'tamano', 'raza', 'agresividad', 'salud', 'otros', 'edad_estimada', 'peso_estimado']
    actualizados = []
    for campo in campos:
        valor_original = (getattr(animal_original, campo, '') or '').strip()
        valor_nuevo = (getattr(animal_duplicado, campo, '') or '').strip()
        if not valor_original and valor_nuevo:
            setattr(animal_original, campo, valor_nuevo)
            actualizados.append(campo)

    if actualizados:
        animal_original.save(update_fields=actualizados)
        logger.info("Deduplicación: animal %s enriquecido con campos %s desde incidencia duplicada.",
                    animal_original.id, actualizados)