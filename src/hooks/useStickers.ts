import { useState } from 'react';

// Mock de stickers usados - reemplazar con API real
const stickersUsados = [
  'REP-001',
  'REP-002',
  'REP-005',
  'REP-010'
];

export interface Sticker {
  numero: string;
  usado: boolean;
  ubicacion?: string;
  fechaAsignacion?: string;
}

export function useStickers() {
  const [isLoading, setIsLoading] = useState(false);

  const verificarSticker = async (numero: string): Promise<boolean> => {
    setIsLoading(true);
    
    // Simular verificación en API
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const usado = stickersUsados.includes(numero.toUpperCase());
    setIsLoading(false);
    
    return !usado; // true si está disponible
  };

  const asignarSticker = async (numero: string, ubicacion: string) => {
    setIsLoading(true);
    
    // Simular asignación en API
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Marcar como usado
    if (!stickersUsados.includes(numero.toUpperCase())) {
      stickersUsados.push(numero.toUpperCase());
    }
    
    setIsLoading(false);
    return true;
  };

  const buscarStickers = async (query: string): Promise<Sticker[]> => {
    setIsLoading(true);
    
    // Simular búsqueda en API
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Mock de resultados
    const resultados: Sticker[] = [];
    
    if (query.toLowerCase().includes('rep')) {
      for (let i = 1; i <= 50; i++) {
        const numero = `REP-${i.toString().padStart(3, '0')}`;
        if (numero.toLowerCase().includes(query.toLowerCase())) {
          resultados.push({
            numero,
            usado: stickersUsados.includes(numero),
            ubicacion: stickersUsados.includes(numero) ? 'Estante A' : undefined,
            fechaAsignacion: stickersUsados.includes(numero) ? '2024-10-20' : undefined
          });
        }
      }
    }
    
    setIsLoading(false);
    return resultados.slice(0, 10); // Limitar resultados
  };

  return {
    isLoading,
    verificarSticker,
    asignarSticker,
    buscarStickers
  };
}