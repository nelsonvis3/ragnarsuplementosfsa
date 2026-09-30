export default function PrivacidadPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-12 sm:py-16">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ember">Ragnar Suplementos</p>
      <h1 className="mt-3 font-display text-3xl font-bold">Política de privacidad</h1>
      <p className="mt-2 text-sm text-bone-dim">Última actualización: 29 de septiembre de 2026.</p>

      <section className="mt-8 space-y-5 text-sm leading-6 text-bone-dim">
        <div><h2 className="font-semibold text-bone">Responsable</h2><p>Gabriel Sivisstum, titular de Ragnar Suplementos. Para consultas sobre tus datos: adansiv16@gmail.com o WhatsApp al +54 9 3704 69-6533.</p></div>
        <div><h2 className="font-semibold text-bone">Datos que recopilamos</h2><p>Nombre, email y teléfono al realizar una compra o enviar una solicitud de atención. Para un envío también se solicita la dirección. El sistema conserva los productos, importes y estado del pedido para gestionarlo.</p></div>
        <div><h2 className="font-semibold text-bone">Para qué los usamos</h2><p>Procesar pedidos, coordinar pagos y entregas, responder consultas y reclamos, y cumplir obligaciones aplicables. No solicitamos que crees una cuenta para comprar ni para enviar una solicitud de arrepentimiento.</p></div>
        <div><h2 className="font-semibold text-bone">Servicios que intervienen</h2><p>La cotización de direcciones puede consultar servicios de OpenStreetMap y FOSS GIS. Si un medio de pago de terceros se habilita, los datos necesarios para procesar el pago serán tratados también por ese proveedor bajo sus propias políticas.</p></div>
        <div><h2 className="font-semibold text-bone">Conservación y seguridad</h2><p>Los datos se guardan en la base de pedidos para administrar la compra y el servicio posventa, y se aplican controles de acceso al panel de gestión. No se publican datos personales de compradores.</p></div>
        <div><h2 className="font-semibold text-bone">Consultas sobre tus datos</h2><p>Podés pedir acceso, rectificación o eliminación cuando corresponda escribiendo a <a className="text-ember underline" href="mailto:adansiv16@gmail.com">adansiv16@gmail.com</a>. Para ubicar la información, indicá el email usado en la compra y el número de pedido si lo tenés.</p></div>
      </section>
    </main>
  );
}
