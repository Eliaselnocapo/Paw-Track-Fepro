from rest_framework.views import APIView
from rest_framework.generics import ListAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework.exceptions import NotFound

from core.pagination import StandardPagination

from .models import Notificacion
from .serializers import NotificacionSerializer


class MisNotificacionesView(ListAPIView):
    """GET /api/notificaciones/ — las del usuario logueado, más recientes
    primero. Acepta ?no_leidas=1 para filtrar."""
    permission_classes = [IsAuthenticated]
    serializer_class = NotificacionSerializer
    pagination_class = StandardPagination

    def get_queryset(self):
        qs = Notificacion.objects.filter(usuario=self.request.user)
        if self.request.query_params.get('no_leidas') in ('1', 'true'):
            qs = qs.filter(leida=False)
        return qs


class ConteoNoLeidasView(APIView):
    """GET /api/notificaciones/no-leidas/ — solo el número, para el badge de
    la campanita. Se consulta seguido, así que va aparte de la lista."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        total = Notificacion.objects.filter(usuario=request.user, leida=False).count()
        return Response({'no_leidas': total})


class MarcarLeidaView(APIView):
    """PATCH /api/notificaciones/{id}/leer/"""
    permission_classes = [IsAuthenticated]

    def patch(self, request, notificacion_id):
        try:
            notif = Notificacion.objects.get(pk=notificacion_id, usuario=request.user)
        except Notificacion.DoesNotExist:
            # Se filtra por usuario en el get: un id ajeno da 404, no 403,
            # para no revelar que la notificación existe.
            raise NotFound('Notificación no encontrada.')

        if not notif.leida:
            notif.leida = True
            notif.save(update_fields=['leida'])

        return Response(NotificacionSerializer(notif).data)


class MarcarTodasLeidasView(APIView):
    """POST /api/notificaciones/leer-todas/"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        actualizadas = Notificacion.objects.filter(
            usuario=request.user, leida=False,
        ).update(leida=True)

        return Response({'marcadas': actualizadas}, status=status.HTTP_200_OK)