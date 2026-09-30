from django.core.management.base import BaseCommand

from store.models import Combo, Producto


PRODUCTOS = [
    ("proteina-onefit", "Proteina OneFit", "proteinas", 42000, "/productos-img/proteinas/proteina-onefit/proteina-onefit-907gr.png"),
    ("creatina-star-300-gramos", "Creatina Star 300 gramos", "creatina", 27000, "/productos-img/creatinas/creatina-star/creatinastar.png"),
    ("pre-entreno-onefit-300-gramos", "Pre Entreno OneFit 300 gramos", "pre-entreno", 20000, "/productos-img/pre-entrenos/pre-onefit300g-uva.png"),
    ("citrato-de-magnesio-star-60-capsulas", "Citrato de Magnesio Star 60 capsulas", "vitaminas", 18000, "/productos-img/citrato-magnesio/mag-star-60caps.png"),
    ("proteina-star", "Proteina Star", "proteinas", 68000, "/productos-img/proteinas/proteina-star/cookieandcream.png"),
    ("omega-3-onefit-30-capsulas", "Omega 3 OneFit 30 capsulas", "vitaminas", 24000, "/productos-img/vitaminas/omega3-one.png"),
    ("creatina-onefit-micronizada-200g", "Creatina OneFit Micronizada 200g", "creatina", 27000, "/productos-img/creatinas/creatina-onefit/creatinaonefit2gr.png"),
    ("caffeine-200-star-30-capsulas", "Caffeine 200 Star 30 Capsulas", "pre-entreno", 12000, "/productos-img/pre-entrenos/prework.png"),
    ("pancakes-400g", "Pancakes 400g", "alimentos", 16000, "/productos-img/alimentos/keto-pancakes-waffles.png"),
    ("colageno-onefit-240g", "Colageno OneFit 240g", "colageno", 18000, "/productos-img/colagenos/colageno-onefit/colagenofrutilla.png"),
    ("colageno-hydroflex-xbody-330-gramos", "Colageno hydroflex Xbody 330 gramos", "colageno", 18000, "/productos-img/colagenos/colageno-xbody/colagenoxbody.png"),
    ("mutantmass-star-1-5kg", "MutantMass Star 1,5kg", "mass", 50000, "/productos-img/ganador-de-masa/mutantmass.png"),
    ("creatina-onefit-500g", "Creatina OneFit 500g", "creatina", 30000, "/productos-img/creatinas/creatina-onefit/onefit-500gr.png"),
    ("pasta-de-mani-entrenuts-370g", "Pasta de Mani Entrenuts 370g", "alimentos", 5500, "/productos-img/alimentos/mantequillas.png"),
]

DESCRIPCIONES = {
    "proteina-onefit": "Producto OneFit. Consultá el rótulo oficial del envase para composición, porción e indicaciones.",
    "creatina-star-300-gramos": "Producto Star. Consultá el rótulo oficial del envase para composición, porción e indicaciones.",
    "pre-entreno-onefit-300-gramos": "Producto OneFit. Consultá el rótulo oficial del envase para composición, porción e indicaciones.",
    "citrato-de-magnesio-star-60-capsulas": "Producto Star. Consultá el rótulo oficial del envase para composición, porción e indicaciones.",
    "proteina-star": "Producto Star. Consultá el rótulo oficial del envase para composición, porción e indicaciones.",
    "omega-3-onefit-30-capsulas": "Producto OneFit. Consultá el rótulo oficial del envase para composición, porción e indicaciones.",
    "creatina-onefit-micronizada-200g": "Producto OneFit. Consultá el rótulo oficial del envase para composición, porción e indicaciones.",
    "caffeine-200-star-30-capsulas": "Producto Star. Consultá el rótulo oficial del envase para composición, porción e indicaciones.",
    "pancakes-400g": "Producto alimenticio. Consultá el rótulo oficial del envase para ingredientes e información nutricional.",
    "colageno-onefit-240g": "Producto OneFit. Consultá el rótulo oficial del envase para composición, porción e indicaciones.",
    "colageno-hydroflex-xbody-330-gramos": "Producto Xbody. Consultá el rótulo oficial del envase para composición, porción e indicaciones.",
    "mutantmass-star-1-5kg": "Producto Star. Consultá el rótulo oficial del envase para composición, porción e indicaciones.",
    "creatina-onefit-500g": "Producto OneFit. Consultá el rótulo oficial del envase para composición, porción e indicaciones.",
    "pasta-de-mani-entrenuts-370g": "Producto alimenticio. Consultá el rótulo oficial del envase para ingredientes e información nutricional.",
}

