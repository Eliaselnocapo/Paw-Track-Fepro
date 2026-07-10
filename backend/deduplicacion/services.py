import os
import json
import numpy as np
from PIL import Image
import onnxruntime as ort
from torchvision import transforms
import hnswlib
from django.conf import settings

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
        print("[VisionService] Cargando modelos ONNX y HNSW a la memoria...")
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
        
        print("[VisionService] Modelos listos para producción.")

    def process_new_report(self, image_file, especie, db_id, candidatos_ids=None, top_k=5):
        """
        Calcula el vector de la imagen, busca duplicados, inyecta el nuevo reporte 
        al índice HNSW y guarda el aprendizaje en el disco duro.
        """
        # 1. Preprocesar y sacar el vector (embedding)
        img = Image.open(image_file).convert("RGB")
        tensor = self.transform(img).unsqueeze(0).numpy()
        
        base_dir = os.path.join(settings.BASE_DIR, 'deduplicacion', 'ml_models')

        # 2. Enrutamiento según especie
        if especie.lower() == 'perro':
            session, index, mapping = self.dog_session, self.dog_index, self.dog_map
            bin_name, map_name = 'embedding_index_v4.bin', 'embedding_index_v4_map.json'
        elif especie.lower() == 'gato':
            session, index, mapping = self.cat_session, self.cat_index, self.cat_map
            bin_name, map_name = 'cat_embedding_index_v1.bin', 'cat_embedding_index_v1_map.json'
        else:
            return [] # Si es otra especie, ignoramos

        # Extraer matemáticas
        emb = session.run(None, {self.input_name: tensor})[0][0]

        # 3. BUSCAR DUPLICADOS (Antes de agregar el nuevo)
        duplicates = []
        # Obtenemos el total de elementos actuales en el índice
        current_count = index.get_current_count()
        
        if current_count > 0:
            if candidatos_ids:
                # Filtrado inteligente: 
                # Convertimos IDs de base de datos a índices del índice HNSW (labels)
                reverse_map = {v: k for k, v in mapping.items()}
                valid_labels = [reverse_map[c_id] for c_id in candidatos_ids if c_id in reverse_map]
                
                if valid_labels:
                    # Buscamos candidatos. Nota: Si la lista de candidatos es pequeña, 
                    # k debe ser menor o igual a la cantidad de elementos disponibles.
                    k_search = min(top_k * 3, current_count)
                    labels, _ = index.knn_query(emb, k=k_search)
                    
                    # Filtramos los resultados para quedarnos SOLO con los que están en la lista de candidatos
                    valid_labels_set = set(valid_labels)
                    duplicates = [
                        mapping[l] for l in labels[0] 
                        if l in valid_labels_set
                    ]
            else:
                # Búsqueda global (cuando no hay filtro geográfico)
                labels, _ = index.knn_query(emb, k=top_k)
                duplicates = [mapping[l] for l in labels[0]]

        # 4. APRENDER: Agregar el nuevo reporte a la memoria RAM
        new_label = index.get_current_count()
        
        # HNSW necesita saber si nos pasamos del límite para expandir la RAM
        if new_label >= index.get_max_elements():
            index.resize_index(index.get_max_elements() + 1000)
            
        index.add_items([emb], [new_label])
        mapping[new_label] = str(db_id) # Enlazamos el número entero con tu ID real de PostgreSQL

        # 5. GUARDAR EN DISCO: Hacer el conocimiento permanente
        index.save_index(os.path.join(base_dir, bin_name))

# Guardamos manteniendo la estructura esperada por _parse_json_map
        final_data = {"animal_ids": list(mapping.values())} 
        with open(os.path.join(base_dir, map_name), 'w') as f:
            json.dump(final_data, f)

        print(f"[VisionService] Reporte {db_id} aprendido y guardado en disco.")
        
        return duplicates
    
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
            if int(db_id) in candidatos_ids:
                distancia = distances[0][i]
                scores[str(db_id)] = 1 / (1 + distancia)
        
        return scores