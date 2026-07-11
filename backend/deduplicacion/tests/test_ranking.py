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
