import os
import json
import logging
import numpy as np
from PIL import Image
import onnxruntime as ort
from torchvision import transforms
import hnswlib
from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger(__name__)

"""
Nota de Arquitectura (S5): 
Actualmente, los embeddings de incidencias cerradas o resueltas permanecen en el índice físico 
HNSW (.bin). Esto no afecta la precisión de la búsqueda ya que `filtros.py` excluye estos IDs 
antes de que lleguen a `buscar_similares()`. La purga periódica del índice queda como deuda 
técnica de muy baja prioridad, a evaluarse únicamente si el tamaño de ml_models/ compromete 
el almacenamiento del servidor.
"""

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
        base_dir = settings.DEDUP_MODELS_DIR

        
        self.dog_session = ort.InferenceSession(
            os.path.join(base_dir, 'dog_model_clean_150.onnx'), 
            providers=['CPUExecutionProvider']
        )
        self.cat_session = ort.InferenceSession(
            os.path.join(base_dir, 'cat_model_osnet_v5.onnx'), 
            providers=['CPUExecutionProvider']
        )
        self.input_name = self.dog_session.get_inputs()[0].name

        
        self.transform = transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
        ])

        # Función auxiliar para cargar o inicializar HNSW
        def cargar_indice(bin_name, map_name):
            map_path = os.path.join(base_dir, map_name)
            bin_path = os.path.join(base_dir, bin_name)
            
            indice_map = self._parse_json_map(map_path) if os.path.exists(map_path) else {}
            indice_hnsw = hnswlib.Index(space='l2', dim=128)
            
           
            if os.path.exists(bin_path):
                indice_hnsw.load_index(bin_path, max_elements=100000)
            else:
                indice_hnsw.init_index(max_elements=100000, ef_construction=200, M=16)
                
            return indice_hnsw, indice_map

        # 3 y 4. Cargar/Inicializar Índices v5
        self.dog_index, self.dog_map = cargar_indice('embedding_index_v5.bin', 'embedding_index_v5_map.json')
        self.cat_index, self.cat_map = cargar_indice('cat_embedding_index_v5.bin', 'cat_embedding_index_v5_map.json')

        # mtime del .bin al momento de cargarlo, para poder detectar despues
        # si OTRO proceso (ej. celery-worker) escribio una version mas nueva
        # -- ver _refrescar_si_cambio().
        self._mtimes = {}
        for especie, bin_name in (('perro', 'embedding_index_v5.bin'), ('gato', 'cat_embedding_index_v5.bin')):
            bin_path = os.path.join(base_dir, bin_name)
            self._mtimes[especie] = os.path.getmtime(bin_path) if os.path.exists(bin_path) else 0

        logger.info("VisionService: modelos v5 listos para producción.")

    def _refrescar_si_cambio(self, especie):
        """
        VisionService es un Singleton POR PROCESO -- si celery-worker
        aprende un embedding nuevo (aprender_embedding), ese proceso
        actualiza SU copia en RAM y la guarda en disco, pero el proceso
        'web' (que atiende verificar_duplicado de forma sincrona) tiene su
        PROPIA copia en RAM, cargada una sola vez al arrancar, que nunca se
        entera de esa escritura -- buscar_similares() terminaba comparando
        contra un mapping desactualizado, sin los candidatos mas recientes,
        y devolvia {} (todo FOTO Raw=0.00) sin ningun error visible.

        Este chequeo es barato (un stat() del archivo) y solo recarga el
        indice completo si el mtime en disco cambio desde la ultima carga
        de ESTE proceso -- no reconstruye nada en cada request.
        """
        recursos = self._index_para(especie)
        if recursos is None:
            return
        _, _, _, bin_name, map_name = recursos
        base_dir = settings.DEDUP_MODELS_DIR
        bin_path = os.path.join(base_dir, bin_name)

        if not os.path.exists(bin_path):
            return

        mtime_actual = os.path.getmtime(bin_path)
        especie_key = especie.lower()
        if mtime_actual == self._mtimes.get(especie_key):
            return  # sin cambios desde la ultima carga de este proceso, no hacer nada

        logger.info("VisionService: %s cambio en disco, recargando indice para '%s'.", bin_name, especie_key)
        map_path = os.path.join(base_dir, map_name)
        nuevo_map = self._parse_json_map(map_path) if os.path.exists(map_path) else {}
        nuevo_index = hnswlib.Index(space='l2', dim=128)
        nuevo_index.load_index(bin_path, max_elements=100000)

        if especie_key == 'perro':
            self.dog_index, self.dog_map = nuevo_index, nuevo_map
        else:
            self.cat_index, self.cat_map = nuevo_index, nuevo_map
        self._mtimes[especie_key] = mtime_actual

    def _index_para(self, especie):
        """Resuelve session/index/mapping/nombres de archivo según especie. None si no es perro/gato."""
        if especie.lower() == 'perro':
            return self.dog_session, self.dog_index, self.dog_map, 'embedding_index_v5.bin', 'embedding_index_v5_map.json'
        if especie.lower() == 'gato':
            return self.cat_session, self.cat_index, self.cat_map, 'cat_embedding_index_v5.bin', 'cat_embedding_index_v5_map.json'
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
        # La ruta la vamos a cambiar en el siguiente paso
        base_dir = settings.DEDUP_MODELS_DIR        

        # --- INICIO DEL LOCK REAL ---
        lock_key = f"dedup_index_lock_{especie.lower()}"
        with cache.lock(lock_key, timeout=30):
            new_label = index.get_current_count()
            if new_label >= index.get_max_elements():
                index.resize_index(index.get_max_elements() + 1000)

            index.add_items([emb], [new_label])
            
            db_id_limpio = int(str(db_id).split('&')[0])
            mapping[new_label] = str(db_id_limpio) 

            # Escritura a disco protegida por el lock
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
        # Solo lectura, pero corre potencialmente en un proceso distinto
        # (web) al que escribio el ultimo cambio (celery-worker) -- refresca
        # la copia en RAM de este proceso si el archivo en disco cambio.
        self._refrescar_si_cambio(especie)

        recursos = self._index_para(especie)
        if recursos is None:
            raise ValueError(f"Especie no soportada para deduplicación visual: {especie}")
        
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
            # Los embeddings están normalizados L2 (unit vectors, ver
            # nn.functional.normalize en EmbeddingNet.forward), así que la
            # similitud coseno es directamente el producto punto -- no hace
            # falta pasar por distancia euclidiana.
            #
            # ANTES: score = 1/(1+||a-b||). Para vectores unitarios,
            # ||a-b||² = 2 - 2·cos_sim, así que un par NO relacionado
            # (cos_sim≈0) daba distancia=√2≈1.414 -> score≈0.414. Eso
            # comprimía todo el rango "no relacionado" en la banda 0.33-0.41,
            # dejando solo 0.41-1.00 para representar de "algo parecido" a
            # "idéntico" -- por eso perros sin ninguna relación real
            # mostraban FOTO Raw~0.40-0.44 en vez de acercarse a 0.
            #
            # AHORA: cos_sim directo. Un par no relacionado da ~0.0, uno
            # idéntico da ~1.0 -- se usa la escala completa 0-1, y el Hard
            # Gate (score >= 0.50) vuelve a ser un umbral que separa señal
            # real, no un umbral que casi todo par cruza por el piso de la
            # fórmula anterior.
            cos_sim = float(np.dot(vector, emb))
            scores[str(db_id)] = max(0.0, cos_sim)

        return scores


