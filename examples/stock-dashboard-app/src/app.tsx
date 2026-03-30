import { BrowserRouter, Route, Routes } from "react-router-dom";
import { LayoutShell } from "@/components/layout-shell";
import { HomePage } from "@/routes/home-page";
import { StockPage } from "@/routes/stock-page";

export function App(): JSX.Element {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<LayoutShell />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/stock" element={<StockPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
