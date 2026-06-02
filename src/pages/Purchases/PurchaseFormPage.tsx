import { useNavigate } from "react-router-dom";
import NuevaCompraModal from "./NuevaCompraModal";

export default function PurchaseFormPage() {
  const navigate = useNavigate();
  return (
    <NuevaCompraModal
      isOpen={true}
      onClose={() => navigate("/compras")}
      onSuccess={() => navigate("/compras")}
    />
  );
}
