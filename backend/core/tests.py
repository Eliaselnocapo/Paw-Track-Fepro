import os
from django.test import TestCase
from unittest.mock import patch
from core.zona import compute_zona_key

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
