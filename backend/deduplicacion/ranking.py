import difflib
import os


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

            # Score Estructurado — case-insensitive, igual que el __iexact
            # que ya usa filtros.py para el mismo campo (tamano); si no,
            # dos reportes del mismo animal con distinta capitalización
            # pasan el filtro pero pierden puntos aquí sin motivo real.
            score_estruc = 0.0
            cand_color = (cand.animal.color or '').strip().lower()
            nueva_color = (nueva.animal.color or '').strip().lower()
            if cand_color == nueva_color: score_estruc += 0.5
            cand_tamano = (cand.animal.tamano or '').strip().lower()
            nueva_tamano = (nueva.animal.tamano or '').strip().lower()
            if cand_tamano == nueva_tamano: score_estruc += 0.5

            # Score Foto (Normalizamos el dict de similitud que devuelve la IA)
            score_foto = similitud_visual.get(str(cand.id), 0.0)

            # Score Texto — similitud real (difflib, stdlib) en vez de
            # igualdad exacta de string, que casi nunca da 1.0 entre dos
            # reportes independientes aunque describan lo mismo.
            texto_cand = (cand.caracteristicas or "").strip().lower()
            texto_nueva = (nueva.caracteristicas or "").strip().lower()
            score_texto = (
                difflib.SequenceMatcher(None, texto_cand, texto_nueva).ratio()
                if texto_cand and texto_nueva else 0.0
            )

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
