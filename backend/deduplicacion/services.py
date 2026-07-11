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

    def aprender_embedding(self, emb, especie, db_id):
        """
        Inserta el embedding (ya calculado) de un reporte nuevo en el índice HNSW y persiste
        el índice a disco.
        """
        recursos = self._index_para(especie)
        if recursos is None:
            raise ValueError(f"Especie no soportada para deduplicación visual: {especie}")
            
        session, index, mapping, bin_name, map_name = recursos
        base_dir = os.path.join(settings.BASE_DIR, 'deduplicacion', 'ml_models')

        new_label = index.get_current_count()
        if new_label >= index.get_max_elements():
            index.resize_index(index.get_max_elements() + 1000)

        index.add_items([emb], [new_label])
        mapping[new_label] = str(db_id) 

        index.save_index(os.path.join(base_dir, bin_name))

        final_data = {"animal_ids": list(mapping.values())}
        with open(os.path.join(base_dir, map_name), 'w') as f:
            json.dump(final_data, f)

        logger.info("VisionService: reporte %s aprendido y guardado en disco (%s).", db_id, bin_name)

    def _get_embedding(self, image_file, especie):
        recursos = self._index_para(especie)
        if recursos is None:
            raise ValueError(f"Especie no soportada para deduplicación visual: {especie}")
        
        session, *_ = recursos
        img = Image.open(image_file).convert("RGB")
        tensor = self.transform(img).unsqueeze(0).numpy()
        return session.run(None, {self.input_name: tensor})[0][0]

    def buscar_similares(self, emb, especie, candidatos_ids):
        recursos = self._index_para(especie)
        if recursos is None:
            return {}
        
        _, index, mapping, *_ = recursos

        db_id_a_label = {}
        for k, v in mapping.items():
            try:
                clean_v = str(v).split('&')[0]
                db_id = int(clean_v)
                
                if db_id in candidatos_ids:
                    db_id_a_label[db_id] = k
            except (ValueError, TypeError):
                continue

        if not db_id_a_label:
            return {}

        labels = list(db_id_a_label.values())
        vectores = index.get_items(labels) 

        scores = {}
        for db_id, label, vector in zip(db_id_a_label.keys(), labels, vectores):
            distancia = np.linalg.norm(np.array(vector) - emb)
            scores[str(db_id)] = 1 / (1 + distancia)
            
        return scores

def fusionar(original, duplicado):
    """
    Marca `duplicado` como CERRADO (es el reporte nuevo que resultó ser el
    mismo caso) y confirma `original` con un boost de urgencia. Ver
    SYSTEM_CONTRACT.md > Algoritmo: Deduplicación.
    """
    duplicado.estado = 'CERRADO'
    duplicado.save(update_fields=['estado'])

    original.urgency_score = (original.urgency_score or 0) + 10
    original.save(update_fields=['urgency_score'])

    logger.info("Deduplicación: incidencia %s fusionada como duplicado de %s.", duplicado.id, original.id)