import React, { useState, useEffect } from 'react';
import { Search, User, Plus, Phone, Mail } from 'lucide-react';
import Input from '../ui/Input';
import Button from '../ui/Button';

interface Customer {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  avatar?: string;
}

interface CustomerSelectorProps {
  selectedCustomer: {
    clienteId?: string;
    clienteNombre: string;
    clienteTelefono?: string;
    clienteEmail?: string;
  };
  onCustomerChange: (customer: {
    clienteId?: string;
    clienteNombre: string;
    clienteTelefono?: string;
    clienteEmail?: string;
  }) => void;
  className?: string;
}

// Mock de clientes - en producción vendría de la base de datos
const MOCK_CUSTOMERS: Customer[] = [
  {
    id: 'C001',
    name: 'Juan Pérez García',
    phone: '5551-2345',
    email: 'juan.perez@email.com'
  },
  {
    id: 'C002',
    name: 'María García López',
    phone: '5555-6789',
    email: 'maria.garcia@email.com'
  },
  {
    id: 'C003',
    name: 'Roberto Silva Mendoza',
    phone: '5556-1234',
    email: 'roberto.silva@email.com'
  },
  {
    id: 'C004',
    name: 'Ana Rodríguez Vega',
    phone: '5557-8901',
    email: 'ana.rodriguez@email.com'
  },
  {
    id: 'C005',
    name: 'Carlos Mendoza Cruz',
    phone: '5558-2345',
    email: 'carlos.mendoza@email.com'
  }
];

export function CustomerSelector({ selectedCustomer, onCustomerChange, className = '' }: CustomerSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [isManualMode, setIsManualMode] = useState(false);
  
  const filteredCustomers = MOCK_CUSTOMERS.filter(customer =>
    customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    customer.phone?.includes(searchQuery) ||
    customer.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    if (selectedCustomer.clienteNombre) {
      setSearchQuery(selectedCustomer.clienteNombre);
    }
  }, [selectedCustomer.clienteNombre]);

  const handleCustomerSelect = (customer: Customer) => {
    onCustomerChange({
      clienteId: customer.id,
      clienteNombre: customer.name,
      clienteTelefono: customer.phone,
      clienteEmail: customer.email
    });
    setSearchQuery(customer.name);
    setShowDropdown(false);
  };

  const handleManualInput = (field: string, value: string) => {
    onCustomerChange({
      ...selectedCustomer,
      [field]: value
    });
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className={`bg-white dark:bg-slate-900 rounded-2xl shadow-lg p-6 ${className}`}>
      {/* Encabezado de la sección */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
          <User size={20} className="text-blue-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Datos del Cliente</h3>
          <p className="text-sm text-gray-500">Selecciona un cliente existente o agrega uno nuevo</p>
        </div>
      </div>

      {!isManualMode ? (
        <>
          {/* Buscador de clientes */}
          <div className="relative mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <Input
                placeholder="Buscar cliente por nombre, teléfono o email..."
                value={searchQuery}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setSearchQuery(e.target.value);
                  setShowDropdown(true);
                  if (!e.target.value) {
                    onCustomerChange({
                      clienteNombre: '',
                      clienteTelefono: '',
                      clienteEmail: ''
                    });
                  }
                }}
                onFocus={() => setShowDropdown(true)}
                className="pl-10 h-12 rounded-xl border-2 border-gray-200 focus:border-blue-500"
              />
            </div>

            {/* Dropdown de resultados */}
            {showDropdown && searchQuery && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 dark:border-slate-600 rounded-xl shadow-lg z-50 max-h-60 overflow-y-auto">
                {filteredCustomers.length > 0 ? (
                  filteredCustomers.map((customer) => (
                    <button
                      key={customer.id}
                      onClick={() => handleCustomerSelect(customer)}
                      className="w-full px-4 py-3 text-left hover:bg-blue-50 flex items-center gap-3 border-b border-gray-100 last:border-b-0"
                    >
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                        {getInitials(customer.name)}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{customer.name}</p>
                        <div className="flex gap-4 text-sm text-gray-500">
                          {customer.phone && (
                            <span className="flex items-center gap-1">
                              <Phone size={12} />
                              {customer.phone}
                            </span>
                          )}
                          {customer.email && (
                            <span className="flex items-center gap-1">
                              <Mail size={12} />
                              {customer.email}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="p-4 text-center text-gray-500">
                    <p>No se encontraron clientes</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setIsManualMode(true);
                        setShowDropdown(false);
                      }}
                      className="mt-2 text-blue-600"
                    >
                      <Plus size={16} className="mr-1" />
                      Agregar cliente nuevo
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Cliente seleccionado */}
          {selectedCustomer.clienteId && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
                  {getInitials(selectedCustomer.clienteNombre)}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-blue-900">{selectedCustomer.clienteNombre}</p>
                  <div className="flex gap-4 text-sm text-blue-700">
                    {selectedCustomer.clienteTelefono && (
                      <span className="flex items-center gap-1">
                        <Phone size={12} />
                        {selectedCustomer.clienteTelefono}
                      </span>
                    )}
                    {selectedCustomer.clienteEmail && (
                      <span className="flex items-center gap-1">
                        <Mail size={12} />
                        {selectedCustomer.clienteEmail}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Botón para modo manual */}
          <Button
            variant="ghost"
            onClick={() => setIsManualMode(true)}
            className="w-full text-gray-600 border-2 border-dashed border-gray-300 hover:border-blue-300 hover:text-blue-600 h-12 rounded-xl"
          >
            <Plus size={20} className="mr-2" />
            Agregar cliente manualmente
          </Button>
        </>
      ) : (
        <>
          {/* Modo manual */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                Nombre completo *
              </label>
              <Input
                value={selectedCustomer.clienteNombre}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                  handleManualInput('clienteNombre', e.target.value)
                }
                placeholder="Nombre completo del cliente"
                className="h-12 rounded-xl border-2 border-gray-200 focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                Teléfono
              </label>
              <Input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={15}
                value={selectedCustomer.clienteTelefono || ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  handleManualInput(
                    'clienteTelefono',
                    e.target.value.replace(/\D/g, '').slice(0, 15),
                  )
                }
                placeholder="Número de teléfono"
                className="h-12 rounded-xl border-2 border-gray-200 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                Email
              </label>
              <Input
                type="email"
                value={selectedCustomer.clienteEmail || ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                  handleManualInput('clienteEmail', e.target.value)
                }
                placeholder="Correo electrónico"
                className="h-12 rounded-xl border-2 border-gray-200 focus:border-blue-500"
              />
            </div>

            <Button
              variant="ghost"
              onClick={() => setIsManualMode(false)}
              className="text-blue-600"
            >
              ← Buscar en clientes existentes
            </Button>
          </div>
        </>
      )}

      {/* Overlay para cerrar dropdown */}
      {showDropdown && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setShowDropdown(false)}
        />
      )}
    </div>
  );
}