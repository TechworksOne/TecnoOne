import React from 'react';
import { Quote } from '../../types/quote';
import { formatMoney, formatDate } from '../../lib/format';

interface QuotePrintViewProps {
  quote: Quote;
}

export default function QuotePrintView({ quote }: QuotePrintViewProps) {
  const vigenciaHasta = new Date(quote.createdAt);
  vigenciaHasta.setDate(vigenciaHasta.getDate() + quote.vigenciaDias);

  return (
    <div className="print-view">
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-view, .print-view * {
            visibility: visible;
          }
          .print-view {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .no-print {
            display: none !important;
          }
          .page-break {
            page-break-after: always;
            break-after: page;
          }
          @page {
            margin: 2cm;
            size: letter;
          }
        }

        .print-view {
          background: white;
          font-family: Arial, sans-serif;
          color: #1a1a1a;
          max-width: 21cm;
          margin: 0 auto;
          padding: 1.5cm;
        }

        .print-header {
          display: flex;
          justify-content: space-between;
          align-items: start;
          margin-bottom: 2rem;
          padding-bottom: 1rem;
          border-bottom: 3px solid #2563eb;
        }

        .print-logo {
          font-size: 1.8rem;
          font-weight: bold;
          color: #2563eb;
        }

        .print-company-info {
          text-align: right;
          font-size: 0.85rem;
          line-height: 1.4;
        }

        .print-title {
          text-align: center;
          font-size: 1.5rem;
          font-weight: bold;
          margin: 1.5rem 0;
          color: #2563eb;
        }

        .print-info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 2rem;
          margin-bottom: 2rem;
        }

        .print-info-section {
          background: #f8f9fa;
          padding: 1rem;
          border-radius: 0.5rem;
        }

        .print-info-title {
          font-weight: bold;
          font-size: 0.9rem;
          color: #2563eb;
          margin-bottom: 0.5rem;
          text-transform: uppercase;
        }

        .print-info-row {
          display: flex;
          justify-content: space-between;
          margin: 0.3rem 0;
          font-size: 0.9rem;
        }

        .print-info-label {
          font-weight: 500;
          color: #666;
        }

        .print-items-table {
          width: 100%;
          border-collapse: collapse;
          margin: 2rem 0;
        }

        .print-items-table th {
          background: #2563eb;
          color: white;
          padding: 0.75rem;
          text-align: left;
          font-size: 0.85rem;
          font-weight: 600;
        }

        .print-items-table td {
          padding: 0.75rem;
          border-bottom: 1px solid #e5e7eb;
          font-size: 0.9rem;
        }

        .print-items-table tbody tr:hover {
          background: #f8f9fa;
        }

        .print-source-badge {
          display: inline-block;
          padding: 0.15rem 0.5rem;
          border-radius: 0.25rem;
          font-size: 0.75rem;
          font-weight: 600;
        }

        .badge-producto {
          background: #dbeafe;
          color: #1e40af;
        }

        .badge-repuesto {
          background: #fce7f3;
          color: #be185d;
        }

        .print-totals {
          margin-left: auto;
          width: 300px;
          margin-top: 1rem;
        }

        .print-total-row {
          display: flex;
          justify-content: space-between;
          padding: 0.5rem 0;
          font-size: 0.95rem;
        }

        .print-total-row.final {
          border-top: 2px solid #2563eb;
          padding-top: 1rem;
          margin-top: 0.5rem;
          font-size: 1.2rem;
          font-weight: bold;
          color: #2563eb;
        }

        .print-observaciones {
          margin: 2rem 0;
          padding: 1rem;
          background: #fffbeb;
          border-left: 4px solid #f59e0b;
          border-radius: 0.5rem;
        }

        .print-footer {
          margin-top: 3rem;
          padding-top: 1rem;
          border-top: 1px solid #e5e7eb;
          text-align: center;
          font-size: 0.85rem;
          color: #666;
        }

        /* Contrato */
        .contract-page {
          margin-top: 2rem;
        }

        .contract-title {
          text-align: center;
          font-size: 1.3rem;
          font-weight: bold;
          margin-bottom: 1.5rem;
          color: #1f2937;
          text-transform: uppercase;
        }

        .contract-section {
          margin-bottom: 1.5rem;
        }

        .contract-section-title {
          font-weight: bold;
          color: #2563eb;
          margin-bottom: 0.75rem;
          font-size: 1rem;
        }

        .contract-text {
          line-height: 1.8;
          font-size: 0.9rem;
          text-align: justify;
        }

        .contract-list {
          margin-left: 1.5rem;
          margin-top: 0.5rem;
        }

        .contract-list li {
          margin: 0.5rem 0;
          line-height: 1.6;
          font-size: 0.9rem;
        }

        .contract-costs {
          margin: 2rem 0;
          border: 2px solid #2563eb;
          padding: 1rem;
          border-radius: 0.5rem;
        }

        .contract-cost-row {
          display: flex;
          justify-content: space-between;
          padding: 0.5rem 0;
          border-bottom: 1px dashed #d1d5db;
        }

        .contract-cost-row:last-child {
          border-bottom: none;
          font-weight: bold;
          font-size: 1.1rem;
          color: #2563eb;
        }

        .contract-signatures {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 3rem;
          margin-top: 3rem;
        }

        .signature-box {
          text-align: center;
        }

        .signature-line {
          border-top: 2px solid #1f2937;
          padding-top: 0.5rem;
          margin-top: 3rem;
          font-weight: 600;
        }

        .signature-label {
          font-size: 0.85rem;
          color: #666;
          margin-top: 0.25rem;
        }
      `}</style>

      {/* Página 1: Cotización */}
      <div>
        {/* Header */}
        <div className="print-header">
          <div>
            <div className="print-logo">EMPRENDE360</div>
            <div className="text-sm text-gray-600 mt-1">Tecnocell - Soluciones Tecnológicas</div>
          </div>
          <div className="print-company-info">
            <div className="font-semibold">TECNOCELL by EMPRENDE360</div>
            <div>Ciudad de Guatemala</div>
            <div>Tel: (502) 2222-3333</div>
            <div>info@emprende360.com</div>
            <div className="mt-2 font-bold text-lg">NIT: 12345678-9</div>
          </div>
        </div>

        {/* Título */}
        <div className="print-title">
          COTIZACIÓN {quote.numero}
        </div>

        {/* Info Grid */}
        <div className="print-info-grid">
          {/* Datos del Cliente */}
          <div className="print-info-section">
            <div className="print-info-title">Datos del Cliente</div>
            <div className="print-info-row">
              <span className="print-info-label">Nombre:</span>
              <span className="font-semibold">{quote.cliente.name}</span>
            </div>
            <div className="print-info-row">
              <span className="print-info-label">Teléfono:</span>
              <span>{quote.cliente.phone}</span>
            </div>
            {quote.cliente.email && (
              <div className="print-info-row">
                <span className="print-info-label">Email:</span>
                <span>{quote.cliente.email}</span>
              </div>
            )}
            {quote.cliente.nit && (
              <div className="print-info-row">
                <span className="print-info-label">NIT:</span>
                <span>{quote.cliente.nit}</span>
              </div>
            )}
          </div>

          {/* Datos de la Cotización */}
          <div className="print-info-section">
            <div className="print-info-title">Datos de la Cotización</div>
            <div className="print-info-row">
              <span className="print-info-label">Fecha:</span>
              <span>{formatDate(quote.createdAt)}</span>
            </div>
            <div className="print-info-row">
              <span className="print-info-label">Válida hasta:</span>
              <span>{formatDate(vigenciaHasta)}</span>
            </div>
            <div className="print-info-row">
              <span className="print-info-label">Tipo:</span>
              <span className="font-semibold">{quote.tipo}</span>
            </div>
            <div className="print-info-row">
              <span className="print-info-label">Estado:</span>
              <span className="font-semibold">{quote.estado}</span>
            </div>
          </div>
        </div>

        {/* Tabla de Items */}
        <table className="print-items-table">
          <thead>
            <tr>
              <th style={{ width: '8%' }}>Cant.</th>
              <th style={{ width: '45%' }}>Descripción</th>
              <th style={{ width: '15%' }}>Origen</th>
              <th style={{ width: '16%' }}>Precio Unit.</th>
              <th style={{ width: '16%' }}>Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {quote.items.map((item, index) => (
              <tr key={index}>
                <td className="text-center font-semibold">{item.cantidad}</td>
                <td>
                  <div className="font-medium">{item.nombre}</div>
                  {item.notas && (
                    <div className="text-xs text-gray-600 mt-1">{item.notas}</div>
                  )}
                </td>
                <td>
                  <span className={`print-source-badge ${item.source === 'PRODUCTO' ? 'badge-producto' : 'badge-repuesto'}`}>
                    {item.source}
                  </span>
                </td>
                <td className="text-right">{formatMoney(item.precioUnit)}</td>
                <td className="text-right font-semibold">{formatMoney(item.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totales */}
        <div className="print-totals">
          <div className="print-total-row">
            <span>Subtotal:</span>
            <span className="font-semibold">{formatMoney(quote.subtotal)}</span>
          </div>
          
          {quote.manoDeObra && quote.manoDeObra > 0 && (
            <div className="print-total-row">
              <span>Mano de Obra:</span>
              <span className="font-semibold">{formatMoney(quote.manoDeObra)}</span>
            </div>
          )}
          
          {quote.impuestos && quote.impuestos > 0 && (
            <div className="print-total-row">
              <span>Impuestos (12%):</span>
              <span className="font-semibold">{formatMoney(quote.impuestos)}</span>
            </div>
          )}
          
          <div className="print-total-row final">
            <span>TOTAL:</span>
            <span>{formatMoney(quote.total)}</span>
          </div>
        </div>

        {/* Observaciones */}
        {quote.observaciones && (
          <div className="print-observaciones">
            <div className="font-bold mb-2">Observaciones:</div>
            <div>{quote.observaciones}</div>
          </div>
        )}

        {/* Footer */}
        <div className="print-footer">
          <p className="mb-2">¡Gracias por su preferencia!</p>
          <p className="text-xs">Esta cotización es válida por {quote.vigenciaDias} días desde su emisión.</p>
          <p className="text-xs mt-1">Los precios están sujetos a cambios sin previo aviso.</p>
        </div>
      </div>

      {/* Página 2: Contrato (solo para REPARACION) */}
      {quote.tipo === 'REPARACION' && (
        <div className="page-break contract-page">
          <div className="print-header">
            <div>
              <div className="print-logo">EMPRENDE360</div>
              <div className="text-sm text-gray-600 mt-1">Tecnocell - Soluciones Tecnológicas</div>
            </div>
            <div className="print-company-info">
              <div className="font-semibold">Cotización: {quote.numero}</div>
              <div>Fecha: {formatDate(quote.createdAt)}</div>
            </div>
          </div>

          <div className="contract-title">
            Contrato de Servicio de Reparación
          </div>

          <div className="contract-section">
            <div className="contract-section-title">1. Objeto del Contrato</div>
            <div className="contract-text">
              Por medio del presente documento, el TALLER (TECNOCELL by EMPRENDE360) se compromete a realizar 
              los servicios de reparación detallados en la cotización {quote.numero} al equipo propiedad del 
              CLIENTE ({quote.cliente.name}), bajo los términos y condiciones establecidos a continuación.
            </div>
          </div>

          <div className="contract-section">
            <div className="contract-section-title">2. Garantía</div>
            <div className="contract-text">
              El TALLER ofrece garantía de <strong>5 (cinco) meses</strong> para los siguientes servicios:
            </div>
            <ul className="contract-list">
              <li>Cambio de pantalla (display)</li>
              <li>Cambio de batería</li>
              <li>Cambio de pin de carga (conector)</li>
              <li>Reparaciones de placa base relacionadas con la falla original diagnosticada</li>
            </ul>
          </div>

          <div className="contract-section">
            <div className="contract-section-title">3. Exclusiones de Garantía</div>
            <div className="contract-text">
              Quedan expresamente excluidos de la garantía los siguientes casos:
            </div>
            <ul className="contract-list">
              <li>Daños causados por humedad, líquidos o corrosión</li>
              <li>Daños físicos externos como golpes, caídas o fisuras</li>
              <li>Manipulación del equipo por terceros no autorizados</li>
              <li>Uso indebido o negligencia por parte del cliente</li>
              <li>Fallas en componentes no incluidos en el servicio original</li>
            </ul>
          </div>

          <div className="contract-section">
            <div className="contract-section-title">4. Compromiso del Cliente</div>
            <div className="contract-text">
              El CLIENTE se compromete a:
            </div>
            <ul className="contract-list">
              <li>Recoger su equipo en un plazo máximo de <strong>30 días calendario</strong> tras la 
                  notificación de reparación completada</li>
              <li>Realizar el pago del saldo pendiente al momento de retirar el equipo</li>
              <li>Presentar este documento y un documento de identificación válido para retirar el equipo</li>
            </ul>
          </div>

          <div className="contract-section">
            <div className="contract-section-title">5. Servicios Adicionales</div>
            <div className="contract-text">
              Cualquier servicio adicional no contemplado en esta cotización deberá ser acordado por escrito 
              entre ambas partes, con su respectiva cotización y aceptación.
            </div>
          </div>

          <div className="contract-costs">
            <div className="text-center font-bold text-lg mb-3">Resumen de Costos</div>
            <div className="contract-cost-row">
              <span>Costo Total de Reparación:</span>
              <span className="font-bold">{formatMoney(quote.total)}</span>
            </div>
            <div className="contract-cost-row">
              <span>Anticipo Recibido:</span>
              <span>_________________________</span>
            </div>
            <div className="contract-cost-row">
              <span>Saldo Pendiente:</span>
              <span>_________________________</span>
            </div>
          </div>

          <div className="contract-section">
            <div className="contract-text text-center text-sm">
              El CLIENTE declara haber leído y estar de acuerdo con todos los términos y condiciones 
              establecidos en el presente contrato.
            </div>
          </div>

          <div className="contract-signatures">
            <div className="signature-box">
              <div className="signature-line">
                Firma del Taller
              </div>
              <div className="signature-label">TECNOCELL by EMPRENDE360</div>
              <div className="signature-label text-xs mt-2">Nombre y Sello</div>
            </div>
            <div className="signature-box">
              <div className="signature-line">
                Firma del Cliente
              </div>
              <div className="signature-label">{quote.cliente.name}</div>
              <div className="signature-label text-xs mt-2">DPI: _______________________</div>
            </div>
          </div>

          <div className="print-footer mt-8">
            <p className="text-xs">Ciudad de Guatemala, {formatDate(new Date())}</p>
          </div>
        </div>
      )}
    </div>
  );
}
