import { create } from "zustand";
import { KardexEntry, Product } from "../types/product";
import * as categoryService from "../services/categoryService";
import * as productService from "../services/productService";
import { getImageUrl } from "../utils/getImageUrl";

// Construye la URL completa de un asset (imagen) a partir de una ruta relativa del backend.
const buildAssetUrl = (url?: string | null): string => getImageUrl(url);

interface CategoryStructure {
  [key: string]: string[];
}

interface CatalogState {
  products: Product[];
  categoryStructure: CategoryStructure;
  customCategories: CategoryStructure;
  kardex: KardexEntry[];
  isLoadingCategories: boolean;
  isLoadingProducts: boolean;
  pagination: {
    currentPage: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  loadCategories: () => Promise<void>;
  loadProducts: (
    page?: number,
    limit?: number,
    search?: string,
    categoria?: string,
    options?: { activo?: boolean; conStock?: boolean }
  ) => Promise<void>;
  addProduct: (product: Omit<Product, "id">) => Promise<void>;
  updateProduct: (id: string, updates: Partial<Product>) => Promise<void>;
  adjustStock: (productId: string, quantity: number, note: string) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  addKardexEntry: (entry: Omit<KardexEntry, "id">) => void;
  addCustomCategory: (category: string, subcategories?: string[]) => Promise<void>;
  addSubcategory: (category: string, subcategory: string) => Promise<void>;
  getAllCategories: () => string[];
  getSubcategories: (category: string) => string[];
}

export const useCatalog = create<CatalogState>((set, get) => ({
  products: [],
  categoryStructure: {},
  customCategories: {},
  kardex: [],
  isLoadingCategories: false,
  isLoadingProducts: false,
  pagination: {
    currentPage: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0
  },

  loadCategories: async () => {
    set({ isLoadingCategories: true });
    try {
      const response = await categoryService.getAllCategories();
      if (response.success) {
        set({ 
          categoryStructure: response.data.categoryStructure,
          isLoadingCategories: false 
        });
      }
    } catch (error) {
      console.error('Error al cargar categorías:', error);
      set({ isLoadingCategories: false });
    }
  },

  loadProducts: async (page = 1, limit = 20, search?: string, categoria?: string, options = {}) => {
    set({ isLoadingProducts: true });
    try {
      const response = await productService.getAllProducts({ 
        page,
        limit,
        ...(search ? { search } : {}),
        ...(categoria ? { categoria } : {}),
        ...(options.activo !== undefined ? { activo: options.activo } : {}),
        ...(options.conStock !== undefined ? { conStock: options.conStock } : {}),
      });
      if (response.success) {
        // Mapear productos de BD a formato frontend
        const mappedProducts = response.data.map((p: any) => ({
          id: p.id.toString(),
          sku: p.sku,
          name: p.nombre,
          category: p.categoria,
          subcategory: p.subcategoria,
          precioProducto: parseFloat(p.precio_costo) || 0,
          precioPublico: parseFloat(p.precio_venta) || 0,
          price: parseFloat(p.precio_venta) || 0, // Compatibilidad
          stock: parseInt(p.stock) || 0,
          stockMin: parseInt(p.stock_minimo) || 0,
          aplica_serie: p.aplica_serie === 1 || p.aplica_serie === true,
          active: p.activo === 1 || p.activo === true,
          description: p.descripcion || '',
          images: p.imagenes?.map((img: any) => buildAssetUrl(img.url)).filter(Boolean) || [],
          image: buildAssetUrl(p.imagenes?.[0]?.url)
        }));
        set({ 
          products: mappedProducts,
          pagination: {
            currentPage: response.pagination.page,
            pageSize: response.pagination.limit,
            total: response.pagination.total,
            totalPages: response.pagination.totalPages
          },
          isLoadingProducts: false 
        });
      }
    } catch (error) {
      console.error('Error al cargar productos:', error);
      set({ isLoadingProducts: false });
    }
  },

  addProduct: async (product) => {
    try {
      // Validar campos requeridos
      if (!product.category) {
        throw new Error('La categoría es requerida');
      }
      
      // Preparar datos para la API
      const productData = {
        sku: product.sku || '', // SKU opcional
        nombre: product.name,
        descripcion: product.description,
        categoria: product.category,
        subcategoria: product.subcategory || '',
        precio_costo: parseFloat(String(product.precioProducto)) || 0,
        precio_venta: parseFloat(String(product.precioPublico)) || 0,
        stock_minimo: parseInt(String(product.stockMin)) || 0,
        aplica_serie: product.aplica_serie ? true : false,
        imagenes: (() => {
          const imgs = product.images && product.images.length > 0
            ? product.images
            : product.image ? [product.image] : [];
          return imgs.map((url, index) => ({
            url: typeof url === 'string' ? url : url,
            orden: index,
            descripcion: `Imagen ${index + 1}`
          }));
        })()
      };

      console.log('📦 Creando producto:', { 
        categoria: productData.categoria, 
        subcategoria: productData.subcategoria,
        nombre: productData.nombre,
        aplica_serie: productData.aplica_serie,
        stock_minimo: productData.stock_minimo,
        sku: productData.sku || 'AUTO-GENERADO',
        precio_costo: productData.precio_costo,
        precio_venta: productData.precio_venta
      });

      const response = await productService.createProduct(productData);
      
      if (response.success) {
        // Recargar productos para reflejar el nuevo
        await get().loadProducts();
      }
    } catch (error) {
      console.error('Error al crear producto:', error);
      throw error;
    }
  },

  updateProduct: async (id, updates) => {
    try {
      // Mapear campos del frontend a la BD
      const productData: any = {};
      if (updates.sku !== undefined && updates.sku !== '') productData.sku = updates.sku;
      if (updates.name !== undefined && updates.name !== '') productData.nombre = updates.name;
      if (updates.description !== undefined) productData.descripcion = updates.description || null;
      if (updates.category !== undefined && updates.category !== '') productData.categoria = updates.category;
      if (updates.subcategory !== undefined) productData.subcategoria = updates.subcategory || null;
      if (updates.precioProducto !== undefined) productData.precio_costo = parseFloat(String(updates.precioProducto)) || 0;
      if (updates.precioPublico !== undefined) productData.precio_venta = parseFloat(String(updates.precioPublico)) || 0;
      if (updates.price !== undefined && updates.precioPublico === undefined) {
        productData.precio_venta = parseFloat(String(updates.price)) || 0;
      }
      if (updates.stock !== undefined) productData.stock = parseInt(String(updates.stock)) || 0;
      if (updates.stockMin !== undefined) productData.stock_minimo = parseInt(String(updates.stockMin)) || 0;
      if (updates.aplica_serie !== undefined) productData.aplica_serie = updates.aplica_serie ? true : false;
      if (updates.active !== undefined) productData.activo = updates.active;
      
      // Solo incluir imagenes si es una imagen NUEVA en base64.
      // Si es una URL existente (http:// o /uploads/), no enviar imagenes
      // para que el backend conserve las actuales sin borrarlas.
      if (updates.images && updates.images.length > 0) {
        const hasNew = updates.images.some(
          (u) => typeof u === 'string' && (u as string).startsWith('data:')
        );
        if (hasNew) {
          productData.imagenes = updates.images.map((url, index) => ({
            url: typeof url === 'string' ? url : url,
            orden: index,
            descripcion: `Imagen ${index + 1}`,
          }));
        }
      } else if (
        updates.image &&
        typeof updates.image === 'string' &&
        updates.image.startsWith('data:')
      ) {
        productData.imagenes = [{
          url: updates.image,
          orden: 0,
          descripcion: 'Imagen 1',
        }];
      }

      const response = await productService.updateProduct(id, productData);
      
      if (response.success) {
        // Actualizar localmente
        set((state) => ({
          products: state.products.map((p) => 
            p.id === id ? { ...p, ...updates } : p
          ),
        }));
      }
    } catch (error) {
      console.error('Error al actualizar producto:', error);
      throw error;
    }
  },

  adjustStock: async (productId, quantity, note) => {
    try {
      const response = await productService.adjustStock(productId, {
        cantidad: quantity,
        tipo: 'ajuste',
        nota: note
      });

      if (response.success) {
        // Actualizar localmente
        set((state) => ({
          products: state.products.map((p) =>
            p.id === productId ? { ...p, stock: response.data.stock_nuevo } : p
          ),
        }));
      }
    } catch (error) {
      console.error('Error al ajustar stock:', error);
      throw error;
    }
  },

  deleteProduct: async (id) => {
    try {
      const response = await productService.deleteProduct(id);
      
      if (response.success) {
        // Remover localmente
        set((state) => ({
          products: state.products.filter((p) => p.id !== id),
        }));
      }
    } catch (error) {
      console.error('Error al eliminar producto:', error);
      throw error;
    }
  },

  addKardexEntry: (entry) => {
    const newEntry = { ...entry, id: Date.now().toString() };
    set((state) => ({ kardex: [...state.kardex, newEntry] }));
  },

  addCustomCategory: async (category, subcategories = []) => {
    try {
      const response = await categoryService.createCategory({ 
        nombre: category,
        orden: 99 
      });
      
      if (response.success) {
        // Recargar categorías para reflejar la nueva
        await get().loadCategories();
      }
    } catch (error) {
      console.error('Error al crear categoría:', error);
      throw error;
    }
  },

  addSubcategory: async (categoryName, subcategory) => {
    try {
      // Primero necesitamos obtener el ID de la categoría
      const categoriesResponse = await categoryService.getAllCategories();
      if (!categoriesResponse.success) throw new Error('No se pudieron cargar las categorías');
      
      const category = categoriesResponse.data.categories.find(
        (cat: any) => cat.nombre === categoryName
      );
      
      if (!category) throw new Error('Categoría no encontrada');
      
      const response = await categoryService.createSubcategory({
        categoria_id: category.id,
        nombre: subcategory,
        orden: 99
      });
      
      if (response.success) {
        // Recargar categorías para reflejar la nueva subcategoría
        await get().loadCategories();
      }
    } catch (error) {
      console.error('Error al crear subcategoría:', error);
      throw error;
    }
  },

  getAllCategories: () => {
    const state = get();
    return [...Object.keys(state.categoryStructure), ...Object.keys(state.customCategories)];
  },

  getSubcategories: (category) => {
    const state = get();
    return state.categoryStructure[category] || state.customCategories[category] || [];
  },
}));
