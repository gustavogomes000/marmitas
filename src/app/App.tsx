import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "@/app/Layout";
import { useSessao } from "@/features/auth/sessao";
import { TelaDia } from "@/features/dia/TelaDia";
import { TelaPainel } from "@/features/painel/TelaPainel";
import { TelaCaixa } from "@/features/caixa/TelaCaixa";
import { TelaContas } from "@/features/contas/TelaContas";
import { TelaCozinha } from "@/features/cozinha/TelaCozinha";
import { TelaAgenda } from "@/features/agenda/TelaAgenda";
import { TelaEntregas } from "@/features/entregas/TelaEntregas";
import { TelaVendas } from "@/features/vendas/TelaVendas";
import { TelaUsuarios } from "@/features/usuarios/TelaUsuarios";
import { TelaAjustes } from "@/features/ajustes/TelaAjustes";
import { TelaTV } from "@/features/tv/TelaTV";

export function App() {
  const restaurar = useSessao((s) => s.restaurar);

  useEffect(() => {
    restaurar();
  }, [restaurar]);

  return (
    <Routes>
      <Route path="/tv" element={<TelaTV />} />
      <Route
        path="*"
        element={
          <Layout>
            <Routes>
              <Route path="/" element={<Navigate to="/dia" replace />} />
              <Route path="/dia" element={<TelaDia />} />
              <Route path="/painel" element={<TelaPainel />} />
              <Route path="/caixa" element={<TelaCaixa />} />
              <Route path="/contas" element={<TelaContas />} />
              <Route path="/cozinha" element={<TelaCozinha />} />
              <Route path="/agenda" element={<TelaAgenda />} />
              <Route path="/entregas" element={<TelaEntregas />} />
              <Route path="/vendas" element={<TelaVendas />} />
              <Route path="/usuarios" element={<TelaUsuarios />} />
              <Route path="/ajustes" element={<TelaAjustes />} />
              <Route path="*" element={<Navigate to="/dia" replace />} />
            </Routes>
          </Layout>
        }
      />
    </Routes>
  );
}
