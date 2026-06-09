import { toBackendEstado } from "../utils/estadoReparacion";
// Servicio para gestionar reparaciones con imágenes
import axios from 'axios';
import type { Repair, RepairFormData, RepairStatus, StateChangeRequest } from '../types/repair';
import API_URL from './config';

// ─── Axios instance con token de autenticación ───────────────────────────────
const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use(
  (config) => {
    // authService guarda en sessionStorage; también busca en localStorage por compatibilidad
    const token = sessionStorage.getItem('token') || localStorage.getItem('token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // Debug: URL, método, presencia de token (NO imprime el token completo)
    console.debug(
      `[repairService] ${(config.method ?? 'GET').toUpperCase()} ${config.baseURL ?? ''}${config.url ?? ''}`,
      { hasToken: !!token }
    );
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      console.error(
        `[repairService] Error HTTP ${error.response.status}:`,
        error.response.data
      );
    }
    return Promise.reject(error);
  }
);

// Helper: Convertir FormData para enviar
const createFormData = (data: any, files?: File[]): FormData => {
  const formData = new FormData();
  
  // Agregar archivos si existen
  if (files && files.length > 0) {
    files.forEach(file => {
      formData.append('fotos', file);
    });
  }
  
  // Agregar datos como JSON o campos individuales
  Object.keys(data).forEach(key => {
    const value = data[key];
    if (value !== undefined && value !== null) {
      if (typeof value === 'object' && !Array.isArray(value)) {
        formData.append(key, JSON.stringify(value));
      } else if (Array.isArray(value)) {
        formData.append(key, JSON.stringify(value));
      } else {
        formData.append(key, String(value));
      }
    }
  });
  
  return formData;
};

// ========== CREAR REPARACIÓN ==========
export const createReparacion = async (repairData: RepairFormData, fotosRecepcion?: File[]): Promise<{ id: string; total: number }> => {
  try {
    // Primero subir fotos de recepción si las hay
    let fotosRecepcionUrls: any[] = [];
    
    if (fotosRecepcion && fotosRecepcion.length > 0) {
      const uploadFormData = new FormData();
      fotosRecepcion.forEach(file => {
        uploadFormData.append('fotos', file);
      });
      uploadFormData.append('repairId', `REP${Date.now()}`);
      uploadFormData.append('imageTipo', 'recepcion');
      
      // No establecer Content-Type manualmente: axios/browser lo genera con el boundary correcto
      const uploadResponse = await api.post('/reparaciones/upload', uploadFormData);
      fotosRecepcionUrls = uploadResponse.data.data;
    }
    
    // Preparar datos de reparación
    const payload = {
      clienteNombre: repairData.clienteNombre,
      clienteTelefono: repairData.clienteTelefono,
      clienteEmail: repairData.clienteEmail,
      clienteId: repairData.cliente?.id,
      
      // Equipo
      tipoEquipo: repairData.recepcion.tipoEquipo,
      marca: repairData.recepcion.marca,
      modelo: repairData.recepcion.modelo,
      color: repairData.recepcion.color,
      imeiSerie: repairData.recepcion.imeiSerie,
      patronContrasena: repairData.recepcion.patronContraseña,
      accesoTipo: repairData.recepcion.accesoTipo || 'ninguno',
      accesoValor: repairData.recepcion.accesoValor ?? null,
      estadoFisico: repairData.recepcion.estadoFisico,
      diagnosticoInicial: repairData.recepcion.diagnosticoInicial,
      
      // Estado
      estado: repairData.estado,
      prioridad: repairData.prioridad,
      
      // Anticipo
      montoAnticipo: repairData.recepcion.montoAnticipo || 0,
      metodoAnticipo: repairData.recepcion.metodoAnticipo,
      
      // Items
      items: repairData.items,
      manoDeObra: repairData.manoDeObra,
      
      // Accesorios
      accesorios: repairData.recepcion.accesoriosRecibidos,
      
      // Observaciones
      observaciones: repairData.observaciones,
      
      // Fotos de recepción
      fotosRecepcion: fotosRecepcionUrls,

      // Fecha de ingreso seleccionada por el usuario
      fechaIngreso: repairData.recepcion.fechaRecepcion,

      // Firma del cliente (base64 PNG, opcional)
      firma_cliente_base64: (repairData as any).firma_cliente_base64 || undefined,
    };
    
    const response = await api.post('/reparaciones', payload);
    return response.data.data;
  } catch (error) {
    console.error('Error al crear reparación:', error);
    throw error;
  }
};

