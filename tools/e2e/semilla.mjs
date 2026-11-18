// Datos de ejemplo para las pruebas en navegador: un negocio con el administrador ya dentro, caja abierta y un menú corto.
export function semilla(ahora = Date.now()) {
  const perfil = { uid: "u-admin", nombre: "Admin Test", correo: "admin@e2e.test", roles: { admin: true }, activo: true, propietario: true };
  const turno = { id: "t1", aperturaTs: ahora - 3600000, estado: "abierto", baseEfectivo: 50000, abiertoPor: "Admin Test", abiertoPorUid: "u-admin", responsableActual: { uid: "u-admin", nombre: "Admin Test", desdeTs: ahora - 3600000 }, tramos: [{ uid: "u-admin", nombre: "Admin Test", desdeTs: ahora - 3600000 }] };
  const menu = [
    { id: "m1", name: "Limonada de Coco", cat: "Bebidas", price: 9000, cost: 3000 },
    { id: "m2", name: "Americano", cat: "Bebidas", price: 3000, cost: 800 },
    { id: "m3", name: "Sándwich", cat: "Comidas", price: 14000 },
    { id: "m4", name: "Torta de chocolate", cat: "Postres", price: 8000, cost: 2500 },
  ];
  return {
    sesion: { uid: "u-admin", email: "admin@e2e.test" },
    db: {
      perfiles: { "u-admin": perfil }, equipo: { "u-admin": perfil },
      menu, config: { businessName: "Café de Prueba", margenObjetivo: 65 },
      turnos: { t1: turno },
    },
  };
}