SABORES = {
    "proteina-onefit": ["Dulce de Leche", "Vainilla", "Frutilla", "Lemon pie", "Chocolate", "Banana Cream"],
    "creatina-star-300-gramos": ["Sin sabor", "Frutos Rojos"],
    "pre-entreno-onefit-300-gramos": ["Uva"],
    "citrato-de-magnesio-star-60-capsulas": ["Sin sabor"],
    "proteina-star": ["Cookie and Cream", "Frutilla"],
    "omega-3-onefit-30-capsulas": ["Sin sabor"],
    "creatina-onefit-micronizada-200g": ["Sin sabor"],
    "caffeine-200-star-30-capsulas": ["Sin sabor"],
    "pancakes-400g": ["Keto y Waffles", "Chocolate"],
    "colageno-onefit-240g": ["Frutilla"],
    "colageno-hydroflex-xbody-330-gramos": ["Frutilla"],
    "mutantmass-star-1-5kg": ["Cookies and Cream", "Vainilla", "Frutilla", "Chocolate", "Banana Cream"],
    "creatina-onefit-500g": ["Sin sabor"],
    "pasta-de-mani-entrenuts-370g": ["Caramelo Salado", "Cookies & Cream"],
}

COMBOS = [
    ("combo-proteina-onefit-creatina-star", "Combo Proteína OneFit + Creatina Star", "Proteína OneFit 907g junto a Creatina Star 300g.", 64000, "/productos-img/combos/proteina-onefit-creatina-star.jpg", ["proteina-onefit", "creatina-star-300-gramos"]),
    ("combo-proteina-creatina-onefit-500g", "Combo Proteína OneFit + Creatina OneFit 500g", "Proteína OneFit 907g junto a Creatina OneFit 500g.", 65000, "/productos-img/combos/proteina-onefit-creatina-500g.jpg", ["proteina-onefit", "creatina-onefit-500g"]),
    ("combo-proteina-creatina-onefit-200g", "Combo Proteína OneFit + Creatina OneFit 200g", "Proteína OneFit 907g junto a Creatina OneFit Micronizada 200g.", 50000, "/productos-img/combos/proteina-onefit-creatina-200g.jpg", ["proteina-onefit", "creatina-onefit-micronizada-200g"]),
    ("combo-fuerza-total", "Combo Fuerza Total", "Proteína OneFit, Creatina OneFit 200g y Colágeno OneFit 240g.", 66000, "/productos-img/combos/fuerza-total.jpg", ["proteina-onefit", "creatina-onefit-micronizada-200g", "colageno-onefit-240g"]),
    ("combo-proteina-star-creatina-star", "Combo Proteína Star + Creatina Star", "Proteína Star junto a Creatina Star 300g.", 99000, "/productos-img/combos/proteina-star-creatina-star.jpg", ["proteina-star", "creatina-star-300-gramos"]),
]


class Command(BaseCommand):
    help = "Carga el catálogo inicial del frontend en la base de datos Django."

    def handle(self, *args, **options):
        productos = {}
        for slug, nombre, categoria, precio, imagen in PRODUCTOS:
            valores = {
                "nombre": nombre,
                "categoria": categoria,
                "precio": precio,
                "imagen": imagen,
                "descripcion": DESCRIPCIONES[slug],
                "sabores": [{"nombre": sabor, "imagen": imagen} for sabor in SABORES[slug]],
                "activo": True,
            }
            producto, creado = Producto.objects.get_or_create(
                slug=slug,
                defaults={**valores, "stock": 0},
            )
            if not creado:
                for campo, valor in valores.items():
                    setattr(producto, campo, valor)
                producto.save()
            productos[slug] = producto

        for slug, nombre, descripcion, precio, imagen, componentes in COMBOS:
            combo, _ = Combo.objects.update_or_create(
                slug=slug,
                defaults={
                    "nombre": nombre,
                    "descripcion": descripcion,
                    "precio": precio,
                    "imagen": imagen,
                    "activo": True,
                },
            )
            combo.productos.set([productos[componente] for componente in componentes])

        self.stdout.write(self.style.SUCCESS(f"Catálogo cargado: {len(PRODUCTOS)} productos y {len(COMBOS)} combos."))
