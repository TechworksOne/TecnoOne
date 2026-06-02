import React, { useState, useEffect, useRef, useMemo } from "react";
import Modal from "../../components/ui/Modal";
import {
  ArrowLeft, Save, Upload, X, Plus, Tag, Monitor, Smartphone,
  DollarSign, Camera, Package2, ChevronDown, Building2, Wrench, type LucideIcon
} from "lucide-react";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Select from "../../components/ui/Select";
import Card from "../../components/ui/Card";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import { useToast } from "../../components/ui/Toast";
import { useRepuestosStore } from "../../store/useRepuestosStore";
import { useSuppliersStore } from "../../store/useSuppliers";
import { RepuestoFormData, MARCAS_LINEAS } from "../../types/repuesto";
import * as repuestoService from "../../services/repuestoService";
import * as marcaLineaService from "../../services/marcaLineaService";
import type { RepuestoTipo, RepuestoMarca, RepuestoModelo } from "../../services/marcaLineaService";
import { getImageUrl } from "../../utils/getImageUrl";

// ─── Constants ──────────────────────────────────────────────────────────────
const CONDICIONES = ["Original", "OEM", "Genérico", "Usado"];
const ALLOWED_MIME = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

// ─── Image item type ─────────────────────────────────────────────────────────
interface ImageItem {
  url: string;       // blob: URL for new files, /uploads/... for existing
  file: File | null; // null for existing server images
}

function resolveImgSrc(url: string): string {
  if (!url) return "";
  if (url.startsWith("blob:") || url.startsWith("data:") || url.startsWith("http")) return url;
  return getImageUrl(url);
}

// ─── Section header sub-component ────────────────────────────────────────────
function SectionHeader({
  icon: Icon,
  title,
  iconColor = "text-[#48B9E6]",
}: {
  icon: LucideIcon;
  title: string;
  iconColor?: string;
}) {
  return (
    <div className="flex items-center gap-2.5 mb-5">
      <div className="p-2 rounded-xl bg-[rgba(72,185,230,0.10)] dark:bg-[rgba(72,185,230,0.08)] shrink-0">
        <Icon size={16} className={iconColor} />
      </div>
      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#5E7184] dark:text-[#B8C2D1]">
        {title}
      </p>
    </div>
  );
}

