import os
from django.test import TestCase
from unittest.mock import patch
from rest_framework.test import APIRequestFactory
from django.contrib.gis.geos import Point

from core.zona import compute_zona_key
from core.permissions import IsRescatista, IsAuthorOrRescatistaAsignado
from bd.models import Usuario, PerfilRescatista, Incidencia, Animal


class ZonaTests(TestCase):
    def test_compute_zona_key_default(self):
        """Prueba que las coordenadas se redondeen a 2 decimales por defecto."""
        resultado = compute_zona_key(19.4326, -99.1332)
        self.assertEqual(resultado, "19.43_-99.13")

    def test_compute_zona_key_precision_parametro(self):
        """Prueba que el parámetro explícito de precisión sobrescriba el default."""
        resultado = compute_zona_key(19.4326, -99.1332, precision=3)
        self.assertEqual(resultado, "19.433_-99.133")

    @patch.dict(os.environ, {'ZONA_PRECISION': '1'})
    def test_compute_zona_key_variable_entorno(self):
        """Prueba que respete la variable de entorno ZONA_PRECISION si no se pasa precisión explícita."""
        resultado = compute_zona_key(19.4326, -99.1332)
        self.assertEqual(resultado, "19.4_-99.1")


class PermissionsTests(TestCase):
    def setUp(self):
        # APIRequestFactory nos permite crear requests falsas sin levantar el servidor
        self.factory = APIRequestFactory()
        
        # 1. Setup de Usuarios
        self.u_reportero = Usuario.objects.create_user(
            email='reportero_unit@paw.com', 
            password='123', 
            roles=['REPORTERO']
        )
        self.u_rescatista = Usuario.objects.create_user(
            email='rescatista_unit@paw.com', 
            password='123', 
            roles=['RESCATISTA']
        )
        self.p_rescatista = PerfilRescatista.objects.create(usuario=self.u_rescatista)
        
        # 2. Setup de Incidencia base
        self.animal = Animal.objects.create(nombre="Perro Test")
        self.incidencia = Incidencia.objects.create(
            usuario_reporta=self.u_reportero, 
            animal=self.animal, 
            ubicacion=Point(0,0),
            estado='PENDIENTE'
        )

    def test_is_rescatista_permission(self):
        """Valida que solo los usuarios con el rol RESCATISTA pasen."""
        perm = IsRescatista()
        
        req_rep = self.factory.get('/')
        req_rep.user = self.u_reportero
        self.assertFalse(perm.has_permission(req_rep, None), "Un reportero NO debe pasar")

        req_resc = self.factory.get('/')
        req_resc.user = self.u_rescatista
        self.assertTrue(perm.has_permission(req_resc, None), "Un rescatista SÍ debe pasar")

    def test_is_author_or_rescatista_asignado(self):
        """Valida el acceso del autor (PENDIENTE) y del rescatista (EN_PROGRESO)."""
        perm = IsAuthorOrRescatistaAsignado()
        
        req_rep = self.factory.patch('/')
        req_rep.user = self.u_reportero
        
        req_resc = self.factory.patch('/')
        req_resc.user = self.u_rescatista

        # FASE 1: Estado PENDIENTE
        self.assertTrue(
            perm.has_object_permission(req_rep, None, self.incidencia),
            "El autor DEBE poder editar si está PENDIENTE"
        )
        self.assertFalse(
            perm.has_object_permission(req_resc, None, self.incidencia),
            "El rescatista NO DEBE poder editar si no está asignado"
        )

        # FASE 2: Estado EN_PROGRESO
        self.incidencia.estado = 'EN_PROGRESO'
        self.incidencia.rescatista_asignado = self.p_rescatista
        self.incidencia.save()

        self.assertFalse(
            perm.has_object_permission(req_rep, None, self.incidencia),
            "El autor NO DEBE poder editar si el caso ya fue aceptado"
        )
        self.assertTrue(
            perm.has_object_permission(req_resc, None, self.incidencia),
            "El rescatista asignado DEBE poder editar el caso"
        )
