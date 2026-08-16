"""Integración end-to-end: bd (incidencia) -> rescates (aceptar/cerrar) -> recursos.

Cubre la 'Prueba manual de integracion' documentada en
Planes/contrato-front-recursos.md, pero automatizada como regresión: crea la
incidencia y mueve el rescate por sus endpoints reales (no por asignación
directa de `estado` en el ORM) para que un cambio en cualquiera de las tres
apps que rompa el flujo cruzado falle aquí, no solo en producción.
"""
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
import io
from PIL import Image
from bd.models import PerfilPatrocinador

Usuario = get_user_model()

def imagen_valida(nombre='evidencia.jpg'):
    """JPEG real: validar_imagen() revisa los magic bytes, no la extensión."""
    buffer = io.BytesIO()
    Image.new('RGB', (10, 10), 'red').save(buffer, format='JPEG')
    buffer.seek(0)
    return SimpleUploadedFile(nombre, buffer.read(), content_type='image/jpeg')

class FlujoCompletoRecursosTests(APITestCase):
    def setUp(self):
        self.reportero = Usuario.objects.create_user(
            email='reportero-e2e@example.com', password='segura123',
            roles=['REPORTERO'],
        )
        self.rescatista = Usuario.objects.create_user(
            email='rescatista-e2e@example.com', password='segura123',
            roles=['RESCATISTA'],
        )
        self.patrocinador_usuario = Usuario.objects.create_user(
            email='patrocinador-e2e@example.com', password='segura123',
            roles=['PATROCINADOR'],
        )
        self.patrocinador = PerfilPatrocinador.objects.create(
            usuario=self.patrocinador_usuario,
            nombre='Refugio E2E', direccion='CDMX',
            telefono='5555555555',
            horario='9 a 17', correo='contacto@refugioe2e.example',
            estado='APROBADO',
        )

    def test_flujo_completo_incidencia_rescate_recurso(self):
        # 1. Reportero crea la incidencia
        self.client.force_authenticate(self.reportero)
        respuesta_crear = self.client.post(reverse('incidencia-list'), {
            'latitud': 19.4326,
            'longitud': -99.1332,
            'direccion': 'Av. Reforma 222, Col. Juárez',
            'tipo_incidencia': 'EMERGENCIA',
            'tipo_animal': 'perro',
        }, format='json')
        self.assertEqual(respuesta_crear.status_code, status.HTTP_201_CREATED, respuesta_crear.data)
        folio = respuesta_crear.data['folio']
        incidencia_id = respuesta_crear.data['id']

        # 2. Rescatista acepta el caso
        self.client.force_authenticate(self.rescatista)
        respuesta_aceptar = self.client.post(reverse('aceptar-rescate', kwargs={'folio': folio}))
        self.assertEqual(respuesta_aceptar.status_code, status.HTTP_201_CREATED, respuesta_aceptar.data)

        from rescates.models import Rescate
        rescate = Rescate.objects.get(incidencia_id=incidencia_id)
        self.assertEqual(rescate.estado, 'EN_CAMINO')

        # 3. Patrocinador crea un recurso para el caso activo -> debe quedar BLOQUEADO
        self.client.force_authenticate(self.patrocinador_usuario)
        respuesta_crear_recurso = self.client.post(reverse('recursos-list'), {
            'incidencia': incidencia_id,
            'tipo': 'veterinario',
            'descripcion': 'Consulta y medicamentos',
        })
        self.assertEqual(respuesta_crear_recurso.status_code, status.HTTP_201_CREATED, respuesta_crear_recurso.data)
        self.assertEqual(respuesta_crear_recurso.data['estado'], 'BLOQUEADO')
        recurso_id = respuesta_crear_recurso.data['id']

        # 4. Intentar liberar antes del cierre -> resource_not_releasable
        respuesta_liberar_temprano = self.client.patch(
            reverse('recursos-liberar', kwargs={'pk': recurso_id})
        )
        self.assertEqual(respuesta_liberar_temprano.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(respuesta_liberar_temprano.data['code'], 'resource_not_releasable')

        # 5. Rescatista cierra el rescate con evidencia (GPS + foto)
        self.client.force_authenticate(self.rescatista)
        foto_evidencia = imagen_valida()
        respuesta_cerrar = self.client.post(
            reverse('cerrar-rescate', kwargs={'rescate_id': rescate.id}),
            {'lat': 19.4326, 'lng': -99.1332, 'foto': foto_evidencia},
            format='multipart',
        )
        self.assertEqual(respuesta_cerrar.status_code, status.HTTP_200_OK, respuesta_cerrar.data)

        from bd.models import Incidencia
        incidencia = Incidencia.objects.get(id=incidencia_id)
        self.assertEqual(incidencia.estado, 'CERRADO')

        # 6. Patrocinador libera el recurso -> LIBERADO con released_at
        self.client.force_authenticate(self.patrocinador_usuario)
        respuesta_liberar = self.client.patch(
            reverse('recursos-liberar', kwargs={'pk': recurso_id})
        )
        self.assertEqual(respuesta_liberar.status_code, status.HTTP_200_OK, respuesta_liberar.data)
        self.assertEqual(respuesta_liberar.data['estado'], 'LIBERADO')
        self.assertIsNotNone(respuesta_liberar.data['released_at'])

        # 7. Reintentar liberar es idempotente: misma fecha de liberación
        respuesta_liberar_otra_vez = self.client.patch(
            reverse('recursos-liberar', kwargs={'pk': recurso_id})
        )
        self.assertEqual(respuesta_liberar_otra_vez.status_code, status.HTTP_200_OK)
        self.assertEqual(
            respuesta_liberar_otra_vez.data['released_at'],
            respuesta_liberar.data['released_at'],
        )

    def test_no_se_puede_asignar_recurso_a_incidencia_ya_cerrada(self):
        self.client.force_authenticate(self.reportero)
        respuesta_crear = self.client.post(reverse('incidencia-list'), {
            'latitud': 19.4326,
            'longitud': -99.1332,
            'tipo_incidencia': 'EMERGENCIA',
        }, format='json')
        incidencia_id = respuesta_crear.data['id']
        folio = respuesta_crear.data['folio']

        self.client.force_authenticate(self.rescatista)
        self.client.post(reverse('aceptar-rescate', kwargs={'folio': folio}))
        from rescates.models import Rescate
        rescate = Rescate.objects.get(incidencia_id=incidencia_id)

        foto_evidencia = imagen_valida()
        self.client.post(
            reverse('cerrar-rescate', kwargs={'rescate_id': rescate.id}),
            {'lat': 19.4326, 'lng': -99.1332, 'foto': foto_evidencia},
            format='multipart',
        )

        # Con la incidencia ya CERRADO, crear un recurso nuevo debe rechazarse
        self.client.force_authenticate(self.patrocinador_usuario)
        respuesta = self.client.post(reverse('recursos-list'), {
            'incidencia': incidencia_id,
            'tipo': 'transporte',
        })
        self.assertEqual(respuesta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(respuesta.data['code'], 'resource_not_assignable')
    
