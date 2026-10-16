import json
import logging
from decimal import Decimal
from urllib.parse import urlparse

import cloudinary.uploader
from django.contrib.admin.models import ADDITION, CHANGE, DELETION, LogEntry
from django.db import transaction
from django.db.models.deletion import ProtectedError
from rest_framework import serializers, status, viewsets
from rest_framework.exceptions import APIException, ParseError
from rest_framework.parsers import DataAndFiles, JSONParser, MultiPartParser
from rest_framework.response import Response

from .models import Combo, ItemPedido, Producto
from .permissions import AdministradorCatalogo

logger = logging.getLogger(__name__)


class CatalogoMultiPartParser(MultiPartParser):
    def parse(self, stream, media_type=None, parser_context=None):
        result = super().parse(stream, media_type, parser_context)
        try:
            datos = json.loads(result.data.get("datos", "{}"))
        except (TypeError, ValueError):
            raise ParseError("Los datos del artículo no son JSON válido.")
        if not isinstance(datos, dict):
            raise ParseError("Los datos del artículo deben ser un objeto.")
        archivos = dict(result.files.items())
        for campo in list(archivos):
            if not campo.startswith("sabor_imagen_"):
                continue
            indice = campo.removeprefix("sabor_imagen_")
            sabores = datos.get("sabores")
            if (
                parser_context["view"].get_serializer_class().Meta.model is not Producto
                or not indice.isdecimal()
                or len(indice) > 2
                or not isinstance(sabores, list)
                or int(indice) >= min(len(sabores), 30)
                or not isinstance(sabores[int(indice)], dict)
                or len(result.files.getlist(campo)) != 1
            ):
                raise ParseError("Cada imagen de sabor debe corresponder a un sabor del producto.")
            sabores[int(indice)]["imagen_archivo"] = archivos.pop(campo)
        return DataAndFiles(datos, archivos)


def validar_imagen_url(value):
    if not value:
        return value
    url = urlparse(value)
    if value.startswith("/") and not value.startswith("//"):
        return value
    if url.scheme == "https" and url.hostname == "res.cloudinary.com":
        return value
    raise serializers.ValidationError("Usá una imagen de Cloudinary o una ruta local que comience con /.")


def validar_archivo_imagen(value):
    if value.size > 5 * 1024 * 1024:
        raise serializers.ValidationError("La imagen debe pesar como máximo 5 MB.")
    if value.image.format not in ("JPEG", "PNG", "WEBP"):
        raise serializers.ValidationError("Elegí una imagen JPG, PNG o WebP.")
    return value


class ImagenCatalogoSerializer(serializers.ModelSerializer):
    imagen = serializers.SerializerMethodField()
    imagen_url = serializers.CharField(source="imagen", max_length=500, required=False, allow_blank=True)
    imagen_archivo = serializers.ImageField(write_only=True, required=False)
    precio = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0.01"), coerce_to_string=False)

    def get_imagen(self, obj):
        return obj.imagen_archivo.build_url(secure=True) if obj.imagen_archivo else obj.imagen or "/logo-ember.png"

    def validate_imagen_url(self, value):
        return validar_imagen_url(value)

    def validate_imagen_archivo(self, value):
        return validar_archivo_imagen(value)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        activo = attrs.get("activo", self.instance.activo if self.instance else True)
        imagen = attrs.get("imagen", self.instance.imagen if self.instance else "")
        imagen_subida = attrs.get("imagen_archivo") or (self.instance.imagen_archivo if self.instance else None)
        if activo and not imagen and not imagen_subida:
            raise serializers.ValidationError({"imagen_archivo": "Agregá una imagen antes de publicar."})
        return attrs

    def _subir_imagen(self, validated_data):
        archivo = validated_data.get("imagen_archivo")
        if archivo is None:
            return
        try:
            validated_data["imagen_archivo"] = cloudinary.uploader.upload_image(
                archivo,
                asset_folder=f"ragnar/{self.Meta.model._meta.model_name}s",
                use_asset_folder_as_public_id_prefix=True,
                allowed_formats=["jpg", "png", "webp"],
                timeout=30,
            )
        except Exception:
            logger.warning("No se pudo subir la imagen del catálogo.")
            raise serializers.ValidationError({"imagen_archivo": "No pudimos subir la imagen. Revisá la conexión y la configuración de Cloudinary."})

    def create(self, validated_data):
        self._subir_imagen(validated_data)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        self._subir_imagen(validated_data)
        return super().update(instance, validated_data)


class SaborSerializer(serializers.Serializer):
    nombre = serializers.CharField(max_length=100)
    imagen = serializers.CharField(max_length=500, required=False, allow_blank=True, default="")
    imagen_archivo = serializers.ImageField(write_only=True, required=False)

    def validate_imagen(self, value):
        return validar_imagen_url(value)

    def validate_imagen_archivo(self, value):
        return validar_archivo_imagen(value)