class DeteccionEspecieService:
    """
    Detección de especie usando YOLOv8 exportado a ONNX puro.
    Sin NMS ni PyTorch, inferencia en milisegundos sin "Cold Start" pesado.
    """
    _instance = None

    CLASE_GATO = 15
    CLASE_PERRO = 16
    CONFIANZA_MINIMA = float(os.environ.get('YOLO_ESPECIE_CONFIANZA', 0.40))

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(DeteccionEspecieService, cls).__new__(cls)
            cls._instance._cargar_modelo()
        return cls._instance

    def _cargar_modelo(self):
        # NOTA: Asegúrate de tener el archivo yolov8n.onnx en tu carpeta ml_models
        ruta = getattr(settings, 'YOLO_ESPECIE_MODEL_PATH', None) \
            or os.path.join(settings.DEDUP_MODELS_DIR, 'yolov8n.onnx')

        logger.info("DeteccionEspecieService: cargando modelo ONNX desde %s...", ruta)
        self.session = ort.InferenceSession(ruta, providers=['CPUExecutionProvider'])
        self.input_name = self.session.get_inputs()[0].name
        logger.info("DeteccionEspecieService: modelo ONNX listo.")

    def detectar(self, ruta_imagen):
        try:
            # 1. Preprocesamiento manual 
            img = Image.open(ruta_imagen).convert("RGB")
            img_resized = img.resize((640, 640)) 
            
            img_data = np.array(img_resized, dtype=np.float32) / 255.0
            img_data = np.transpose(img_data, (2, 0, 1))
            img_data = np.expand_dims(img_data, axis=0)

            # 2. Inferencia ultra rápida
            outputs = self.session.run(None, {self.input_name: img_data})
            preds = outputs[0][0] # Matriz cruda (84, 8400)

            # 3. Extraer predicciones
            probabilidades_gato = preds[4 + self.CLASE_GATO, :]
            probabilidades_perro = preds[4 + self.CLASE_PERRO, :]

            max_gato = float(np.max(probabilidades_gato))
            max_perro = float(np.max(probabilidades_perro))

            if max_gato > max_perro:
                mejor_confianza = max_gato
                especie = 'gato'
            else:
                mejor_confianza = max_perro
                especie = 'perro'

            # 4. Veredicto final
            if mejor_confianza >= self.CONFIANZA_MINIMA:
                return {'es_mascota': True, 'especie_detectada': especie, 'confianza': mejor_confianza}
            else:
                return {'es_mascota': False, 'especie_detectada': None, 'confianza': None}

        except Exception:
            logger.exception("DeteccionEspecieService: fallo al procesar %s", ruta_imagen)
            return None

