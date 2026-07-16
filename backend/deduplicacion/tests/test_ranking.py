from django.contrib.gis.geos import Point
from django.test import TestCase

from bd.models import Animal, Incidencia
from deduplicacion.filtros import filtrar_candidatos_geograficos
from deduplicacion.ranking import RankingService


class RankingScoreGeoTests(TestCase):
    def setUp(self):
        self.animal = Animal.objects.create(nombre="A", tipo="PERRO", tamano="mediano", color="cafe")
        self.centro = Point(-98.2062, 19.0414, srid=4326)
        self.cercano = Point(-98.2062, 19.0432, srid=4326)  # ~200 m
        self.lejano = Point(-98.2062, 19.1225, srid=4326)   # ~9 km (dentro del radio de 10 km, pero lejos)

        self.nueva = Incidencia.objects.create(
            tipo_incidencia="EXTRAVIADO", estado="PENDIENTE",
            animal=self.animal, ubicacion=self.centro,
        )
        self.candidato_cercano = Incidencia.objects.create(
            tipo_incidencia="EXTRAVIADO", estado="PENDIENTE",
            animal=self.animal, ubicacion=self.cercano,
        )
        self.candidato_lejano = Incidencia.objects.create(
            tipo_incidencia="EXTRAVIADO", estado="PENDIENTE",
            animal=self.animal, ubicacion=self.lejano,
        )

    def test_score_geo_discrimina_por_distancia_real(self):
        candidatos = list(filtrar_candidatos_geograficos(self.nueva))
        resultados = RankingService.calcular_score_final(candidatos, {}, self.nueva)
        scores = {r["incidencia"].id: r["score"] for r in resultados}

        # Regresión: antes se usaba GEOSGeometry.distance() (grados, no
        # metros) sobre un campo srid=4326, así que ambos candidatos salían
        # con score_geo ~1.0 sin importar qué tan lejos estuvieran en la
        # realidad. Aquí el cercano debe rankear estrictamente más alto.
        self.assertGreater(scores[self.candidato_cercano.id], scores[self.candidato_lejano.id])

    def test_calcular_score_final_truena_si_falta_distancia_m(self):
        """Si alguien llama calcular_score_final sin pasar por
        filtrar_candidatos_geograficos() (sin la anotación distancia_m), debe
        tronar en vez de dar un score silenciosamente corrupto en grados
        interpretados como metros."""
        candidato_sin_anotar = Incidencia.objects.filter(id=self.candidato_cercano.id).first()
        with self.assertRaises(ValueError):
            RankingService.calcular_score_final([candidato_sin_anotar], {}, self.nueva)


