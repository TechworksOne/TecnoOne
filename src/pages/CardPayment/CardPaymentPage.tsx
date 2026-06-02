import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CreditCard, Lock, Check, X } from "lucide-react";
import PageHeader from "../../components/common/PageHeader";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Card from "../../components/ui/Card";
import { useToast } from "../../components/ui/Toast";

export default function CardPaymentPage() {
  const navigate = useNavigate();
  const toast = useToast();
  
  const [cardData, setCardData] = useState({
    cardNumber: "",
    holderName: "",
    email: "",
    expiryDate: "",
    cvv: "",
    amount: "0.00"
  });
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  function formatCardNumber(value: string) {
    const cleaned = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = cleaned.match(/\d{4,16}/g);
    const match = matches && matches[0] || '';
    const parts = [];

    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }

    if (parts.length) {
      return parts.join(' ');
    } else {
      return match;
    }
  }

  function formatExpiryDate(value: string) {
    const cleaned = value.replace(/\D+/g, '');
    if (cleaned.length >= 2) {
      return cleaned.substring(0, 2) + '/' + cleaned.substring(2, 4);
    }
    return cleaned;
  }

  function validateForm() {
    if (!cardData.cardNumber || cardData.cardNumber.replace(/\s/g, '').length < 16) {
      toast.add("Número de tarjeta inválido", "error");
      return false;
    }
    if (!cardData.holderName || cardData.holderName.length < 3) {
      toast.add("Nombre del titular requerido", "error");
      return false;
    }
    if (!cardData.email || !/\S+@\S+\.\S+/.test(cardData.email)) {
      toast.add("Correo electrónico inválido", "error");
      return false;
    }
    if (!cardData.expiryDate || cardData.expiryDate.length < 5) {
      toast.add("Fecha de vencimiento inválida", "error");
      return false;
    }
    if (!cardData.cvv || cardData.cvv.length < 3) {
      toast.add("Código de seguridad inválido", "error");
      return false;
    }
    return true;
  }

  async function processPayment() {
    if (!validateForm()) return;

    setIsProcessing(true);
    
    // Simular procesamiento de pago
    try {
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      setIsSuccess(true);
      toast.add("Pago procesado exitosamente", "success");
      
      // Redirigir después de 2 segundos
      setTimeout(() => {
        navigate('/ventas', { 
          state: { 
            paymentCompleted: true,
            paymentMethod: 'tarjeta',
            amount: cardData.amount
          }
        });
      }, 2000);
      
    } catch (error) {
      toast.add("Error al procesar el pago", "error");
    } finally {
      setIsProcessing(false);
    }
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center p-8 bg-white/95 backdrop-blur-sm border-0 shadow-xl rounded-2xl">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Check size={40} className="text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">¡Pago Exitoso!</h2>
          <p className="text-gray-600 dark:text-slate-400 mb-6">Su transacción ha sido procesada correctamente.</p>
          <div className="bg-green-50 p-4 rounded-xl border border-green-200 mb-6">
            <p className="text-green-800 font-semibold">Monto: Q {cardData.amount}</p>
            <p className="text-green-700 text-sm">Tarjeta: ****{cardData.cardNumber.slice(-4)}</p>
          </div>
          <p className="text-sm text-gray-500">Redirigiendo automáticamente...</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4">
      {/* Header */}
      <div className="bg-white/80 dark:bg-slate-900/90 backdrop-blur-sm border-0 shadow-lg rounded-2xl p-6 mb-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => navigate('/ventas')}
            className="text-blue-600 hover:bg-blue-50"
          >
            <ArrowLeft size={20} className="mr-2" />
            Volver a Ventas
          </Button>
          <PageHeader title="Procesamiento de Pago" subtitle="Pago seguro con tarjeta de crédito/débito" />
        </div>
      </div>

      {/* Payment Form */}
      <div className="max-w-2xl mx-auto">
        <Card className="bg-white/95 dark:bg-slate-900/98 backdrop-blur-sm border-0 shadow-xl rounded-2xl overflow-hidden">
          {/* Header del POS */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <CreditCard size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold">💳 Terminal de Pago</h2>
                <p className="text-blue-100">Ingrese los datos de la tarjeta</p>
              </div>
            </div>
          </div>

          <div className="p-8 space-y-6">
            {/* Monto */}
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-6 rounded-xl border border-green-200">
              <label className="block text-sm font-semibold text-green-900 mb-2">💰 Monto a Cobrar</label>
              <Input
                type="number"
                step="0.01"
                value={cardData.amount}
                onChange={(e) => setCardData({...cardData, amount: e.target.value})}
                placeholder="0.00"
                className="text-2xl font-bold text-green-600 border-2 border-green-300 focus:border-green-500"
              />
            </div>

            {/* Datos de la tarjeta */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <CreditCard size={20} className="mr-2 text-blue-600" />
                Información de la Tarjeta
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    💳 Número de Tarjeta
                  </label>
                  <Input
                    value={cardData.cardNumber}
                    onChange={(e) => setCardData({
                      ...cardData, 
                      cardNumber: formatCardNumber(e.target.value)
                    })}
                    placeholder="1234 5678 9012 3456"
                    maxLength={19}
                    className="border-2 border-blue-200 focus:border-blue-500 rounded-xl text-lg font-mono"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    📅 Fecha de Vencimiento
                  </label>
                  <Input
                    value={cardData.expiryDate}
                    onChange={(e) => setCardData({
                      ...cardData, 
                      expiryDate: formatExpiryDate(e.target.value)
                    })}
                    placeholder="MM/AA"
                    maxLength={5}
                    className="border-2 border-blue-200 focus:border-blue-500 rounded-xl text-lg font-mono"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    🔒 Código de Seguridad (CVV)
                  </label>
                  <Input
                    value={cardData.cvv}
                    onChange={(e) => setCardData({
                      ...cardData, 
                      cvv: e.target.value.replace(/\D/g, '').slice(0, 4)
                    })}
                    placeholder="123"
                    maxLength={4}
                    type="password"
                    className="border-2 border-blue-200 focus:border-blue-500 rounded-xl text-lg font-mono"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    👤 Nombre del Titular
                  </label>
                  <Input
                    value={cardData.holderName}
                    onChange={(e) => setCardData({
                      ...cardData, 
                      holderName: e.target.value.toUpperCase()
                    })}
                    placeholder="JUAN PÉREZ"
                    className="border-2 border-blue-200 focus:border-blue-500 rounded-xl text-lg"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    📧 Correo Electrónico
                  </label>
                  <Input
                    type="email"
                    value={cardData.email}
                    onChange={(e) => setCardData({...cardData, email: e.target.value})}
                    placeholder="cliente@ejemplo.com"
                    className="border-2 border-blue-200 focus:border-blue-500 rounded-xl text-lg"
                  />
                </div>
              </div>
            </div>

            {/* Información de seguridad */}
            <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
              <div className="flex items-start gap-3">
                <Lock size={20} className="text-blue-600 mt-1" />
                <div>
                  <h4 className="font-semibold text-blue-900">🔐 Transacción Segura</h4>
                  <p className="text-blue-700 text-sm mt-1">
                    Sus datos están protegidos con encriptación SSL de 256 bits. 
                    Esta información solo se usa para procesar el pago.
                  </p>
                </div>
              </div>
            </div>

            {/* Botones de acción */}
            <div className="flex gap-4 pt-4">
              <Button
                variant="ghost"
                onClick={() => navigate('/ventas')}
                className="flex-1 border-2 border-gray-300 text-gray-600 hover:bg-gray-50 rounded-xl py-3"
                disabled={isProcessing}
              >
                <X size={20} className="mr-2" />
                Cancelar
              </Button>
              <Button
                onClick={processPayment}
                disabled={isProcessing}
                className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
              >
                {isProcessing ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    Procesando...
                  </>
                ) : (
                  <>
                    <CreditCard size={20} className="mr-2" />
                    💳 Procesar Pago
                  </>
                )}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}