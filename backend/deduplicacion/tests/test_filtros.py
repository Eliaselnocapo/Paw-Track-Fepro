from datetime import timedelta

from django.contrib.gis.geos import Point
from django.test import TestCase
from django.utils import timezone

from bd.models import Animal, Incidencia
from deduplicacion.filtros import candidatos_por_metadatos, filtrar_candidatos_geograficos, radio_dinamico


class FiltroGeograficoTests(TestCase):
    def setUp(self):
        self.animal = Animal.objects.create(nombre="Firulais", tipo="PERRO", tamano="mediano", color="cafe")
        self.centro = Point(-98.2062, 19.0414, srid=4326)
        self.cercano = Point(-98.2062, 19.0459, srid=4326)  # ~500 m
        self.lejano = Point(-98.2062, 19.4900, srid=4326)   # ~50 km

        self.nueva = Incidencia.objects.create(
            tipo_incidencia="EXTRAVIADO", estado="PENDIENTE",
            animal=self.animal, ubicacion=self.centro,
        )

    def test_excluye_candidato_fuera_del_radio(self):
        lejano = Incidencia.objects.create(
            tipo_incidencia="EXTRAVIADO", estado="PENDIENTE",
            animal=self.animal, ubicacion=self.lejano,
        )
        candidatos = list(filtrar_candidatos_geograficos(self.nueva))
        self.assertNotIn(lejano, candidatos)

    def test_incluye_candidato_cercano_con_distancia_anotada_en_metros(self):
        cercano = Incidencia.objects.create(
            tipo_incidencia="EXTRAVIADO", estado="PENDIENTE",
            animal=self.animal, ubicacion=self.cercano,
        )
        candidatos = list(filtrar_candidatos_geograficos(self.nueva))
        encontrado = next(c for c in candidatos if c.id == cercano.id)

        # Regresión: antes se pasaba el radio como número crudo (10000) en vez
        # de Distance(m=10000) contra un PointField srid=4326 (grados). Si la
        # anotación estuviera en grados aquí saldría ~0.0045, no ~500.
        self.assertGreater(encontrado.distancia_m.m, 100)
        self.assertLess(encontrado.distancia_m.m, 1000)

    def test_excluye_incidencias_cerradas_o_resueltas(self):
        cerrada = Incidencia.objects.create(
            tipo_incidencia="EXTRAVIADO", estado="CERRADO",
            animal=self.animal, ubicacion=self.cercano,
        )
        resuelta = Incidencia.objects.create(
            tipo_incidencia="EXTRAVIADO", estado="RESUELTO",
            animal=self.animal, ubicacion=self.cercano,
        )
        candidatos = list(filtrar_candidatos_geograficos(self.nueva))
        self.assertNotIn(cerrada, candidatos)
        self.assertNotIn(resuelta, candidatos)


class FiltroEstructuraTests(TestCase):
    def setUp(self):
        self.punto = Point(-98.2062, 19.0414, srid=4326)

    def _incidencia(self, animal):
        return Incidencia.objects.create(
            tipo_incidencia="EXTRAVIADO", estado="PENDIENTE",
            animal=animal, ubicacion=self.punto,
        )

    def test_excluye_tipo_distinto(self):
        animal_perro = Animal.objects.create(nombre="A", tipo="PERRO", tamano="mediano", color="cafe")
        animal_gato = Animal.objects.create(nombre="B", tipo="GATO", tamano="mediano", color="cafe")

        nueva = self._incidencia(animal_perro)
        candidato_gato = self._incidencia(animal_gato)

        candidatos = list(candidatos_por_metadatos(nueva))
        self.assertNotIn(candidato_gato, candidatos)

    def test_excluye_choque_explicito_de_tamano(self):
        animal_chico = Animal.objects.create(nombre="A", tipo="PERRO", tamano="chico", color="cafe")
        animal_grande = Animal.objects.create(nombre="B", tipo="PERRO", tamano="grande", color="cafe")

        nueva = self._incidencia(animal_chico)
        candidato = self._incidencia(animal_grande)

        candidatos = list(candidatos_por_metadatos(nueva))
        self.assertNotIn(candidato, candidatos)

    def test_no_excluye_cuando_el_candidato_no_reporto_tamano(self):
        animal_chico = Animal.objects.create(nombre="A", tipo="PERRO", tamano="chico", color="cafe")
        animal_sin_tamano = Animal.objects.create(nombre="B", tipo="PERRO", tamano="", color="cafe")

        nueva = self._incidencia(animal_chico)
        candidato = self._incidencia(animal_sin_tamano)

        candidatos = list(candidatos_por_metadatos(nueva))
        self.assertIn(candidato, candidatos)


class RadioDinamicoTests(TestCase):
    """radio_dinamico() está disponible como utilidad (ver docstring en
    filtros.py sobre por qué todavía no es el default) — se prueba aislada."""

    def setUp(self):
        self.punto = Point(-98.2062, 19.0414, srid=4326)

    def _incidencia_con_edad(self, tipo, horas_de_antiguedad):
        animal = Animal.objects.create(nombre="A", tipo=tipo, tamano="mediano", color="cafe")
        inc = Incidencia.objects.create(
            tipo_incidencia="EXTRAVIADO", estado="PENDIENTE", animal=animal, ubicacion=self.punto,
        )
        # auto_now_add ignora cualquier created_at pasado a .create(), hay
        # que forzarlo después con un UPDATE directo a la fila.
        fecha_forzada = timezone.now() - timedelta(hours=horas_de_antiguedad)
        Incidencia.objects.filter(id=inc.id).update(created_at=fecha_forzada)
        inc.refresh_from_db()
        return inc

    def test_perro_menor_a_2h_da_300m(self):
        inc = self._incidencia_con_edad("PERRO", horas_de_antiguedad=1)
        self.assertEqual(radio_dinamico(inc), 300)

    def test_perro_entre_2_y_6h_da_800m(self):
        inc = self._incidencia_con_edad("PERRO", horas_de_antiguedad=4)
        self.assertEqual(radio_dinamico(inc), 800)

    def test_perro_mayor_a_6h_da_2000m(self):
        inc = self._incidencia_con_edad("PERRO", horas_de_antiguedad=10)
        self.assertEqual(radio_dinamico(inc), 2000)

    def test_gato_aplica_factor_0_5_en_cada_umbral(self):
        inc = self._incidencia_con_edad("GATO", horas_de_antiguedad=1)
        self.assertEqual(radio_dinamico(inc), 150)