class RankingScoreEstrucTests(TestCase):
    def setUp(self):
        self.punto = Point(-98.2062, 19.0414, srid=4326)

    def test_score_estruc_suma_completo_cuando_color_raza_y_tamano_coinciden(self):
        animal_a = Animal.objects.create(nombre="A", tipo="PERRO", tamano="mediano", color="cafe", raza="shiba inu")
        animal_b = Animal.objects.create(nombre="B", tipo="PERRO", tamano="mediano", color="cafe", raza="shiba inu")
        nueva = Incidencia.objects.create(
            tipo_incidencia="EXTRAVIADO", estado="PENDIENTE", animal=animal_a, ubicacion=self.punto,
        )
        candidato = Incidencia.objects.create(
            tipo_incidencia="EXTRAVIADO", estado="PENDIENTE", animal=animal_b, ubicacion=self.punto,
        )
        candidatos = list(filtrar_candidatos_geograficos(nueva))
        resultados = RankingService.calcular_score_final(candidatos, {}, nueva)
        # geo=1.0 (mismo punto), foto=0, texto=0 → score_final == score_geo*w_geo + score_estruc*w_estruc
        esperado_min = 0.20 * 1.0 + 0.40 * 1.0  # sin texto confiable: w_estruc=0.40
        self.assertAlmostEqual(resultados[0]['score'], esperado_min, places=4)

    def test_score_estruc_tamano_es_case_insensitive(self):
        """Regresión: filtros.py ya matchea tamano con __iexact — ranking.py
        debe ser consistente, si no un duplicado real pierde puntos solo por
        capitalización distinta entre dos reportes."""
        animal_grande = Animal.objects.create(nombre="A", tipo="PERRO", tamano="Grande", color="")
        animal_grande_lower = Animal.objects.create(nombre="B", tipo="PERRO", tamano="grande", color="")
        nueva = Incidencia.objects.create(
            tipo_incidencia="EXTRAVIADO", estado="PENDIENTE", animal=animal_grande, ubicacion=self.punto,
        )
        candidato = Incidencia.objects.create(
            tipo_incidencia="EXTRAVIADO", estado="PENDIENTE", animal=animal_grande_lower, ubicacion=self.punto,
        )
        candidatos = list(filtrar_candidatos_geograficos(nueva))
        resultados = RankingService.calcular_score_final(candidatos, {}, nueva)
        # geo=1.0, estruc: solo tamano coincide (case-insensitive) = 1/3;
        # color y raza vacíos en ambos lados no suman (ver _similitud) → estruc=1/3
        esperado = 0.20 * 1.0 + 0.40 * (1 / 3)
        self.assertAlmostEqual(resultados[0]['score'], esperado, places=4)

    def test_score_estruc_raza_con_typo_penaliza_pero_no_anula(self):
        """Caso real que motivó decision-tecnica-filtro-raza.md: dos reportes
        del mismo perro, uno escribe "shiba inu" y otro "shibu inu". Antes
        (__iexact duro) el candidato ni siquiera llegaba a este punto. Ahora
        debe rankear por encima de un candidato con raza completamente
        distinta, sin caer a 0 por el typo."""
        animal_nueva = Animal.objects.create(nombre="A", tipo="PERRO", tamano="mediano", color="cafe", raza="shiba inu")
        animal_typo = Animal.objects.create(nombre="B", tipo="PERRO", tamano="mediano", color="cafe", raza="shibu inu")
        animal_distinto = Animal.objects.create(nombre="C", tipo="PERRO", tamano="mediano", color="cafe", raza="labrador")
        nueva = Incidencia.objects.create(
            tipo_incidencia="EXTRAVIADO", estado="PENDIENTE", animal=animal_nueva, ubicacion=self.punto,
        )
        candidato_typo = Incidencia.objects.create(
            tipo_incidencia="EXTRAVIADO", estado="PENDIENTE", animal=animal_typo, ubicacion=self.punto,
        )
        candidato_distinto = Incidencia.objects.create(
            tipo_incidencia="EXTRAVIADO", estado="PENDIENTE", animal=animal_distinto, ubicacion=self.punto,
        )
        candidatos = list(filtrar_candidatos_geograficos(nueva))
        resultados = RankingService.calcular_score_final(candidatos, {}, nueva)
        scores = {r["incidencia"].id: r["score"] for r in resultados}

        self.assertGreater(scores[candidato_typo.id], scores[candidato_distinto.id])


class RankingScoreTextoTests(TestCase):
    def setUp(self):
        self.animal = Animal.objects.create(nombre="A", tipo="PERRO", tamano="mediano", color="cafe")
        self.punto = Point(-98.2062, 19.0414, srid=4326)

    def _incidencia(self, caracteristicas):
        return Incidencia.objects.create(
            tipo_incidencia="EXTRAVIADO", estado="PENDIENTE",
            animal=self.animal, ubicacion=self.punto, caracteristicas=caracteristicas,
        )

    def test_texto_parecido_rankea_mas_alto_que_texto_sin_relacion(self):
        """Regresión del finding #5: score_texto era igualdad exacta de
        string (casi siempre 0 entre dos reportes reales). Con similitud
        real, dos descripciones parecidas del mismo caso deben rankear por
        encima de una completamente distinta, con geo/estructura iguales
        para ambos candidatos."""
        nueva = self._incidencia("perro cafe con collar rojo perdido cerca del parque, muy asustado")
        parecido = self._incidencia("perro café collar rojo perdido cerca del parque muy asustado")
        distinto = self._incidencia("encontrado durmiendo tranquilo junto a la banqueta de la esquina")

        candidatos = list(filtrar_candidatos_geograficos(nueva))
        resultados = RankingService.calcular_score_final(candidatos, {}, nueva)
        scores = {r["incidencia"].id: r["score"] for r in resultados}

        self.assertGreater(scores[parecido.id], scores[distinto.id])

    def test_texto_vacio_da_score_texto_cero_no_error(self):
        nueva = self._incidencia("")
        candidato = self._incidencia("perro cafe perdido")
        candidatos = list(filtrar_candidatos_geograficos(nueva))
        resultados = RankingService.calcular_score_final(candidatos, {}, nueva)
        self.assertEqual(len(resultados), 1)  # no truena con texto vacío