// ========== OBTENER TODAS LAS REPARACIONES ==========
export const getAllReparaciones = async (filters?: {
  estado?: RepairStatus;
  prioridad?: string;
  search?: string;
  limit?: number;
}): Promise<Repair[]> => {
  try {
    const response = await api.get('/reparaciones', {
      params: filters
    });
    
    // Transformar datos del backend al formato frontend
    const reparaciones = response.data.data.map((rep: any) => ({
      id: rep.id,
      clienteNombre: rep.cliente_nombre,
      clienteTelefono: rep.cliente_telefono,
      clienteEmail: rep.cliente_email,
      clienteId: rep.cliente_id?.toString(),
      clienteFrecuente: false,
      recepcion: {
        tipoEquipo: rep.tipo_equipo,
        marca: rep.marca,
        modelo: rep.modelo,
        color: rep.color,
        imei: rep.imei_serie,
        contraseña: rep.patron_contrasena,
        accesoTipo: (rep.acceso_tipo as 'ninguno' | 'pin' | 'patron') || 'ninguno',
        accesoValor: rep.acceso_valor ?? null,
        diagnosticoInicial: rep.diagnostico_inicial,
        estadoFisico: rep.estado_fisico,
        accesoriosRecibidos: {
          chip: false,
          estuche: false,
          memoriaSD: false,
          cargador: false
        },
        fotosRecepcion: [],
        fechaRecepcion: rep.fecha_ingreso,
        userRecepcion: rep.created_by || 'Sistema',
        montoAnticipo: rep.monto_anticipo,
        metodoAnticipo: rep.metodo_anticipo,
        comprobanteTransferencia: ''
      },
      estado: rep.estado,
      prioridad: rep.prioridad,
      tecnicoAsignado: rep.tecnico_asignado,
      subEtapa: rep.sub_etapa,
      stickerSerieInterna: rep.sticker_serie_interna,
      garantiaMeses: rep.garantia_meses || 1,
      garantiaDias: rep.garantia_dias || 30,
      items: [],
      manoDeObra: rep.mano_obra || 0,
      fotosFinales: [],
      subtotal: rep.subtotal || 0,
      impuestos: rep.impuestos || 0,
      total: rep.total || 0,
      saldoAnticipo: rep.saldo_anticipo || 0,
      montoPagadoAdicional: rep.monto_pagado_adicional || 0,
      metodoPagoAdicional: rep.metodo_pago_adicional || undefined,
      totalInvertido: rep.total_invertido || 0,
      totalGanancia: rep.total_ganancia,
      diferenciaReparacion: rep.diferencia_reparacion,
      fechaIngreso: rep.fecha_ingreso,
      fechaEstimadaEntrega: rep.fecha_estimada_entrega,
      fechaEntrega: rep.fecha_entrega,
      fechaEntregaProgramada: rep.fecha_entrega_programada ?? undefined,
      notaEntregaProgramada: rep.nota_entrega_programada ?? undefined,
      fechaCancelacion: rep.fecha_cancelacion || undefined,
      motivoCancelacion: rep.motivo_cancelacion || undefined,
      // OT – asignación técnica
      tecnicoAsignadoId: rep.tecnico_asignado_id ?? null,
      asignadoPor: rep.asignado_por ?? null,
      asignadoEn: rep.asignado_en ?? null,
      tecnicoNombre: rep.tecnico_nombre ?? null,
      tecnicoUsername: rep.tecnico_username ?? null,
      asignadoPorNombre: rep.asignado_por_nombre ?? null,
      historialEstados: [],
      totalCambiosEstado: rep.total_cambios || 0,
      createdAt: rep.created_at,
      updatedAt: rep.updated_at
    }));
    
    return reparaciones;
  } catch (error) {
    console.error('Error al obtener reparaciones:', error);
    throw error;
  }
};

// ========== OBTENER UNA REPARACIÓN ==========
export const getReparacionById = async (id: string): Promise<Repair> => {
  try {
    const response = await api.get(`/reparaciones/${id}`);
    return response.data.data;
  } catch (error) {
    console.error('Error al obtener reparación:', error);
    throw error;
  }
};

// ========== CAMBIAR ESTADO CON IMÁGENES ==========
// Contrato de recepción se genera desde backend para respetar tenant, logo, firmas y formato oficial.
export const abrirContratoReparacion = async (reparacionId: string): Promise<void> => {
  try {
    const response = await api.get(`/reparaciones/${reparacionId}/contrato`, {
      responseType: 'blob',
    });

    const blob = new Blob([response.data], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.click();
    window.setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 404) {
        throw new Error('Contrato no generado aún');
      }
      if (error.response?.status === 500) {
        throw new Error('Error al obtener contrato');
      }
    }

    console.error('Error al obtener contrato:', error);
    throw new Error('Error al obtener contrato');
  }
};