class ProductoAdminSerializer(ImagenCatalogoSerializer):
    sabores = SaborSerializer(many=True, required=False)
    stock = serializers.IntegerField(min_value=0, max_value=2147483647)
    stock_anterior = serializers.IntegerField(write_only=True, required=False, min_value=0)

    class Meta:
        model = Producto
        fields = ("id", "nombre", "slug", "categoria", "descripcion", "precio", "stock", "stock_anterior", "sabores", "activo", "imagen", "imagen_url", "imagen_archivo", "actualizado")
        read_only_fields = ("id", "actualizado")

    def validate_sabores(self, value):
        nombres = [sabor["nombre"].casefold() for sabor in value]
        if len(value) > 30 or len(nombres) != len(set(nombres)):
            raise serializers.ValidationError("Agregá hasta 30 sabores con nombres diferentes.")
        return value

    def validate(self, attrs):
        attrs = super().validate(attrs)
        stock_anterior = attrs.pop("stock_anterior", None)
        if self.instance and "stock" in attrs and stock_anterior != self.instance.stock:
            raise ConflictoCatalogo("El stock cambió desde que abriste el editor. Volvé al listado, actualizalo y revisá las unidades antes de guardar.")
        return attrs

    def _subir_imagen(self, validated_data):
        # Primero se validan todos los archivos; los datos se guardan solo si suben todos.
        super()._subir_imagen(validated_data)
        for sabor in validated_data.get("sabores", []):
            archivo = sabor.pop("imagen_archivo", None)
            if archivo is None:
                continue
            try:
                imagen = cloudinary.uploader.upload_image(
                    archivo,
                    asset_folder="ragnar/productos/sabores",
                    use_asset_folder_as_public_id_prefix=True,
                    allowed_formats=["jpg", "png", "webp"],
                    timeout=30,
                )
                sabor["imagen"] = imagen.build_url(secure=True)
            except Exception:
                logger.warning("No se pudo subir una imagen de sabor.")
                raise serializers.ValidationError({"sabores": "No pudimos subir una imagen de sabor. Intentá nuevamente; los cambios no se guardaron."})


class ComboAdminSerializer(ImagenCatalogoSerializer):
    productos = serializers.PrimaryKeyRelatedField(many=True, queryset=Producto.objects.all(), allow_empty=False)
    stock = serializers.IntegerField(read_only=True)

    class Meta:
        model = Combo
        fields = ("id", "nombre", "slug", "descripcion", "precio", "productos", "stock", "activo", "imagen", "imagen_url", "imagen_archivo", "actualizado")
        read_only_fields = ("id", "actualizado")

    def validate_productos(self, value):
        if len(value) > 30 or len(value) != len({producto.pk for producto in value}):
            raise serializers.ValidationError("Elegí hasta 30 productos diferentes.")
        return value


class ConflictoCatalogo(APIException):
    status_code = status.HTTP_409_CONFLICT


class CatalogoAdminViewSet(viewsets.ModelViewSet):
    permission_classes = (AdministradorCatalogo,)
    parser_classes = (JSONParser, CatalogoMultiPartParser)
    http_method_names = ("get", "post", "patch", "delete", "head", "options")
    pagination_class = None

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.action in ("partial_update", "destroy"):
            queryset = queryset.select_for_update()
        return queryset

    def _registrar(self, instance, accion, mensaje):
        LogEntry.objects.log_actions(
            user_id=self.request.user.pk,
            queryset=[instance],
            action_flag=accion,
            change_message=mensaje,
            single_object=True,
        )

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        return super().create(request, *args, **kwargs)

    @transaction.atomic
    def partial_update(self, request, *args, **kwargs):
        return super().partial_update(request, *args, **kwargs)

    def perform_create(self, serializer):
        instance = serializer.save()
        self._registrar(instance, ADDITION, "Creado desde el panel de la tienda.")

    def perform_update(self, serializer):
        instance = serializer.save()
        self._registrar(instance, CHANGE, "Actualizado desde el panel de la tienda.")

    @transaction.atomic
    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if isinstance(instance, Producto):
            en_historial_combo = any(
                instance.pk in componentes
                for componentes in ItemPedido.objects.exclude(componentes_combo=[]).values_list("componentes_combo", flat=True).iterator()
            )
            if instance.combos.exists() or en_historial_combo:
                raise ConflictoCatalogo("Este producto forma parte de combos o pedidos. Despublicalo para retirarlo de la tienda conservando el historial.")
        elif ItemPedido.objects.filter(combo=instance).exists():
            raise ConflictoCatalogo("Este combo tiene pedidos asociados. Despublicalo para conservar el historial.")
        try:
            with transaction.atomic():
                self._registrar(instance, DELETION, "Eliminado desde el panel de la tienda.")
                instance.delete()
        except ProtectedError:
            raise ConflictoCatalogo("Este producto tiene pedidos asociados. Despublicalo para conservar el historial.")
        return Response(status=status.HTTP_204_NO_CONTENT)


class ProductoAdminViewSet(CatalogoAdminViewSet):
    queryset = Producto.objects.all().order_by("-actualizado")
    serializer_class = ProductoAdminSerializer


class ComboAdminViewSet(CatalogoAdminViewSet):
    queryset = Combo.objects.all().prefetch_related("productos").order_by("-actualizado")
    serializer_class = ComboAdminSerializer
