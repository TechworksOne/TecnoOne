import { useNavigate } from "react-router-dom";
import NuevaCompraModal from "./NuevaCompraModal";
import { useEffect } from "react";
import { useSucursalContext } from "../../store/useSucursalContext";

export default function PurchaseFormPage() {
  const navigate = useNavigate();
  const branchMode = useSucursalContext((state) => state.mode);
  const contextVersion = useSucursalContext((state) => state.contextVersion);

  useEffect(() => {
    if (branchMode === "consolidated") navigate("/compras", { replace: true });
  }, [branchMode, contextVersion, navigate]);

  if (branchMode === "consolidated") return null;
  return (
    <NuevaCompraModal
      isOpen={true}
      onClose={() => navigate("/compras")}
      onSuccess={() => navigate("/compras")}
    />
  );
}
