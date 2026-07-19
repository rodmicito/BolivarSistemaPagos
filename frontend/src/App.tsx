import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import Layout from './components/Layout';
import Pagos from './pages/Pagos';
import Contratos from './pages/Contratos';
import Inquilinos from './pages/Inquilinos';
import Habitaciones from './pages/Habitaciones';

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/pagos" element={<Pagos />} />
          <Route path="/contratos" element={<Contratos />} />
          <Route path="/inquilinos" element={<Inquilinos />} />
          <Route path="/habitaciones" element={<Habitaciones />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