# Boost chico (con tope, ver min(100, ...) abajo) que se le da a
# original.urgency_score cuando alguien confirma un reporte como
# duplicado -- más gente reportando el mismo animal es señal real de
# que más gente lo está viendo/le importa.
BOOST_URGENCIA_POR_DUPLICADO = float(os.environ.get('DEDUP_BOOST_URGENCIA', 5))


def descartar_duplicado(original, duplicado):
    """
    Borra por completo `duplicado` (la Incidencia recién creada que el
    reportante confirmó que es el mismo caso que uno ya existente), junto
    con su Animal y la imagen que se haya subido — no tiene caso guardarla
    ni como caso cerrado. No se migran datos hacia `original.animal` (ver
    nota de fusionar() en versiones previas: mezclar datos de un reporte
    que puede estar mal capturado generaba problemas). Lo único que se
    ajusta en `original` es un boost chico y con tope en urgency_score:
    que más gente reporte el mismo animal es una señal real de que más
    gente lo está viendo/le importa, así que suma un poco — pero SIEMPRE
    con `min(100, ...)`, nunca sin tope (ver bug real: un boost sin tope
    aquí hacía que el front mostrara "105%", "125%", etc.). Ver
    SYSTEM_CONTRACT.md > Algoritmo: Deduplicación.
    """
    animal = duplicado.animal
    imagen = duplicado.imagen
    duplicado_id = duplicado.id

    duplicado.delete()

    if imagen:
        imagen.delete(save=False)

    urgencia_anterior = original.urgency_score or 0
    original.urgency_score = min(100.0, urgencia_anterior + BOOST_URGENCIA_POR_DUPLICADO)
    original.save(update_fields=['urgency_score'])

    if original.ubicacion and original.urgency_score != urgencia_anterior:
        from notificaciones.services import broadcast_urgency_update
        from core.zona import compute_zona_key
        zona_key = compute_zona_key(original.ubicacion.y, original.ubicacion.x)
        broadcast_urgency_update(original.id, zona_key, original.urgency_score)

    if animal is not None and not animal.incidencias.exists():
        animal.delete()

    logger.info("Deduplicación: incidencia %s borrada (confirmada como duplicado).", duplicado_id)
