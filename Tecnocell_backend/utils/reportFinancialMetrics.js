'use strict';

function calculateProfit({ totalIngresos = 0, costoTotal = 0, egresosTotal = 0 }) {
  const gananciaBruta = totalIngresos - costoTotal;
  return {
    gananciaBruta,
    perdidasTotal: egresosTotal,
    gananciaNeta: gananciaBruta - egresosTotal,
  };
}

module.exports = { calculateProfit };
