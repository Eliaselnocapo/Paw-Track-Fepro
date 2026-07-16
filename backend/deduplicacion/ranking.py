import difflib
import os
import logging
from deduplicacion.filtros import radio_dinamico

logger = logging.getLogger(__name__)

def _similitud(a: str, b: str) -> float:
    """Similitud difflib (stdlib, sin infraestructura nueva) entre dos
    textos libres, normalizada 0..1. 0.0 si cualquiera de los dos lados no
    reportó el dato — un campo opcional vacío no debe leerse como "coincide"
    con otro vacío, solo como "no hay señal"."""
    a, b = (a or "").strip().lower(), (b or "").strip().lower()
    if not a or not b:
        return 0.0
    return difflib.SequenceMatcher(None, a, b).ratio()


class RankingService:
    UMBRAL_FUSION = float(os.environ.get('DEDUP_UMBRAL_FUSION', 0.75))
    UMBRAL_REVISION = float(os.environ.get('DEDUP_UMBRAL_REVISION', 0.55))
    RADIO_REFERENCIA_M = float(os.environ.get('DEDUP_RADIO_METROS', 10000))

    @staticmethod
    def calcular_score_final(candidatos, similitud_visual, nueva):
        resultados = []

        # 1. ¿Qué tan confiable es el texto?
        texto_nueva = (nueva.caracteristicas or "").strip().lower()
        es_texto_confiable = len(texto_nueva.split()) > 10

        for cand in candidatos:
            # --- GEO ---
            if not hasattr(cand, 'distancia_m'):
                raise ValueError("calcular_score_final requiere candidatos anotados con distancia_m.")
            
            distancia_m = cand.distancia_m.m

            # Calculamos el radio ideal usando la función de tu equipo basada en
            # la especie y la antigüedad del reporte candidato
            radio_scoring = radio_dinamico(cand)

            # Normalizamos el score
            score_geo = max(0.0, 1.0 - (distancia_m / radio_scoring))

            # Score Texto — similitud real (difflib, stdlib) en vez de
            # igualdad exacta de string, que casi nunca da 1.0 entre dos
            # reportes independientes aunque describan lo mismo.
            score_texto = _similitud(cand.caracteristicas, nueva.caracteristicas)

            # --- VISUAL (ONNX) ---
            score_foto = similitud_visual.get(str(cand.id), 0.0)

            # --- ESTRUCTURA (METADATOS EXPANDIDOS) ---
            # Leemos directamente de la relación cand.animal y nueva.animal.
            # tipo/tamano/salud/edad_estimada/agresividad son catálogo fijo
            # elegido por botones en el wizard (sin typos posibles) → exacto.
            # color/raza son texto libre tecleado por el reportante (ver
            # decision-tecnica-filtro-raza.md: "shibu inu" vs "shiba inu" debe
            # penalizar un poco, no anular) → similitud continua (_similitud).
            CAMPOS_EXACTOS = ['tipo', 'tamano', 'salud', 'edad_estimada', 'agresividad']
            CAMPOS_LIBRES = ['color', 'raza']
            suma_validos = 0.0
            total_validos = 0

            for campo in CAMPOS_EXACTOS:
                val_nuevo = str(getattr(nueva.animal, campo, '') or '').strip().lower()
                val_cand = str(getattr(cand.animal, campo, '') or '').strip().lower()

                # Solo evaluamos si ambos reportes llenaron el campo
                if val_nuevo and val_cand:
                    total_validos += 1
                    if val_nuevo == val_cand:
                        suma_validos += 1.0

            for campo in CAMPOS_LIBRES:
                val_nuevo = getattr(nueva.animal, campo, '') or ''
                val_cand = getattr(cand.animal, campo, '') or ''
                if val_nuevo and val_cand:
                    total_validos += 1
                    suma_validos += _similitud(val_cand, val_nuevo)

            score_meta = (suma_validos / total_validos) if total_validos > 0 else 0.0

            # --- DISTRIBUCIÓN DE PESOS ---
            if es_texto_confiable:
                w_geo, w_meta, w_foto, w_texto = 0.15, 0.20, 0.45, 0.20
            else:
                # Mayoría absoluta a la foto
                w_geo, w_meta, w_foto, w_texto = 0.15, 0.40, 0.45, 0.0

            # --- HARD GATING (La magia antimanchas) ---
            # Si la similitud en su propia categoría es menor al 50%, se anula (0.0).
            # Geo queda fuera del gate: no es una señal de "parecido" que pueda
            # coincidir por casualidad, es una distancia física que ya decae
            # suave a 0 en el borde de radio_dinamico (ver arriba) — gatearla
            # igual que foto/meta/texto la volvía binaria (todo lo que cae
            # fuera de la mitad del radio puntúa 0 por igual, sin importar si
            # son 200m o 9km) y le quitaba a distancia_m su poder de discriminar.
            especie_animal = nueva.animal.tipo.upper()
            umbral_foto = 0.75 if especie_animal == 'PERRO' else 0.40

            if score_foto < umbral_foto:
                val_foto = 0.0
            else:
                val_foto = score_foto
            val_meta  = score_meta  if score_meta  >= 0.50 else 0.0
            val_geo   = score_geo
            val_texto = score_texto if score_texto >= 0.50 else 0.0

            # --- CÁLCULO FINAL ---
            score_final = (val_geo * w_geo) + (val_meta * w_meta) + (val_foto * w_foto) + (val_texto * w_texto)

            contrib_geo = val_geo * w_geo
            contrib_meta = val_meta * w_meta
            contrib_foto = val_foto * w_foto
            contrib_texto = val_texto * w_texto

            logger.info(
                f"\n[DEDUPLICACIÓN] Evaluando nueva={nueva.id} vs candidata={cand.id} | SCORE: {score_final:.3f}\n"
                f"  -> GEO:   Raw={score_geo:.2f} | Gate={val_geo:.2f} | Peso={w_geo:.2f} | Contribuyó: {contrib_geo:.3f}\n"
                f"  -> META:  Raw={score_meta:.2f} | Gate={val_meta:.2f} | Peso={w_meta:.2f} | Contribuyó: {contrib_meta:.3f}\n"
                f"  -> FOTO:  Raw={score_foto:.2f} | Gate={val_foto:.2f} | Peso={w_foto:.2f} | Contribuyó: {contrib_foto:.3f}\n"
                f"  -> TEXTO: Raw={score_texto:.2f} | Gate={val_texto:.2f} | Peso={w_texto:.2f} | Contribuyó: {contrib_texto:.3f}"
            )


            resultados.append({
                "incidencia": cand,
                "score": score_final
            })

        return sorted(resultados, key=lambda x: x['score'], reverse=True)