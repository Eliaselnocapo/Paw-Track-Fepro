import io
from unittest import mock

from django.contrib.gis.geos import Point
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from PIL import Image
from rest_framework import status
from rest_framework.test import APITestCase

from bd.models import Animal, Incidencia, Usuario
from deduplicacion.models import SugerenciaDuplicado


def _fake_imagen(nombre="foto.jpg"):
    """Imagen real mínima (1x1 px) — el ImageField del serializer valida con
    PIL, así que bytes arbitrarios no pasan (a diferencia de crear una
    Incidencia directo por ORM, que se usa en los tests de deduplicacion/)."""
    buffer = io.BytesIO()
    Image.new("RGB", (1, 1)).save(buffer, format="JPEG")
    buffer.seek(0)
    return SimpleUploadedFile(nombre, buffer.read(), content_type="image/jpeg")


class VerificarDuplicadoTests(APITestCase):
    """POST /api/incidencias/verificar-duplicado/ — chequeo síncrono, sin
    persistir nada, pensado para correr en el paso 4 del wizard de reporte
    ANTES de crear la Incidencia. Reemplaza el chequeo async que corría
    después de crear el reporte (ver decision-tecnica-filtro-raza.md)."""

    def setUp(self):
        self.punto = Point(-98.2062, 19.0414, srid=4326)
        self.animal_existente = Animal.objects.create(
            nombre="Firulais", tipo="PERRO", tamano="mediano", color="cafe", raza="labrador",
        )
        self.existente = Incidencia.objects.create(
            tipo_incidencia="EXTRAVIADO", estado="PENDIENTE",
            animal=self.animal_existente, ubicacion=self.punto,
            imagen=_fake_imagen("existente.jpg"),
        )

    def _url(self):
        return reverse('incidencia-verificar-duplicado')

    def test_sin_imagen_no_regresa_candidato(self):
        response = self.client.post(self._url(), {
            'tipo_animal': 'PERRO', 'latitud': '19.0414', 'longitud': '-98.2062',
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsNone(response.data['candidato'])

    def test_sin_candidatos_cerca_no_regresa_nada(self):
        with mock.patch("deduplicacion.services.VisionService") as MockVision:
            response = self.client.post(self._url(), {
                'tipo_animal': 'PERRO', 'latitud': '10.0', 'longitud': '10.0',
                'imagen': _fake_imagen(),
            }, format='multipart')
            MockVision.assert_not_called()  # ni siquiera se instancia: se descarta en el filtro geo

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsNone(response.data['candidato'])

    def test_score_alto_regresa_el_candidato(self):
        with mock.patch("deduplicacion.services.VisionService") as MockVision:
            instancia = MockVision.return_value
            instancia.buscar_similares.return_value = {str(self.existente.id): 1.0}

            response = self.client.post(self._url(), {
                'tipo_animal': 'PERRO', 'tamano_animal': 'mediano',
                'color_animal': 'cafe', 'raza_animal': 'labrador',
                'latitud': '19.0414', 'longitud': '-98.2062',
                'imagen': _fake_imagen(),
            }, format='multipart')
            instancia.aprender_embedding.assert_not_called()  # solo lectura, nunca muta el índice

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        candidato = response.data['candidato']
        self.assertIsNotNone(candidato)
        self.assertEqual(candidato['folio'], self.existente.folio)
        self.assertGreaterEqual(candidato['score'], 0.55)

    def test_no_persiste_ninguna_incidencia_nueva(self):
        antes = Incidencia.objects.count()
        with mock.patch("deduplicacion.services.VisionService") as MockVision:
            instancia = MockVision.return_value
            instancia.buscar_similares.return_value = {str(self.existente.id): 1.0}
            self.client.post(self._url(), {
                'tipo_animal': 'PERRO', 'latitud': '19.0414', 'longitud': '-98.2062',
                'imagen': _fake_imagen(),
            }, format='multipart')

        self.assertEqual(Incidencia.objects.count(), antes)


class CrearReporteConDuplicadoTests(APITestCase):
    """POST /api/incidencias/ con duplicado_candidato_folio/duplicado_confirmado
    — la decisión que el reportante ya tomó en el paso 4 se aplica en el
    mismo request que crea el reporte."""

    def setUp(self):
        self.reportante = Usuario.objects.create_user(
            email='reportante@test.com', password='pass123', roles=['REPORTERO']
        )
        self.animal_original = Animal.objects.create(
            nombre="Firulais", tipo="PERRO", tamano="mediano", color="", raza="",
        )
        self.punto = Point(-98.2062, 19.0414, srid=4326)
        self.original = Incidencia.objects.create(
            tipo_incidencia="EXTRAVIADO", estado="PENDIENTE",
            animal=self.animal_original, ubicacion=self.punto, urgency_score=20,
        )

    def _payload_base(self):
        return {
            'tipo_animal': 'PERRO', 'tamano_animal': 'mediano',
            'color_animal': 'cafe', 'raza_animal': 'labrador',
            'condicion_animal': 'callejero', 'notas_animal': '',
            'latitud': '19.0414', 'longitud': '-98.2062',
            'imagen': _fake_imagen('nueva.jpg'),
        }

    def test_confirmado_borra_el_nuevo_y_da_un_boost_chico_con_tope_al_original(self):
        """Al confirmar un duplicado, el reporte nuevo se borra por completo
        (no se guarda ni como caso cerrado). El original recibe un boost
        chico y con tope en urgency_score (más gente reportando el mismo
        animal es señal real), pero sus datos NO se enriquecen con lo que
        traiga el duplicado — ver descartar_duplicado() en
        deduplicacion/services.py."""
        antes = Incidencia.objects.count()
        self.client.force_authenticate(user=self.reportante)
        payload = self._payload_base()
        payload.update({
            'duplicado_candidato_folio': self.original.folio,
            'duplicado_confirmado': 'true',
            'duplicado_score': '0.81',
        })
        response = self.client.post('/api/incidencias/', payload, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['duplicado_descartado'])
        self.assertEqual(response.data['folio_existente'], self.original.folio)

        # no quedó ninguna Incidencia nueva: ni activa ni cerrada
        self.assertEqual(Incidencia.objects.count(), antes)

        self.original.refresh_from_db()
        self.animal_original.refresh_from_db()
        self.assertEqual(self.original.urgency_score, 25)  # 20 + boost (5 por default)
        # el original no tenía color/raza — ya no se enriquece con el duplicado
        self.assertEqual(self.animal_original.color, '')
        self.assertEqual(self.animal_original.raza, '')

    def test_boost_de_urgencia_respeta_el_tope_de_100(self):
        """Regresión: el boost viejo (+10 sin tope) mandaba urgency_score
        arriba de 100 y el front lo mostraba como "105%", "125%", etc. — ver
        view-report.page.html. Con varios duplicados confirmados seguidos,
        nunca debe pasar de 100."""
        self.original.urgency_score = 97
        self.original.save(update_fields=['urgency_score'])

        self.client.force_authenticate(user=self.reportante)
        payload = self._payload_base()
        payload.update({
            'duplicado_candidato_folio': self.original.folio,
            'duplicado_confirmado': 'true',
        })
        self.client.post('/api/incidencias/', payload, format='multipart')

        self.original.refresh_from_db()
        self.assertEqual(self.original.urgency_score, 100)  # 97 + 5 topado a 100

        # confirmado no deja SugerenciaDuplicado: no hay Incidencia a la cual apuntar
        self.assertFalse(SugerenciaDuplicado.objects.filter(incidencia_candidata=self.original).exists())

    def test_rechazado_queda_como_caso_independiente(self):
        self.client.force_authenticate(user=self.reportante)
        payload = self._payload_base()
        payload.update({
            'duplicado_candidato_folio': self.original.folio,
            'duplicado_confirmado': 'false',
            'duplicado_score': '0.6',
        })
        response = self.client.post('/api/incidencias/', payload, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        nueva = Incidencia.objects.get(id=response.data['id'])
        self.assertEqual(nueva.estado, 'VALIDADO')

        self.original.refresh_from_db()
        self.assertEqual(self.original.urgency_score, 20)  # sin boost

        sugerencia = SugerenciaDuplicado.objects.get(incidencia_nueva=nueva)
        self.assertEqual(sugerencia.estado, 'RECHAZADA')

    def test_no_enriquece_ni_siquiera_un_campo_vacio(self):
        """Regresión: fusionar() ya no llama a ningún enriquecimiento — un
        campo vacío en el original se queda vacío, no se llena con lo que
        traiga el duplicado."""
        self.client.force_authenticate(user=self.reportante)
        payload = self._payload_base()  # color_animal='cafe' en el nuevo reporte
        payload.update({
            'duplicado_candidato_folio': self.original.folio,
            'duplicado_confirmado': 'true',
        })
        self.client.post('/api/incidencias/', payload, format='multipart')

        self.animal_original.refresh_from_db()
        self.assertEqual(self.animal_original.color, '')  # sigue vacío, no se enriquece

    def test_sin_campos_de_duplicado_se_comporta_como_antes(self):
        self.client.force_authenticate(user=self.reportante)
        response = self.client.post('/api/incidencias/', self._payload_base(), format='multipart')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        nueva = Incidencia.objects.get(id=response.data['id'])
        self.assertEqual(nueva.estado, 'VALIDADO')
        self.assertFalse(SugerenciaDuplicado.objects.filter(incidencia_nueva=nueva).exists())
