import React, { useState, useEffect, useRef } from 'react';
import { Search, User, Plus, Phone, Mail, Star, Users, Edit3, X } from 'lucide-react';
import { Customer } from '../../types/customer';
import { useCustomers } from '../../store/useCustomers';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import Modal from '../ui/Modal';
import { useToast } from '../ui/Toast';

interface CustomerPickerProps {
  value?: Customer;
  onChange: (customer: Customer) => void;
  allowCreate?: boolean;
  placeholder?: string;
  className?: string;
}

interface CustomerCardProps {
  customer: Customer;
  onEdit?: () => void;
  showEdit?: boolean;
  className?: string;
}

// Subcomponente para mostrar la ficha del cliente seleccionado
export function CustomerCard({ customer, onEdit, showEdit = true, className = '' }: CustomerCardProps) {
  const customerName = customer.nombre
    ? `${customer.nombre}${customer.apellido ? ' ' + customer.apellido : ''}`.trim()
    : `${customer.firstName || ''} ${customer.lastName || ''}`.trim();
  const isFrequent = customer.frecuente || (customer.loyaltyPoints && customer.loyaltyPoints > 100) || (customer.totalVisits && customer.totalVisits > 5);
  const phone = customer.telefono || customer.phone;
  
  return (
    <Card className={`bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 p-4 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
            <User size={20} className="text-blue-600" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-semibold text-blue-900">{customerName}</h4>
              {isFrequent && (
                <Badge color="yellow" className="text-xs flex items-center">
                  <Star size={10} className="mr-1" />
                  Frecuente
                </Badge>
              )}
            </div>
            <div className="space-y-1">
              {phone && (
                <div className="flex items-center gap-1 text-sm text-blue-700">
                  <Phone size={12} />
                  <span>{phone}</span>
                </div>
              )}
              {(customer.correo || customer.email) && (
                <div className="flex items-center gap-1 text-sm text-blue-700">
                  <Mail size={12} />
                  <span>{customer.correo || customer.email}</span>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {showEdit && onEdit && (
          <Button
            variant="ghost"
            onClick={onEdit}
            className="text-blue-600 hover:text-blue-800 hover:bg-blue-100"
          >
            <Edit3 size={16} className="mr-1" />
            Cambiar
          </Button>
        )}
      </div>
      
      {customer.reparacionesAnteriores !== undefined && customer.reparacionesAnteriores > 0 && (
        <div className="mt-3 pt-3 border-t border-blue-200">
          <div className="text-xs text-blue-600">
            {customer.reparacionesAnteriores} reparaciones anteriores
            {customer.ultimaReparacion && (
              <span className="ml-2">• Última: {new Date(customer.ultimaReparacion).toLocaleDateString()}</span>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

export default function CustomerPicker({ 
  value, 
  onChange, 
  allowCreate = true, 
  placeholder = "Buscar cliente por nombre, teléfono o email...",
  className = '' 
}: CustomerPickerProps) {
  
  const customerStore = useCustomers();
  const customers = customerStore.customers;
  const toast = useToast();
  
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState('');
  
  // Form para nuevo cliente
  const [newCustomerForm, setNewCustomerForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    nit: '',
    address: '',
    notes: ''
  });

  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Cargar clientes al montar el componente
  useEffect(() => {
    customerStore.loadCustomers();
  }, []);

  // Debounce para la búsqueda (250ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Filtrar clientes cuando cambia la query
  useEffect(() => {
    if (debouncedQuery.trim()) {
      const results = customerStore.searchCustomers(debouncedQuery);
      setFilteredCustomers(results);
    } else {
      // Si no hay búsqueda, mostrar clientes frecuentes primero
      const frequent = customers.filter(c => c.loyaltyPoints > 100 || c.totalVisits > 5);
      const others = customers.filter(c => !(c.loyaltyPoints > 100 || c.totalVisits > 5)).slice(0, 6);
      setFilteredCustomers([...frequent, ...others]);
    }
  }, [debouncedQuery, customers, customerStore]);

  // Focus management
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Manejar ESC para cerrar
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleCustomerSelect = (customer: Customer) => {
    onChange(customer);
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleCreateNewCustomer = () => {
    if (!newCustomerForm.firstName.trim() && !newCustomerForm.lastName.trim()) {
      toast.error('El nombre es requerido');
      return;
    }

    customerStore.addCustomer(newCustomerForm);
    const createdCustomer = customers[customers.length - 1] || {
      id: Date.now().toString(),
      ...newCustomerForm,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      totalVisits: 0,
      customerSince: new Date().toISOString(),
      loyaltyPoints: 0
    };
    
    handleCustomerSelect(createdCustomer);
    setShowNewClientModal(false);
    setNewCustomerForm({
      firstName: '',
      lastName: '',
      phone: '',
      email: '',
      nit: '',
      address: '',
      notes: ''
    });
  };

  const highlightMatch = (text: string, query: string) => {
    if (!query.trim()) return text;
    
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, index) => 
      part.toLowerCase() === query.toLowerCase() ? (
        <span key={index} className="bg-[#FEF3C7] dark:bg-[rgba(250,204,21,0.18)] text-[#92400E] dark:text-[#FCD34D] rounded px-0.5">
          {part}
        </span>
      ) : part
    );
  };

  return (
    <div className={`relative ${className}`}>
      {/* Cliente seleccionado */}
      {value ? (
        <CustomerCard 
          customer={value} 
          onEdit={() => setIsOpen(true)}
        />
      ) : (
        /* Input de búsqueda cuando no hay cliente seleccionado */
        <div 
          className="cursor-pointer"
          onClick={() => setIsOpen(true)}
        >
          <div className="p-4 border-2 border-dashed border-[#D6EEF8] dark:border-[rgba(72,185,230,0.25)] rounded-2xl hover:border-[#48B9E6] transition-colors bg-[#F8FDFF] dark:bg-[#0A1220]">
            <div className="flex items-center gap-3 text-[#5E7184] dark:text-[#B8C2D1]">
              <User size={20} />
              <span>Seleccionar cliente...</span>
              <Search size={16} className="ml-auto" />
            </div>
          </div>
        </div>
      )}

      {/* Dropdown de búsqueda */}
      {isOpen && (
        <div 
          ref={dropdownRef}
          className="mt-2 bg-white dark:bg-[#0D1526] border border-[#D6EEF8] dark:border-[rgba(72,185,230,0.18)] rounded-2xl shadow-xl overflow-hidden"
        >
          {/* Header de búsqueda */}
          <div className="p-4 border-b border-[#D6EEF8] dark:border-[rgba(72,185,230,0.12)] bg-[#F8FDFF] dark:bg-[#0A1220]">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#7F8A99]" />
              <input
                ref={searchInputRef}
                value={searchQuery}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                placeholder={placeholder}
                className="w-full h-10 pl-10 pr-10 rounded-xl border border-[#D6EEF8] dark:border-[rgba(72,185,230,0.18)] bg-white dark:bg-[#060B14] text-[#14324A] dark:text-[#F8FAFC] placeholder:text-[#7F8A99] focus:outline-none focus:border-[#48B9E6] focus:ring-2 focus:ring-[#48B9E6]/20 text-sm transition-all"
              />
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[#7F8A99] hover:text-[#48B9E6] transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Lista de resultados */}
          <div className="max-h-[280px] overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 dark:[&::-webkit-scrollbar-thumb]:bg-[rgba(72,185,230,0.20)] [&::-webkit-scrollbar-thumb]:rounded-full">
            {filteredCustomers.length > 0 ? (
              <div className="p-2">
                {!searchQuery && (
                  <div className="px-3 py-2 text-[10px] font-semibold text-[#5E7184] dark:text-[#B8C2D1] uppercase tracking-widest">
                    Clientes frecuentes
                  </div>
                )}
                
                <div className="space-y-1">
                  {filteredCustomers.map((customer) => {
                    const customerName = customer.nombre
                      ? `${customer.nombre}${customer.apellido ? ' ' + customer.apellido : ''}`.trim()
                      : `${customer.firstName} ${customer.lastName}`.trim();
                    const isFrequent = customer.frecuente || customer.loyaltyPoints > 100 || customer.totalVisits > 5;
                    const phone = customer.telefono || customer.phone;
                    const email = customer.correo || customer.email;
                    
                    return (
                      <div
                        key={customer.id}
                        onClick={() => handleCustomerSelect(customer)}
                        className="flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-[#F6FCFF] dark:hover:bg-[#0A1220] border-b border-[#D6EEF8] dark:border-[rgba(72,185,230,0.10)] last:border-b-0"
                      >
                        <div className="w-9 h-9 bg-gradient-to-br from-[#48B9E6] to-[#2563EB] rounded-xl flex items-center justify-center shrink-0">
                          <User size={14} className="text-white" />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-semibold text-[#14324A] dark:text-[#F8FAFC] truncate text-sm">
                              {highlightMatch(customerName, searchQuery)}
                            </span>
                            {isFrequent && (
                              <Badge color="yellow" className="text-xs flex items-center flex-shrink-0">
                                <Star size={10} className="mr-1" />
                                Frecuente
                              </Badge>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-3 text-xs text-[#5E7184] dark:text-[#B8C2D1]">
                            {phone && (
                              <span className="flex items-center gap-1">
                                <Phone size={10} />
                                {highlightMatch(phone, searchQuery)}
                              </span>
                            )}
                            {email && (
                              <span className="flex items-center gap-1 truncate">
                                <Mail size={10} />
                                {highlightMatch(email, searchQuery)}
                            </span>
                          )}
                        </div>
                        
                        {customer.reparacionesAnteriores !== undefined && customer.reparacionesAnteriores > 0 && (
                          <div className="text-xs text-blue-600 mt-1">
                            {customer.reparacionesAnteriores} reparaciones anteriores
                          </div>
                        )}
                      </div>
                    </div>
                  )})}
                </div>
              </div>
            ) : (
              /* Empty state */
              <div className="p-8 text-center">
                <Users size={36} className="text-[#7F8A99] dark:text-[#5E7184] mx-auto mb-3" />
                <h3 className="text-sm font-semibold text-[#14324A] dark:text-[#F8FAFC] mb-1">
                  {searchQuery ? 'No se encontraron clientes' : 'No hay clientes'}
                </h3>
                <p className="text-xs text-[#5E7184] dark:text-[#B8C2D1] mb-4">
                  {searchQuery 
                    ? `No hay resultados para "${searchQuery}"`
                    : 'Agrega tu primer cliente para comenzar'
                  }
                </p>
                {allowCreate && (
                  <Button
                    onClick={() => {
                      setShowNewClientModal(true);
                      const names = searchQuery.trim().split(' ');
                      setNewCustomerForm(prev => ({ 
                        ...prev, 
                        firstName: names[0] || '',
                        lastName: names.slice(1).join(' ') || ''
                      }));
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Plus size={16} className="mr-2" />
                    Crear cliente{searchQuery ? ` "${searchQuery}"` : ''}
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Footer con botón crear */}
          {allowCreate && filteredCustomers.length > 0 && (
            <div className="p-3 border-t border-[#D6EEF8] dark:border-[rgba(72,185,230,0.12)] bg-[#F8FDFF] dark:bg-[#0A1220]">
              <button
                type="button"
                onClick={() => {
                  setShowNewClientModal(true);
                  setNewCustomerForm(prev => ({ 
                    ...prev, 
                    firstName: searchQuery.trim()
                  }));
                }}
                className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-[#D6EEF8] dark:border-[rgba(72,185,230,0.25)] rounded-xl py-2 text-sm font-medium text-[#5E7184] dark:text-[#B8C2D1] hover:border-[#48B9E6] hover:text-[#48B9E6] transition-all"
              >
                <Plus size={14} />
                Crear nuevo cliente
              </button>
            </div>
          )}
        </div>
      )}

      {/* Modal para crear nuevo cliente */}
      <Modal
        open={showNewClientModal}
        onClose={() => setShowNewClientModal(false)}
        title="Nuevo Cliente"
      >
        <div className="space-y-4">
          <div className="text-center mb-6">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mx-auto mb-3">
              <Users size={24} className="text-green-600" />
            </div>
            <p className="text-gray-600 dark:text-slate-400">
              Agrega los datos del nuevo cliente
            </p>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                  Nombre *
                </label>
                <Input
                  value={newCustomerForm.firstName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                    setNewCustomerForm({ ...newCustomerForm, firstName: e.target.value })
                  }
                  placeholder="Nombre"
                  className="w-full"
                  autoFocus
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                  Apellido
                </label>
                <Input
                  value={newCustomerForm.lastName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                    setNewCustomerForm({ ...newCustomerForm, lastName: e.target.value })
                  }
                  placeholder="Apellido"
                  className="w-full"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                  Teléfono
                </label>
                <Input
                  value={newCustomerForm.phone}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                    setNewCustomerForm({ ...newCustomerForm, phone: e.target.value })
                  }
                  placeholder="5555-1234"
                  className="w-full"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                  NIT
                </label>
                <Input
                  value={newCustomerForm.nit}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                    setNewCustomerForm({ ...newCustomerForm, nit: e.target.value })
                  }
                  placeholder="12345678-9"
                  className="w-full"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                Email
              </label>
              <Input
                type="email"
                value={newCustomerForm.email}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                  setNewCustomerForm({ ...newCustomerForm, email: e.target.value })
                }
                placeholder="cliente@email.com"
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                Dirección
              </label>
              <Input
                value={newCustomerForm.address}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                  setNewCustomerForm({ ...newCustomerForm, address: e.target.value })
                }
                placeholder="Zona, Ciudad"
                className="w-full"
              />
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <Button
              variant="ghost"
              onClick={() => setShowNewClientModal(false)}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreateNewCustomer}
              disabled={!newCustomerForm.firstName.trim() && !newCustomerForm.lastName.trim()}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
            >
              <Plus size={16} className="mr-2" />
              Crear Cliente
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}