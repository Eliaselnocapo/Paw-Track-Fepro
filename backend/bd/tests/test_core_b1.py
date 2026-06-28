"""
Tests para B1:
  - core/permissions.py  (IsRescatista, IsPatrocinador, IsOwner, IsAuthorOrRescatistaAsignado)
  - core/exceptions.py   (formato estándar de errores)
  - core/pagination.py   (page_size=20)
  - bd/views.py          (PATCH → IsAuthorOrRescatistaAsignado, DELETE → IsAdminUser)
"""
from unittest.mock import MagicMock

from django.test import TestCase
from django.contrib.gis.geos import Point
from rest_framework import status
from rest_framework.exceptions import ValidationError, NotFound
from rest_framework.test import APITestCase

from bd.models import Animal, Incidencia, PerfilRescatista, Usuario
from core.exceptions import pawtrack_exception_handler
from core.pagination import StandardPagination
from core.permissions import (
    IsAuthorOrRescatistaAsignado,
    IsOwner,
    IsPatrocinador,
    IsRescatista,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _req(user_id=1, roles=None, authenticated=True):
    """Mock de request con usuario configurado."""
    req = MagicMock()
    req.user.id = user_id
    req.user.is_authenticated = authenticated
    req.user.roles = roles or []
    req.user.perfil_rescatista = None
    return req


def _inc(autor_id, estado='PENDIENTE', rescatista_perfil_id=None):
    """Mock de Incidencia con los campos que usan los permisos."""
    obj = MagicMock()
    obj.usuario_reporta_id = autor_id
    obj.estado = estado
    obj.rescatista_asignado_id = rescatista_perfil_id
    return obj


# ---------------------------------------------------------------------------
# IsRescatista
# ---------------------------------------------------------------------------

class IsRescatistaTests(TestCase):
    def setUp(self):
        self.perm = IsRescatista()
        self.view = MagicMock()

    def test_permite_usuario_con_rol_rescatista(self):
        self.assertTrue(self.perm.has_permission(_req(roles=['RESCATISTA']), self.view))

    def test_permite_usuario_con_multiples_roles(self):
        self.assertTrue(self.perm.has_permission(_req(roles=['REPORTERO', 'RESCATISTA']), self.view))

    def test_bloquea_usuario_sin_rol_rescatista(self):
        self.assertFalse(self.perm.has_permission(_req(roles=['REPORTERO']), self.view))

    def test_bloquea_usuario_no_autenticado(self):
        self.assertFalse(self.perm.has_permission(_req(authenticated=False, roles=[]), self.view))

    def test_bloquea_roles_lista_vacia(self):
        self.assertFalse(self.perm.has_permission(_req(roles=[]), self.view))


# ---------------------------------------------------------------------------
# IsPatrocinador
# ---------------------------------------------------------------------------

class IsPatrocinadorTests(TestCase):
    def setUp(self):
        self.perm = IsPatrocinador()
        self.view = MagicMock()

    def test_permite_usuario_con_rol_patrocinador(self):
        self.assertTrue(self.perm.has_permission(_req(roles=['PATROCINADOR']), self.view))

    def test_bloquea_rescatista_sin_rol_patrocinador(self):
        self.assertFalse(self.perm.has_permission(_req(roles=['RESCATISTA']), self.view))

    def test_bloquea_usuario_no_autenticado(self):
        self.assertFalse(self.perm.has_permission(_req(authenticated=False), self.view))


# ---------------------------------------------------------------------------
# IsOwner
# ---------------------------------------------------------------------------

class IsOwnerTests(TestCase):
    def setUp(self):
        self.perm = IsOwner()
        self.view = MagicMock()

    def test_permite_al_autor(self):
        self.assertTrue(self.perm.has_object_permission(_req(user_id=5), self.view, _inc(autor_id=5)))

    def test_bloquea_a_tercero(self):
        self.assertFalse(self.perm.has_object_permission(_req(user_id=5), self.view, _inc(autor_id=99)))


# ---------------------------------------------------------------------------
# IsAuthorOrRescatistaAsignado
# ---------------------------------------------------------------------------

class IsAuthorOrRescatistaAsignadoTests(TestCase):
    def setUp(self):
        self.perm = IsAuthorOrRescatistaAsignado()
        self.view = MagicMock()

    def test_autor_puede_editar_reporte_pendiente(self):
        req = _req(user_id=1)
        self.assertTrue(self.perm.has_object_permission(req, self.view, _inc(autor_id=1, estado='PENDIENTE')))

    def test_autor_bloqueado_cuando_reporte_en_proceso(self):
        req = _req(user_id=1)
        self.assertFalse(self.perm.has_object_permission(req, self.view, _inc(autor_id=1, estado='EN_PROCESO')))

    def test_rescatista_asignado_puede_editar(self):
        req = _req(user_id=10)
        perfil = MagicMock()
        perfil.id = 3
        req.user.perfil_rescatista = perfil
        self.assertTrue(self.perm.has_object_permission(
            req, self.view, _inc(autor_id=99, estado='EN_PROCESO', rescatista_perfil_id=3)
        ))

    def test_rescatista_diferente_al_asignado_bloqueado(self):
        req = _req(user_id=10)
        perfil = MagicMock()
        perfil.id = 3
        req.user.perfil_rescatista = perfil
        self.assertFalse(self.perm.has_object_permission(
            req, self.view, _inc(autor_id=99, estado='EN_PROCESO', rescatista_perfil_id=7)
        ))

    def test_tercero_sin_perfil_bloqueado(self):
        req = _req(user_id=50)
        self.assertFalse(self.perm.has_object_permission(
            req, self.view, _inc(autor_id=1, estado='PENDIENTE')
        ))


# ---------------------------------------------------------------------------
# Exception handler — formato estándar
# ---------------------------------------------------------------------------

class ExceptionHandlerTests(TestCase):
    def test_validation_error_tiene_tres_campos(self):
        exc = ValidationError({'email': ['Este campo es requerido.']})
        response = pawtrack_exception_handler(exc, {})
        self.assertIn('code', response.data)
        self.assertIn('detail', response.data)
        self.assertIn('field_errors', response.data)

    def test_field_errors_contiene_campos_del_error(self):
        exc = ValidationError({'email': ['Requerido.'], 'password': ['Muy corta.']})
        response = pawtrack_exception_handler(exc, {})
        self.assertIn('email', response.data['field_errors'])
        self.assertIn('password', response.data['field_errors'])

    def test_not_found_error_formato_correcto(self):
        exc = NotFound()
        response = pawtrack_exception_handler(exc, {})
        self.assertEqual(response.data['code'], 'not_found')
        self.assertEqual(response.data['field_errors'], {})

    def test_excepcion_no_drf_retorna_none(self):
        response = pawtrack_exception_handler(ValueError("Error interno"), {})
        self.assertIsNone(response)


# ---------------------------------------------------------------------------
# Pagination
# ---------------------------------------------------------------------------

class PaginationTests(TestCase):
    def test_page_size_es_20(self):
        self.assertEqual(StandardPagination().page_size, 20)


# ---------------------------------------------------------------------------
# Integración — PATCH/DELETE en IncidenciaViewSet
# ---------------------------------------------------------------------------

class IncidenciaPermisosIntegracionTests(APITestCase):
    def setUp(self):
        self.autor = Usuario.objects.create_user(
            email='autor@test.com', password='Test1234!', roles=['REPORTERO']
        )
        self.tercero = Usuario.objects.create_user(
            email='tercero@test.com', password='Test1234!', roles=['REPORTERO']
        )
        self.admin = Usuario.objects.create_user(
            email='admin@test.com', password='Test1234!', is_staff=True
        )
        self.rescatista_user = Usuario.objects.create_user(
            email='resc@test.com', password='Test1234!', roles=['RESCATISTA']
        )
        self.perfil = PerfilRescatista.objects.create(usuario=self.rescatista_user)

        self.animal = Animal.objects.create(nombre='Rex', tipo='perro', salud='herido')
        self.incidencia = Incidencia.objects.create(
            usuario_reporta=self.autor,
            animal=self.animal,
            ubicacion=Point(-99.1332, 19.4326, srid=4326),
            tipo_incidencia='EMERGENCIA',
            estado='PENDIENTE',
        )
        self.url = f'/api/incidencias/{self.incidencia.id}/'

    # --- PATCH ---

    def test_patch_autor_pendiente_ok(self):
        self.client.force_authenticate(user=self.autor)
        response = self.client.patch(self.url, {'nombre_caso': 'Actualizado'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_patch_tercero_rechazado_403(self):
        self.client.force_authenticate(user=self.tercero)
        response = self.client.patch(self.url, {'nombre_caso': 'Intruso'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_patch_sin_autenticacion_rechazado_401(self):
        response = self.client.patch(self.url, {'nombre_caso': 'Sin token'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_patch_autor_en_proceso_rechazado_403(self):
        Incidencia.objects.filter(pk=self.incidencia.pk).update(estado='EN_PROCESO')
        self.client.force_authenticate(user=self.autor)
        response = self.client.patch(self.url, {'nombre_caso': 'Tarde'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_patch_rescatista_asignado_en_proceso_ok(self):
        Incidencia.objects.filter(pk=self.incidencia.pk).update(
            estado='EN_PROCESO', rescatista_asignado=self.perfil
        )
        self.client.force_authenticate(user=self.rescatista_user)
        response = self.client.patch(self.url, {'nombre_caso': 'En rescate'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    # --- DELETE ---

    def test_delete_usuario_normal_rechazado_403(self):
        self.client.force_authenticate(user=self.autor)
        response = self.client.delete(self.url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_delete_sin_autenticacion_rechazado_401(self):
        response = self.client.delete(self.url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_delete_admin_ok(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.delete(self.url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Incidencia.objects.filter(pk=self.incidencia.pk).exists())