// ─── Field label ─────────────────────────────────────────────────────────────
function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-[11px] font-semibold uppercase tracking-widest text-[#5E7184] dark:text-[#B8C2D1] mb-1.5">
      {children}
      {required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function RepuestoForm({
  open,
  onClose,
  editId,
}: {
  open: boolean;
  onClose: () => void;
  editId?: string | null;
}) {
  const id = editId ? String(editId) : undefined;
  const toast = useToast();
  const { getRepuestoById, upsertRepuesto } = useRepuestosStore();
  const { suppliers, loadSuppliers } = useSuppliersStore();
  const hasChanges = useRef(false);

  const isEditing = Boolean(editId);

  const [formData, setFormData] = useState<RepuestoFormData>({
    nombre: "",
    tipo: "",
    marca: "",
    linea: "",
    modelo: "",
    compatibilidad: [],
    condicion: "Original",
    color: "",
    notas: "",
    precio: 0,
    precioCosto: 0,
    proveedor: "",
    stock: 0,
    stockMinimo: 1,
    imagenes: [],
    tags: [],
    activo: true,
  });

  const [imageItems, setImageItems] = useState<ImageItem[]>([]);
  const blobUrlsRef = useRef<string[]>([]);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const [newCompatible, setNewCompatible] = useState("");
  const [newTag, setNewTag] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showProveedoresDropdown, setShowProveedoresDropdown] = useState(false);

  const [marcas, setMarcas] = useState<RepuestoMarca[]>([]);
  const [modelos, setModelos] = useState<RepuestoModelo[]>([]);
  const [tipos, setTipos] = useState<RepuestoTipo[]>([]);
  const [showNewTipoDialog, setShowNewTipoDialog] = useState(false);
  const [newTipoNombre, setNewTipoNombre] = useState("");
  const [showNewMarcaDialog, setShowNewMarcaDialog] = useState(false);
  const [showNewModeloDialog, setShowNewModeloDialog] = useState(false);
  const [newMarcaNombre, setNewMarcaNombre] = useState("");
  const [newModeloNombre, setNewModeloNombre] = useState("");
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      blobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  // ── Derived: IDs for the selected tipo / marca ─────────────────────────
  const selectedTipoId = useMemo(
    () => tipos.find((t) => t.nombre === formData.tipo)?.id ?? null,
    [tipos, formData.tipo],
  );
  const selectedMarcaId = useMemo(
    () => marcas.find((m) => m.nombre === formData.marca)?.id ?? null,
    [marcas, formData.marca],
  );

  // ── Load tipos on mount ────────────────────────────────────────────────
  useEffect(() => {
    marcaLineaService.getRepuestoTipos()
      .then(setTipos)
      .catch(() => toast.add("Error al cargar tipos de repuesto", "error"));
    loadSuppliers();
  }, [toast, loadSuppliers]);

  // ── Load marcas when tipo changes ──────────────────────────────────────
  useEffect(() => {
    if (!selectedTipoId) { setMarcas([]); return; }
    marcaLineaService.getRepuestoMarcas(selectedTipoId)
      .then(setMarcas)
      .catch(() => toast.add("Error al cargar marcas", "error"));
  }, [selectedTipoId, toast]);

  // ── Load modelos when marca changes ────────────────────────────────────
  useEffect(() => {
    if (!selectedTipoId || !selectedMarcaId) { setModelos([]); return; }
    marcaLineaService.getRepuestoModelos(selectedTipoId, selectedMarcaId)
      .then(setModelos)
      .catch(() => {/* silently ignore - modelo is optional */});
  }, [selectedTipoId, selectedMarcaId]);

  useEffect(() => {
    if (!open) return;
    if (isEditing && id) {
      const repuesto = getRepuestoById(id);
      if (repuesto) {
        setFormData({
          nombre: repuesto.nombre,
          tipo: repuesto.tipo,
          marca: repuesto.marca,
          linea: repuesto.linea || "",
          modelo: repuesto.modelo || "",
          compatibilidad: repuesto.compatibilidad || [],
          condicion: repuesto.condicion,
          color: repuesto.color || "",
          notas: repuesto.notas || "",
          precio: repuesto.precio,
          precioCosto: repuesto.precioCosto,
          proveedor: repuesto.proveedor || "",
          stock: repuesto.stock,
          stockMinimo: repuesto.stockMinimo || 1,
          imagenes: repuesto.imagenes,
          tags: repuesto.tags || [],
          activo: repuesto.activo,
        });
        setImageItems((repuesto.imagenes || []).map((url) => ({ url, file: null })));
      } else {
        toast.add("Repuesto no encontrado", "error");
        onClose();
      }
    } else {
      // Nuevo repuesto: limpiar todo
      setFormData({
        nombre: "",
        tipo: "",
        marca: "",
        linea: "",
        modelo: "",
        compatibilidad: [],
        condicion: "Original",
        color: "",
        notas: "",
        precio: 0,
        precioCosto: 0,
        proveedor: "",
        stock: 0,
        stockMinimo: 1,
        imagenes: [],
        tags: [],
        activo: true,
      });
      setImageItems([]);
      hasChanges.current = false;
    }
  }, [open, id, isEditing, getRepuestoById, toast, onClose]);

  useEffect(() => {
    const checkForChanges = () => {
      if (isEditing && id) {
        const original = getRepuestoById(id);
        if (original) {
          hasChanges.current =
            formData.nombre !== original.nombre ||
            formData.precio !== original.precio ||
            formData.stock !== original.stock ||
            JSON.stringify(formData.compatibilidad) !== JSON.stringify(original.compatibilidad || []) ||
            JSON.stringify(formData.tags) !== JSON.stringify(original.tags || []);
        }
      } else {
        hasChanges.current = !!(
          formData.nombre.trim() !== "" ||
          formData.precio > 0 ||
          formData.stock > 0 ||
          (formData.compatibilidad && formData.compatibilidad.length > 0) ||
          (formData.tags && formData.tags.length > 0)
        );
      }
    };
    checkForChanges();
  }, [formData, isEditing, id, getRepuestoById]);

  const handleClose = () => {
    if (hasChanges.current) {
      setPendingNavigation("close");
      setShowUnsavedDialog(true);
    } else {
      onClose();
    }
  };

  const confirmNavigation = () => {
    setShowUnsavedDialog(false);
    setPendingNavigation(null);
    onClose();
  };

  const cancelNavigation = () => {
    setShowUnsavedDialog(false);
    setPendingNavigation(null);
  };

  const validateForm = () => {
    const errors: string[] = [];
    if (!formData.nombre.trim()) {
      errors.push("El nombre del repuesto es requerido");
    } else if (formData.nombre.trim().length < 3) {
      errors.push("El nombre debe tener al menos 3 caracteres");
    } else if (formData.nombre.trim().length > 120) {
      errors.push("El nombre no puede exceder 120 caracteres");
    }
    if (!formData.tipo) errors.push("El tipo de equipo es requerido");
    if (!formData.marca) errors.push("La marca es requerida");
    if (formData.precio < 0) errors.push("El precio público debe ser mayor o igual a cero");
    if (formData.precioCosto < 0) errors.push("El precio de costo debe ser mayor o igual a cero");
    if (formData.precio > 0 && formData.precioCosto > 0 && formData.precio <= formData.precioCosto)
      errors.push("El precio público debe ser mayor al precio de costo");
    if (formData.stock < 0) errors.push("El stock debe ser mayor o igual a cero");
    if (formData.stockMinimo && formData.stockMinimo < 0)
      errors.push("El stock mínimo debe ser mayor o igual a cero");
    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationErrors = validateForm();
    if (validationErrors.length > 0) {
      validationErrors.forEach((error) => toast.add(error, "error"));
      return;
    }
    setIsLoading(true);
    try {
      const imagenesExistentes = imageItems
        .filter((item) => item.file === null)
        .map((item) => item.url);
      const imagenesFiles = imageItems
        .filter((item) => item.file !== null)
        .map((item) => item.file as File);

      const dataToSave = {
        nombre: formData.nombre,
        tipo: formData.tipo,
        marca: formData.marca,
        linea: formData.linea || undefined,
        modelo: formData.modelo || undefined,
        compatibilidad: formData.compatibilidad || [],
        condicion: formData.condicion,
        color: formData.color || undefined,
        notas: formData.notas || undefined,
        precio_publico: repuestoService.quetzalesACentavos(formData.precio),
        precio_costo: repuestoService.quetzalesACentavos(formData.precioCosto),
        proveedor: formData.proveedor || undefined,
        stock: isEditing ? formData.stock : 0,
        stock_minimo: formData.stockMinimo || 1,
        imagenes: imagenesExistentes,
        imagenesFiles,
        tags: formData.tags || [],
        activo: formData.activo,
      };

      if (isEditing && id) {
        await repuestoService.updateRepuesto(Number(id), dataToSave);
      } else {
        await repuestoService.createRepuesto(dataToSave);
      }

      toast.add(`Repuesto ${isEditing ? "actualizado" : "creado"} exitosamente`, "success");
      hasChanges.current = false;
      onClose();
    } catch (error: any) {
      console.error("Error al guardar repuesto:", error);
      toast.add(error.response?.data?.error || "Error al guardar el repuesto", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateMarca = async () => {
    if (!newMarcaNombre.trim()) {
      toast.add("El nombre de la marca es requerido", "error");
      return;
    }
    if (!selectedTipoId) {
      toast.add("Selecciona un tipo primero", "error");
      return;
    }
    try {
      const nuevaMarca = await marcaLineaService.createRepuestoMarca({
        tipo_id: selectedTipoId,
        nombre: newMarcaNombre.trim(),
      });
      setMarcas((prev) => [...prev, nuevaMarca]);
      setFormData((prev) => ({ ...prev, marca: nuevaMarca.nombre, linea: "" }));
      setNewMarcaNombre("");
      setShowNewMarcaDialog(false);
      toast.add("Marca creada exitosamente", "success");
    } catch (error: any) {
      toast.add(error.response?.data?.error || "Error al crear marca", "error");
    }
  };

  const handleCreateModelo = async () => {
    if (!newModeloNombre.trim()) {
      toast.add("El nombre del modelo es requerido", "error");
      return;
    }
    if (!selectedTipoId) {
      toast.add("Selecciona un tipo de equipo primero", "error");
      return;
    }
    if (!selectedMarcaId) {
      toast.add("Selecciona una marca primero", "error");
      return;
    }
    try {
      const nuevoModelo = await marcaLineaService.createRepuestoModelo({
        tipo_id: selectedTipoId,
        marca_id: selectedMarcaId,
        nombre: newModeloNombre.trim(),
      });
      setModelos((prev) => [...prev, nuevoModelo]);
      setFormData((prev) => ({ ...prev, linea: nuevoModelo.nombre }));
      setNewModeloNombre("");
      setShowNewModeloDialog(false);
      toast.add("Modelo creado exitosamente", "success");
    } catch (error: any) {
      toast.add(error.response?.data?.error || "Error al crear modelo", "error");
    }
  };

  const handleCreateTipo = async () => {
    if (!newTipoNombre.trim()) {
      toast.add("El nombre del tipo es requerido", "error");
      return;
    }
    try {
      const nuevoTipo = await marcaLineaService.createRepuestoTipo({ nombre: newTipoNombre.trim() });
      setTipos((prev) => [...prev, nuevoTipo]);
      setFormData((prev) => ({ ...prev, tipo: nuevoTipo.nombre, marca: "", linea: "" }));
      setNewTipoNombre("");
      setShowNewTipoDialog(false);
      toast.add("Tipo creado exitosamente", "success");
    } catch (error: any) {
      toast.add(error.response?.data?.error || "Error al crear tipo", "error");
    }
  };

  const handleSelectProveedor = (proveedor: any) => {
    setFormData((prev) => ({ ...prev, proveedor: proveedor.nombre }));
    setShowProveedoresDropdown(false);
  };

  const handleAddCompatible = () => {
    if (newCompatible.trim() && !formData.compatibilidad?.includes(newCompatible.trim())) {
      setFormData((prev) => ({
        ...prev,
        compatibilidad: [...(prev.compatibilidad || []), newCompatible.trim()],
      }));
      setNewCompatible("");
    }
  };

  const handleRemoveCompatible = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      compatibilidad: prev.compatibilidad?.filter((_, i) => i !== index) || [],
    }));
  };

  const handleAddTag = () => {
    if (newTag.trim() && !formData.tags?.includes(newTag.trim())) {
      setFormData((prev) => ({ ...prev, tags: [...(prev.tags || []), newTag.trim()] }));
      setNewTag("");
    }
  };

  const handleRemoveTag = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags?.filter((_, i) => i !== index) || [],
    }));
  };

  // ─── Image helpers ────────────────────────────────────────────────────────
  const addImageFiles = (files: File[]) => {
    const valid = files.filter((f) => ALLOWED_MIME.includes(f.type));
    if (files.length > 0 && valid.length === 0) {
      toast.add("Solo se permiten imágenes JPG, PNG o WEBP", "error");
      return;
    }
    const remaining = 10 - imageItems.length;
    if (remaining <= 0) {
      toast.add("Máximo 10 imágenes por repuesto", "error");
      return;
    }
    const toAdd = valid.slice(0, remaining);
    const newItems: ImageItem[] = toAdd.map((file) => {
      const url = URL.createObjectURL(file);
      blobUrlsRef.current.push(url);
      return { url, file };
    });
    setImageItems((prev) => [...prev, ...newItems]);
  };

  const handleRemoveImage = (index: number) => {
    const item = imageItems[index];
    if (item.url.startsWith("blob:")) {
      URL.revokeObjectURL(item.url);
      blobUrlsRef.current = blobUrlsRef.current.filter((u) => u !== item.url);
    }
    setImageItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRemoveAllImages = () => {
    imageItems.forEach((item) => {
      if (item.url.startsWith("blob:")) {
        URL.revokeObjectURL(item.url);
        blobUrlsRef.current = blobUrlsRef.current.filter((u) => u !== item.url);
      }
    });
    setImageItems([]);
  };

  const reorderImages = (fromIndex: number, toIndex: number) => {
    setImageItems((prev) => {
      const arr = [...prev];
      const [removed] = arr.splice(fromIndex, 1);
      arr.splice(toIndex, 0, removed);
      return arr;
    });
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    addImageFiles(Array.from(e.dataTransfer.files));
  };
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) addImageFiles(Array.from(e.target.files));
    e.target.value = "";
  };

  // Margin helper
  const margin = formData.precio - formData.precioCosto;
  const marginPct =
    formData.precioCosto > 0 ? ((margin / formData.precioCosto) * 100).toFixed(1) : null;
  const marginNegative = formData.precio > 0 && formData.precioCosto > 0 && margin <= 0;

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={isEditing ? "Editar Repuesto" : "Nuevo Repuesto"}
      size="5xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6">

          {/* ── SKU preview (only when creating) ──────────────────────── */}
          {!isEditing && formData.tipo && formData.marca && (
            <div className="bg-cyan-50 dark:bg-cyan-950/30 border border-cyan-200 dark:border-cyan-800/40 rounded-2xl px-4 py-3 flex items-start gap-2.5">
              <Wrench size={13} className="text-[#48B9E6] shrink-0 mt-0.5" />
              <div>
                <p className="text-[11px] text-cyan-700 dark:text-cyan-200 font-semibold mb-0.5">
                  SKU automático
                </p>
                <code className="text-[11px] font-mono text-[#48B9E6]">
                  {formData.tipo.substring(0, 3).toUpperCase()}_
                  {formData.marca.substring(0, 4).toUpperCase()}_
                  {formData.linea
                    ? formData.linea.substring(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, "")
                    : "GEN"}
                  _######
                </code>
                <p className="text-[10px] text-[#5E7184] dark:text-[#B8C2D1] mt-0.5">
                  Se genera automáticamente al guardar
                </p>
              </div>
            </div>
          )}

          {/* ═══ Sección 1: Tipo de equipo ═══════════════════════════════ */}
          <Card className="p-5 rounded-2xl">
            <SectionHeader icon={Smartphone} title="Tipo de equipo" />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

              {/* ── Tipo de equipo ── */}
              <div>
                <FieldLabel required>Tipo de equipo</FieldLabel>
                <div className="flex gap-2">
                  <Select
                    value={formData.tipo}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                      setFormData((prev) => ({
                        ...prev,
                        tipo: e.target.value,
                        marca: "",
                        linea: "",
                      }))
                    }
                    className="flex-1 rounded-2xl text-sm"
                    required
                  >
                    <option value="">Seleccionar...</option>
                    {tipos.map((t) => (
                      <option key={t.id} value={t.nombre}>
                        {t.nombre}
                      </option>
                    ))}
                  </Select>
                  <button
                    type="button"
                    onClick={() => setShowNewTipoDialog(true)}
                    className="shrink-0 w-9 h-9 flex items-center justify-center rounded-xl border border-[var(--color-border)] hover:border-[#48B9E6] hover:bg-[rgba(72,185,230,0.06)] text-[#5E7184] dark:text-[#B8C2D1] transition-colors"
                    title="Agregar nuevo tipo de equipo"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>

              {/* ── Marca ── */}
              <div>
                <FieldLabel required>Marca</FieldLabel>
                <div className="flex gap-2">
                  <Select
                    value={formData.marca}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                      setFormData((prev) => ({
                        ...prev,
                        marca: e.target.value,
                        linea: "",
                      }))
                    }
                    className="flex-1 rounded-2xl text-sm"
                    disabled={!selectedTipoId}
                    required
                  >
                    <option value="">Seleccionar...</option>
                    {marcas.map((m) => (
                      <option key={m.id} value={m.nombre}>
                        {m.nombre}
                      </option>
                    ))}
                  </Select>
                  <button
                    type="button"
                    onClick={() => setShowNewMarcaDialog(true)}
                    disabled={!selectedTipoId}
                    className="shrink-0 w-9 h-9 flex items-center justify-center rounded-xl border border-[var(--color-border)] hover:border-[#48B9E6] hover:bg-[rgba(72,185,230,0.06)] text-[#5E7184] dark:text-[#B8C2D1] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Agregar nueva marca"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>

              {/* ── Modelo ── */}
              <div>
                <FieldLabel>Modelo</FieldLabel>
                <div className="flex gap-2">
                  {modelos.length > 0 ? (
                    <Select
                      value={formData.linea}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                        setFormData((prev) => ({ ...prev, linea: e.target.value }))
                      }
                      className="flex-1 rounded-2xl text-sm"
                      disabled={!selectedMarcaId}
                    >
                      <option value="">Seleccionar...</option>
                      {modelos.map((m) => (
                        <option key={m.id} value={m.nombre}>
                          {m.nombre}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <Input
                      type="text"
                      value={formData.linea}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setFormData((prev) => ({ ...prev, linea: e.target.value }))
                      }
                      placeholder="iPhone 13, Galaxy A52..."
                      className="flex-1 rounded-2xl"
                      disabled={!selectedMarcaId}
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => setShowNewModeloDialog(true)}
                    disabled={!selectedMarcaId}
                    className="shrink-0 w-9 h-9 flex items-center justify-center rounded-xl border border-[var(--color-border)] hover:border-[#48B9E6] hover:bg-[rgba(72,185,230,0.06)] text-[#5E7184] dark:text-[#B8C2D1] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Agregar nuevo modelo"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>
            </div>
          </Card>

          {/* ═══ Sección 2: Información del repuesto ═════════════════════ */}
          <Card className="p-5 rounded-2xl">
            <SectionHeader icon={Monitor} title="Información del repuesto" />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Nombre */}
              <div className="sm:col-span-2">
                <FieldLabel required>Nombre del repuesto</FieldLabel>
                <Input
                  type="text"
                  value={formData.nombre}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setFormData((prev) => ({ ...prev, nombre: e.target.value }))
                  }
                  placeholder="Pantalla, Batería, Teclado, Flex, Puerto de carga..."
                  className="w-full rounded-2xl"
                  required
                />
              </div>

              {/* Descripción */}
              <div className="sm:col-span-2">
                <FieldLabel>Descripción</FieldLabel>
                <textarea
                  value={formData.notas}
                  onChange={(e) => setFormData((prev) => ({ ...prev, notas: e.target.value }))}
                  placeholder="Descripción o notas adicionales del repuesto..."
                  rows={3}
                  className="w-full p-3 text-sm rounded-2xl border border-[var(--color-border)] bg-[var(--color-input-bg)] text-[#14324A] dark:text-[#F8FAFC] placeholder:text-[#7F8A99] focus:outline-none focus:border-[#48B9E6] transition-colors resize-none"
                />
              </div>

              {/* Condición */}
              <div>
                <FieldLabel required>Condición</FieldLabel>
                <Select
                  value={formData.condicion}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                    setFormData((prev) => ({
                      ...prev,
                      condicion: e.target.value as RepuestoFormData["condicion"],
                    }))
                  }
                  className="w-full rounded-2xl text-sm"
                  required
                >
                  {CONDICIONES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </div>

              {/* Color */}
              <div>
                <FieldLabel>Color</FieldLabel>
                <Input
                  type="text"
                  value={formData.color}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setFormData((prev) => ({ ...prev, color: e.target.value }))
                  }
                  placeholder="Negro, Blanco..."
                  className="w-full rounded-2xl"
                />
              </div>

              {/* Activo */}
              <div className="flex items-center gap-2.5 pt-5">
                <input
                  type="checkbox"
                  id="activoCheck"
                  checked={formData.activo}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, activo: e.target.checked }))
                  }
                  className="w-4 h-4 accent-[#48B9E6] rounded"
                />
                <label
                  htmlFor="activoCheck"
                  className="text-xs font-medium text-[#5E7184] dark:text-[#B8C2D1] cursor-pointer"
                >
                  Repuesto activo
                </label>
              </div>
            </div>
          </Card>

          {/* ═══ Sección 3: Inventario y precios ═════════════════════════ */}
          <Card className="p-5 rounded-2xl">
            <SectionHeader icon={DollarSign} title="Inventario y precios" />

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Precio costo */}
              <div>
                <FieldLabel required>Precio costo (Q)</FieldLabel>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#7F8A99]">Q</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.precioCosto}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setFormData((prev) => ({ ...prev, precioCosto: Number(e.target.value) }))
                    }
                    className="pl-7 w-full rounded-2xl"
                    placeholder="0.00"
                    required
                  />
                </div>
                <p className="text-[10px] text-[#7F8A99] dark:text-[#7F8A99] mt-1">
                  Precio de adquisición
                </p>
              </div>

              {/* Precio venta */}
              <div>
                <FieldLabel required>Precio venta (Q)</FieldLabel>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#7F8A99]">Q</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.precio}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setFormData((prev) => ({ ...prev, precio: Number(e.target.value) }))
                    }
                    className="pl-7 w-full rounded-2xl"
                    placeholder="0.00"
                    required
                  />
                </div>
                <p className="text-[10px] text-[#7F8A99] dark:text-[#7F8A99] mt-1">
                  Precio al cliente
                </p>
              </div>

              {/* Stock mínimo */}
              <div>
                <FieldLabel>Stock mínimo</FieldLabel>
                <Input
                  type="number"
                  min="0"
                  value={formData.stockMinimo}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setFormData((prev) => ({ ...prev, stockMinimo: Number(e.target.value) }))
                  }
                  className="w-full rounded-2xl"
                  placeholder="1"
                />
                <p className="text-[10px] text-[#7F8A99] dark:text-[#7F8A99] mt-1">
                  Alerta de stock bajo
                </p>
              </div>

              {/* Stock actual (solo en edición) */}
              {isEditing && (
                <div>
                  <FieldLabel>Stock actual</FieldLabel>
                  <Input
                    type="number"
                    min="0"
                    value={formData.stock}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setFormData((prev) => ({ ...prev, stock: Number(e.target.value) }))
                    }
                    className="w-full rounded-2xl"
                    placeholder="0"
                  />
                  <p className="text-[10px] text-[#7F8A99] dark:text-[#7F8A99] mt-1">
                    Unidades disponibles
                  </p>
                </div>
              )}
            </div>

            {/* Margin indicator */}
            {formData.precioCosto > 0 && formData.precio > 0 && (
              <div
                className={`mt-4 rounded-2xl px-4 py-2.5 flex items-center justify-between ${
                  marginNegative
                    ? "bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40"
                    : "bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40"
                }`}
              >
                <span
                  className={`text-[11px] font-medium ${
                    marginNegative
                      ? "text-red-600 dark:text-red-400"
                      : "text-emerald-600 dark:text-emerald-400"
                  }`}
                >
                  {marginNegative ? "⚠ Precio venta ≤ costo" : "Margen de ganancia"}
                </span>
                <span
                  className={`text-sm font-bold ${
                    marginNegative
                      ? "text-red-700 dark:text-red-300"
                      : "text-emerald-700 dark:text-emerald-300"
                  }`}
                >
                  Q{margin.toFixed(2)}
                  {!marginNegative && marginPct && (
                    <span className="text-[11px] font-normal ml-1">({marginPct}%)</span>
                  )}
                </span>
              </div>
            )}

            {/* Proveedor */}
            <div className="mt-5">
              <FieldLabel>
                <Building2 size={11} className="inline mr-1" />
                Proveedor
              </FieldLabel>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowProveedoresDropdown((p) => !p)}
                  className="w-full h-10 text-left text-sm px-4 border border-[var(--color-border)] hover:border-[#48B9E6] rounded-2xl flex items-center justify-between transition-colors bg-[var(--color-input-bg)] text-[#14324A] dark:text-[#F8FAFC]"
                >
                  <span className={formData.proveedor ? "" : "text-[#7F8A99]"}>
                    {formData.proveedor || "Seleccionar proveedor..."}
                  </span>
                  <ChevronDown size={16} className="text-[#7F8A99] shrink-0" />
                </button>

                {showProveedoresDropdown && (
                  <div className="absolute z-20 w-full mt-1 max-h-56 overflow-y-auto border border-[var(--color-border)] rounded-2xl bg-[var(--color-surface)] shadow-xl">
                    {suppliers.filter((s) => s.activo).length === 0 ? (
                      <div className="p-4 text-center text-xs text-[#5E7184] dark:text-[#B8C2D1]">
                        No hay proveedores registrados
                      </div>
                    ) : (
                      suppliers
                        .filter((s) => s.activo)
                        .map((proveedor) => (
                          <div
                            key={proveedor.id}
                            onClick={() => handleSelectProveedor(proveedor)}
                            className="px-4 py-3 hover:bg-[var(--color-row-hover)] cursor-pointer border-b border-[var(--color-border)] last:border-b-0 transition-colors"
                          >
                            <p className="text-sm font-medium text-[#14324A] dark:text-[#F8FAFC]">
                              {proveedor.nombre}
                            </p>
                            <p className="text-[10px] text-[#5E7184] dark:text-[#B8C2D1] mt-0.5">
                              {proveedor.telefono && `📞 ${proveedor.telefono}`}
                              {proveedor.nit && ` · NIT: ${proveedor.nit}`}
                            </p>
                          </div>
                        ))
                    )}
                  </div>
                )}
              </div>
              <Input
                type="text"
                value={formData.proveedor}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFormData((prev) => ({ ...prev, proveedor: e.target.value }))
                }
                placeholder="O escribe el nombre manualmente"
                className="w-full mt-2 rounded-2xl text-sm"
              />
            </div>
          </Card>

          {/* ═══ Sección 4: Compatibilidad y notas ═══════════════════════ */}
          <Card className="p-5 rounded-2xl">
            <SectionHeader icon={Tag} title="Compatibilidad y etiquetas" />

            {/* Compatibilidad */}
            <div className="mb-5">
              <FieldLabel>Compatibilidad</FieldLabel>
              <div className="flex gap-2 mb-3">
                <Input
                  type="text"
                  value={newCompatible}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setNewCompatible(e.target.value)
                  }
                  placeholder="iPhone 12 Pro Max"
                  className="flex-1 rounded-2xl text-sm"
                  onKeyDown={(e: React.KeyboardEvent) => {
                    if (e.key === "Enter") { e.preventDefault(); handleAddCompatible(); }
                  }}
                />
                <button
                  type="button"
                  onClick={handleAddCompatible}
                  className="shrink-0 px-3 h-10 flex items-center gap-1.5 rounded-2xl border border-[var(--color-border)] hover:border-[#48B9E6] hover:bg-[rgba(72,185,230,0.06)] text-[11px] font-semibold text-[#48B9E6] transition-colors"
                >
                  <Plus size={14} /> Agregar
                </button>
              </div>
              {formData.compatibilidad && formData.compatibilidad.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formData.compatibilidad.map((comp, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full bg-sky-50 dark:bg-sky-950/30 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800/40"
                    >
                      {comp}
                      <button
                        type="button"
                        onClick={() => handleRemoveCompatible(index)}
                        className="opacity-60 hover:opacity-100 transition-opacity"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Tags */}
            <div className="mb-5">
              <FieldLabel>Etiquetas</FieldLabel>
              <div className="flex gap-2 mb-3">
                <Input
                  type="text"
                  value={newTag}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewTag(e.target.value)}
                  placeholder="OLED, Incell, Amoled..."
                  className="flex-1 rounded-2xl text-sm"
                  onKeyDown={(e: React.KeyboardEvent) => {
                    if (e.key === "Enter") { e.preventDefault(); handleAddTag(); }
                  }}
                />
                <button
                  type="button"
                  onClick={handleAddTag}
                  className="shrink-0 px-3 h-10 flex items-center gap-1.5 rounded-2xl border border-[var(--color-border)] hover:border-[#48B9E6] hover:bg-[rgba(72,185,230,0.06)] text-[11px] font-semibold text-[#48B9E6] transition-colors"
                >
                  <Plus size={14} /> Agregar
                </button>
              </div>
              {formData.tags && formData.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formData.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800/40"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(index)}
                        className="opacity-60 hover:opacity-100 transition-opacity"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

          </Card>

          {/* ═══ Sección 4: Inventario y precios ══════════════════════════════════════ */}
          <Card className="p-5 rounded-2xl">
            <SectionHeader icon={Camera} title="Imágenes del repuesto" />

            {/* Drop zone */}
            <div
              className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-200 ${
                isDragging
                  ? "border-[#48B9E6] bg-[rgba(72,185,230,0.05)]"
                  : "border-[var(--color-border)] hover:border-[#48B9E6] hover:bg-[rgba(72,185,230,0.03)]"
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className="flex flex-col items-center gap-3">
                <div className="p-3 rounded-2xl bg-[rgba(72,185,230,0.10)] dark:bg-[rgba(72,185,230,0.08)]">
                  <Upload size={24} className="text-[#48B9E6]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#14324A] dark:text-[#F8FAFC]">
                    {isDragging ? "Suelta las imágenes aquí" : "Arrastra imágenes o haz clic"}
                  </p>
                  <p className="text-[11px] text-[#5E7184] dark:text-[#B8C2D1] mt-1">
                    JPG, PNG, WEBP · máx 5 MB c/u · hasta 10 imágenes
                  </p>
                </div>
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="sr-only"
                  onChange={handleFileSelect}
                />
                <input
                  ref={galleryInputRef}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={handleFileSelect}
                />
                <div className="flex gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-semibold bg-gradient-to-r from-[#48B9E6] to-[#2EA7D8] hover:from-[#2EA7D8] hover:to-[#2563EB] text-white transition-all shadow-sm"
                  >
                    <Camera size={14} />
                    Tomar foto
                  </button>
                  <button
                    type="button"
                    onClick={() => galleryInputRef.current?.click()}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-semibold bg-[rgba(72,185,230,0.10)] dark:bg-[rgba(72,185,230,0.08)] text-[#48B9E6] hover:bg-[rgba(72,185,230,0.20)] border border-[rgba(72,185,230,0.25)] transition-all"
                  >
                    <Upload size={14} />
                    Elegir galería
                  </button>
                </div>
              </div>
            </div>

            {/* Image previews */}
            {imageItems.length > 0 && (
              <div className="mt-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[11px] font-semibold text-[#5E7184] dark:text-[#B8C2D1] uppercase tracking-widest">
                    {imageItems.length} imagen{imageItems.length !== 1 ? "es" : ""}
                  </p>
                  <button
                    type="button"
                    onClick={handleRemoveAllImages}
                    className="text-[11px] text-red-400 dark:text-red-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                  >
                    Eliminar todas
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {imageItems.map((item, index) => {
                    const src = resolveImgSrc(item.url);
                    const isNew = item.file !== null;
                    return (
                      <div key={index} className="relative group">
                        <div className="relative rounded-2xl overflow-hidden border border-[var(--color-border)] group-hover:border-[#48B9E6] transition-colors aspect-square">
                          <img
                            src={src}
                            alt={`Imagen ${index + 1}`}
                            className="w-full h-full object-cover"
                            onClick={() => window.open(src, "_blank")}
                          />

                          {/* Controls overlay */}
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100">
                            {index > 0 && (
                              <button
                                type="button"
                                onClick={() => reorderImages(index, index - 1)}
                                className="p-1.5 bg-[var(--color-surface)] rounded-xl shadow"
                                title="Mover izquierda"
                              >
                                <ArrowLeft size={13} className="text-[#14324A] dark:text-[#F8FAFC]" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleRemoveImage(index)}
                              className="p-1.5 bg-red-500 rounded-xl shadow"
                              title="Eliminar"
                            >
                              <X size={13} className="text-white" />
                            </button>
                            {index < imageItems.length - 1 && (
                              <button
                                type="button"
                                onClick={() => reorderImages(index, index + 1)}
                                className="p-1.5 bg-[var(--color-surface)] rounded-xl shadow"
                                title="Mover derecha"
                              >
                                <ArrowLeft size={13} className="rotate-180 text-[#14324A] dark:text-[#F8FAFC]" />
                              </button>
                            )}
                          </div>

                          {/* Badges */}
                          {index === 0 && (
                            <span className="absolute top-1.5 left-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#48B9E6] text-white">
                              Principal
                            </span>
                          )}
                          <span
                            className={`absolute top-1.5 right-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                              isNew
                                ? "bg-emerald-500 text-white"
                                : "bg-black/50 text-white"
                            }`}
                          >
                            {isNew ? "Nueva" : index + 1}
                          </span>
                        </div>
                        <p className="text-[10px] text-center text-[#7F8A99] mt-1 truncate">
                          {isNew ? item.file?.name ?? "Nueva" : `Imagen ${index + 1}`}
                        </p>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-3 bg-[rgba(72,185,230,0.06)] dark:bg-[rgba(72,185,230,0.04)] border border-[rgba(72,185,230,0.18)] rounded-2xl px-4 py-2.5 flex items-center gap-2">
                  <Camera size={13} className="text-[#48B9E6] shrink-0" />
                  <p className="text-[11px] text-[#5E7184] dark:text-[#B8C2D1]">
                    <strong className="text-[#14324A] dark:text-[#F8FAFC]">Tip:</strong>{" "}
                    La primera imagen se muestra en el catálogo. Usa las flechas para reordenar.
                  </p>
                </div>
              </div>
            )}
          </Card>

          {/* ── Action buttons ──────────────────────────────────────────── */}
          <div className="flex flex-col-reverse sm:flex-row gap-3 justify-end pt-2 pb-8">
            <button
              type="button"
              onClick={() => handleClose()}
              disabled={isLoading}
              className="w-full sm:w-auto px-6 py-2.5 rounded-2xl text-sm font-semibold border border-[var(--color-border)] hover:border-[#48B9E6] text-[#5E7184] dark:text-[#B8C2D1] hover:text-[#14324A] dark:hover:text-[#F8FAFC] transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full sm:w-auto px-6 py-2.5 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 bg-gradient-to-r from-[#48B9E6] to-[#2EA7D8] hover:from-[#2EA7D8] hover:to-[#2563EB] text-white shadow-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save size={15} />
                  {isEditing ? "Guardar cambios" : "Crear repuesto"}
                </>
              )}
            </button>
          </div>
        </form>

      {/* ── Dialogs ─────────────────────────────────────────────────────── */}
      <ConfirmDialog
        open={showUnsavedDialog}
        onClose={cancelNavigation}
        onConfirm={confirmNavigation}
        title="Cambios sin guardar"
        message="Tienes cambios sin guardar. ¿Deseas salir sin guardar?"
        confirmText="Salir sin guardar"
      />

      {/* ── Nuevo Tipo ─────────────────────────────────────────────────── */}
      <ConfirmDialog
        open={showNewTipoDialog}
        onClose={() => { setShowNewTipoDialog(false); setNewTipoNombre(""); }}
        onConfirm={handleCreateTipo}
        title="Agregar Nuevo Tipo de Equipo"
        confirmText="Crear Tipo"
      >
        <div className="mt-4">
          <FieldLabel>Nombre del Tipo de Equipo</FieldLabel>
          <Input
            type="text"
            value={newTipoNombre}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewTipoNombre(e.target.value)}
            placeholder="Ej: Laptop, Consola, Cámara..."
            className="w-full rounded-2xl"
            autoFocus
            onKeyDown={(e: React.KeyboardEvent) => {
              if (e.key === "Enter") { e.preventDefault(); handleCreateTipo(); }
            }}
          />
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={showNewMarcaDialog}
        onClose={() => { setShowNewMarcaDialog(false); setNewMarcaNombre(""); }}
        onConfirm={handleCreateMarca}
        title="Agregar Nueva Marca"
        confirmText="Crear Marca"
      >
        <div className="mt-4">
          {formData.tipo && (
            <p className="text-xs text-[#5E7184] dark:text-[#B8C2D1] mb-3">
              Tipo: <strong className="text-[#14324A] dark:text-[#F8FAFC]">{formData.tipo}</strong>
            </p>
          )}
          <FieldLabel>Nombre de la Marca</FieldLabel>
          <Input
            type="text"
            value={newMarcaNombre}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewMarcaNombre(e.target.value)}
            placeholder="Ej: Oppo, Vivo, Realme"
            className="w-full rounded-2xl"
            autoFocus
            onKeyDown={(e: React.KeyboardEvent) => {
              if (e.key === "Enter") { e.preventDefault(); handleCreateMarca(); }
            }}
          />
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={showNewModeloDialog}
        onClose={() => { setShowNewModeloDialog(false); setNewModeloNombre(""); }}
        onConfirm={handleCreateModelo}
        title="Agregar Nuevo Modelo"
        confirmText="Crear Modelo"
      >
        <div className="mt-4">
          <p className="text-xs text-[#5E7184] dark:text-[#B8C2D1] mb-3">
            Tipo: <strong className="text-[#14324A] dark:text-[#F8FAFC]">{formData.tipo}</strong>
            {formData.marca && (
              <> · Marca: <strong className="text-[#14324A] dark:text-[#F8FAFC]">{formData.marca}</strong></>
            )}
          </p>
          <FieldLabel>Nombre del Modelo</FieldLabel>
          <Input
            type="text"
            value={newModeloNombre}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewModeloNombre(e.target.value)}
            placeholder="Ej: iPhone 16, Galaxy S25, Pavilion 15..."
            className="w-full rounded-2xl"
            autoFocus
            onKeyDown={(e: React.KeyboardEvent) => {
              if (e.key === "Enter") { e.preventDefault(); handleCreateModelo(); }
            }}
          />
        </div>
      </ConfirmDialog>
    </Modal>
  );
}
