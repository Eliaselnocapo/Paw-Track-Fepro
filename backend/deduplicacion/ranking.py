class RankingService:
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
            # Score Geográfico
            distancia = cand.ubicacion.distance(nueva.ubicacion)
            score_geo = max(0, 1 - (distancia / 10000)) 
            
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