from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import status
from rest_framework.test import APITestCase


class ProcesarCartelPDFViewTests(APITestCase):
    url = '/api/procesar-pdf-externo/'

    def test_rechaza_archivo_que_no_es_pdf(self):
        archivo = SimpleUploadedFile(
            'malicioso.exe', b'MZ\x90\x00contenido', content_type='application/pdf'
        )

        response = self.client.post(self.url, {'file': archivo}, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['error'], 'El archivo no es un PDF válido.')

    def test_rechaza_pdf_mayor_al_limite(self):
        archivo = SimpleUploadedFile(
            'grande.pdf',
            b'%PDF-' + (b'0' * (10 * 1024 * 1024)),
            content_type='application/pdf',
        )

        response = self.client.post(self.url, {'file': archivo}, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['error'], 'El PDF no puede superar 10 MB.')