export const changeRepairState = async (
  id: string,
  stateChange: StateChangeRequest,
  fotos?: File[]
): Promise<void> => {
  try {
    const formData = new FormData();
    
    // Agregar archivos
    if (fotos && fotos.length > 0) {
      fotos.forEach(file => {
        formData.append('fotos', file);
      });
    }
    
    // Agregar datos del cambio de estado
    formData.append('estado', toBackendEstado(stateChange.estado));
    if (stateChange.subEtapa) formData.append('subEtapa', stateChange.subEtapa);
    formData.append('nota', stateChange.nota);
    
    if (stateChange.piezaNecesaria) formData.append('piezaNecesaria', stateChange.piezaNecesaria);
    if (stateChange.proveedor) formData.append('proveedor', stateChange.proveedor);
    if (stateChange.costoRepuesto) formData.append('costoRepuesto', String(stateChange.costoRepuesto));
    
    if (stateChange.stickerNumero) formData.append('stickerNumero', stateChange.stickerNumero);
    if (stateChange.stickerUbicacion) formData.append('stickerUbicacion', stateChange.stickerUbicacion);
    
    if (stateChange.diferenciaReparacion !== undefined) {
      formData.append('diferenciaReparacion', String(stateChange.diferenciaReparacion));
    }
    
    // No establecer Content-Type manualmente: axios/browser lo genera con el boundary correcto
    await api.post(`/reparaciones/${id}/estado`, formData);
  } catch (error) {
    console.error('Error al cambiar estado:', error);
    throw error;
  }
};

// ========== SUBIR IMÁGENES INDIVIDUALES ==========
export const uploadImages = async (
  repairId: string,
  files: File[],
  tipo: 'recepcion' | 'historial' | 'final' | 'comprobante'
): Promise<Array<{ filename: string; url_path: string }>> => {
  try {
    const formData = new FormData();
    
    files.forEach(file => {
      formData.append('fotos', file);
    });
    
    formData.append('repairId', repairId);
    formData.append('imageTipo', tipo);
    
    // No establecer Content-Type manualmente: axios/browser lo genera con el boundary correcto
    const response = await api.post('/reparaciones/upload', formData);
    return response.data.data;
  } catch (error) {
    console.error('Error al subir imágenes:', error);
    throw error;
  }
};

// ========== OBTENER URL COMPLETA DE IMAGEN ==========
export const getImageUrl = (urlPath: string): string => {
  // En desarrollo: http://localhost:3000/uploads/...
  // En producción Docker: /uploads/... (Nginx proxea al backend)
  const baseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/api$/, '');
  
  // Si urlPath ya es una URL completa, devolverla tal cual
  if (urlPath.startsWith('http://') || urlPath.startsWith('https://')) {
    return urlPath;
  }
  
  // Construir URL completa
  return `${baseUrl}${urlPath}`;
};

// ========== ACTUALIZAR PRIORIDAD ==========
export const updatePrioridad = async (id: string, prioridad: 'BAJA' | 'MEDIA' | 'ALTA'): Promise<void> => {
  try {
    await api.patch(`/reparaciones/${id}/prioridad`, { prioridad });
  } catch (error) {
    console.error('Error al actualizar prioridad:', error);
    throw error;
  }
};

// ========== REGISTRAR PAGO SALDO PENDIENTE ==========
export const registrarPagoSaldo = async (
  id: string,
  monto: number,
  metodoPago: 'efectivo' | 'tarjeta'
): Promise<{ totalPagado: number; saldoRestante: number }> => {
  try {
    const response = await api.post(`/reparaciones/${id}/pago`, { monto, metodoPago });
    return response.data.data;
  } catch (error) {
    console.error('Error al registrar pago de saldo:', error);
    throw error;
  }
};

// ========== CANCELAR REPARACIÓN ==========
export interface CancelarReparacionPayload {
  motivo_cancelacion: string;
  devolver_dinero: boolean;
  devolucion_monto: number;
  monto_retenido: number;
  motivo_retencion: string | null;
}

export const cancelarReparacion = async (
  id: string,
  payload: CancelarReparacionPayload
): Promise<void> => {
  try {
    await api.patch(`/reparaciones/${id}/cancelar`, payload);
  } catch (error) {
    console.error('Error al cancelar reparación:', error);
    throw error;
  }
};

const repairService = {
  createReparacion,
  getAllReparaciones,
  getReparacionById,
  changeRepairState,
  uploadImages,
  getImageUrl,
  abrirContratoReparacion,
  updatePrioridad,
  registrarPagoSaldo,
  cancelarReparacion,
};

export default repairService;
