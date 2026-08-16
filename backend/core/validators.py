"""Validación de archivos subidos por usuarios."""
from rest_framework.exceptions import ValidationError

# Los primeros bytes identifican el tipo real del archivo. La extensión y el
# content_type los pone el cliente y se pueden falsificar: un .exe renombrado
# a .jpg pasa cualquier chequeo que solo mire el nombre.
FIRMAS_IMAGEN = {
    b'\xff\xd8\xff':         'jpeg',
    b'\x89PNG\r\n\x1a\n':    'png',
    b'GIF87a':               'gif',
    b'GIF89a':               'gif',
    b'RIFF':                 'webp',   # se confirma abajo con el bloque WEBP
    b'BM':                   'bmp',
}

MAX_IMAGEN_BYTES = 10 * 1024 * 1024


def validar_imagen(archivo):
    """Verifica tamaño y firma binaria. Lanza ValidationError si no pasa.

    Deja el puntero al inicio para que quien siga pueda leer el archivo
    completo.
    """
    if archivo is None:
        return

    if archivo.size > MAX_IMAGEN_BYTES:
        raise ValidationError('La imagen no puede superar 10 MB.')

    inicio = archivo.read(12)
    archivo.seek(0)

    for firma, tipo in FIRMAS_IMAGEN.items():
        if not inicio.startswith(firma):
            continue
        # WEBP comparte el encabezado RIFF con otros formatos (audio, video):
        # el identificador real está en los bytes 8-12.
        if tipo == 'webp' and inicio[8:12] != b'WEBP':
            continue
        return

    raise ValidationError(
        'El archivo no es una imagen válida. Formatos aceptados: JPG, PNG, GIF, WEBP.'
    )