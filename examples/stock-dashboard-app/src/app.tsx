import { BrowserRouter, Route, Routes } from "react-router-dom";
import { LayoutShell } from "@/components/layout-shell";
import { HomePage } from "@/routes/home-page";
import { StockPage } from "@/routes/stock-page";
import { PreventaPage } from "@/routes/preventa-page";
import { HistoryPage } from "@/routes/history-page";

export function App(): JSX.Element {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<LayoutShell />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/stock" element={<StockPage />} />
          <Route path="/preventas" element={<PreventaPage />} />
          <Route path="/historial" element={<HistoryPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
