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
            distancia_m = cand.distancia_m.m if hasattr(cand, 'distancia_m') else None
            if distancia_m is None:
                distancia_m = cand.ubicacion.distance(nueva.ubicacion)
            score_geo = max(0, 1 - (distancia_m / RankingService.RADIO_REFERENCIA_M))

            # Score Estructurado
            score_estruc = 0.0
            if cand.animal.color == nueva.animal.color: score_estruc += 0.5
            if cand.animal.tamano == nueva.animal.tamano: score_estruc += 0.5

            # Score Foto (Normalizamos el dict de similitud que devuelve la IA)
            score_foto = similitud_visual.get(str(cand.id), 0.0)

            # Score Texto (Simulación de similitud simple por palabra clave)
            # Aquí podrías integrar algo más complejo luego
            score_texto = 1.0 if cand.caracteristicas == nueva.caracteristicas else 0.0

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
