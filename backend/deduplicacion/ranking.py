import difflib
import os


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
    # Umbrales sobre score_final (0-1). Estimación razonada inicial — ajustar
    # con el feedback loop cuando los rescatistas confirmen/rechacen duplicados
    # sugeridos (ver SYSTEM_CONTRACT.md > Algoritmo: Deduplicación, paso 7).
    UMBRAL_FUSION = float(os.environ.get('DEDUP_UMBRAL_FUSION', 0.75))
    UMBRAL_REVISION = float(os.environ.get('DEDUP_UMBRAL_REVISION', 0.55))

    # Radio de referencia (metros) para normalizar score_geo a 0-1. Debe ir
    # de la mano con DEDUP_RADIO_METROS en deduplicacion/filtros.py.
    RADIO_REFERENCIA_M = float(os.environ.get('DEDUP_RADIO_METROS', 10000))

    @staticmethod
    def calcular_score_final(candidatos, similitud_visual, nueva):
        resultados = []

        # 1. ¿Qué tan confiable es el texto?
        # Usamos 0 si es None, para evitar errores de .split()
        texto = nueva.caracteristicas or ""
        longitud_texto = len(texto.split())
        es_texto_confiable = longitud_texto > 10

        # 2. Definir pesos base dinámicos
        if es_texto_confiable:
            w_geo, w_estruc, w_foto, w_texto = 0.20, 0.35, 0.30, 0.15
        else:
            w_geo, w_estruc, w_foto, w_texto = 0.20, 0.40, 0.40, 0.0

        for cand in candidatos:
            # Score Geográfico — usa la distancia en metros anotada por
            # deduplicacion.filtros (Distance de PostGIS). cand.ubicacion es
            # SRID 4326 (grados), así que GEOSGeometry.distance() aquí daría
            # grados, no metros, y el score no discriminaría por cercanía real.
            # Si no viene anotado es que quien llamó a esta función no pasó
            # por filtrar_candidatos_geograficos() — mejor tronar fuerte que
            # dar un score silenciosamente corrupto en grados-como-metros.
            if not hasattr(cand, 'distancia_m'):
                raise ValueError(
                    "calcular_score_final requiere candidatos anotados con distancia_m — "
                    "usa deduplicacion.filtros.filtrar_candidatos_geograficos()."
                )
            distancia_m = cand.distancia_m.m
            score_geo = max(0, 1 - (distancia_m / RankingService.RADIO_REFERENCIA_M))

            # Score Estructurado — tres señales a partes iguales:
            # - tamano: catálogo fijo elegido por botones en el wizard de
            #   reporte (cachorro/adulto/pequeño/mediano/grande, ver
            #   create-report.page.html) — no hay typos posibles en un valor
            #   de catálogo, así que comparación exacta case-insensitive
            #   sigue siendo correcta (igual que el __iexact de filtros.py).
            # - color y raza: texto libre capturado por percepción subjetiva
            #   del reportante ("shibu inu" vs "shiba inu" — ver
            #   decision-tecnica-filtro-raza.md). Nunca se filtran duro
            #   (deduplicacion/filtros.py ya no excluye por raza), y aquí
            #   participan como similitud continua, no como igualdad exacta:
            #   un typo penaliza un poco, no anula el score.
            cand_tamano = (cand.animal.tamano or '').strip().lower()
            nueva_tamano = (nueva.animal.tamano or '').strip().lower()
            score_estruc = (1/3) if cand_tamano == nueva_tamano else 0.0
            score_estruc += (1/3) * _similitud(cand.animal.color, nueva.animal.color)
            score_estruc += (1/3) * _similitud(cand.animal.raza, nueva.animal.raza)

            # Score Foto (Normalizamos el dict de similitud que devuelve la IA)
            score_foto = similitud_visual.get(str(cand.id), 0.0)

            # Score Texto — similitud real (difflib, stdlib) en vez de
            # igualdad exacta de string, que casi nunca da 1.0 entre dos
            # reportes independientes aunque describan lo mismo.
            score_texto = _similitud(cand.caracteristicas, nueva.caracteristicas)

            # 4. Ponderación Final
            score_final = (score_geo * w_geo) + \
                          (score_estruc * w_estruc) + \
                          (score_foto * w_foto) + \
                          (score_texto * w_texto)

            resultados.append({
                "incidencia": cand,
                "score": score_final
            })

        return sorted(resultados, key=lambda x: x['score'], reverse=True)
