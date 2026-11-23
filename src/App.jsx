import Upload from "./pages/Upload";
import Datasets from "./pages/Datasets";
import Team from "./pages/Team";
import Workspace from "./pages/Workspace";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import MainLayout from "./layouts/MainLayout";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import Signup from "./pages/Signup";

function App() {
  return (
    <BrowserRouter>
      <Routes>

        <Route path="/" element={<Navigate to="/login" replace />} />

        <Route path="/login" element={<Login />} />

        <Route path="/signup" element={<Signup />} />

        <Route
          path="/dashboard"
          element={
            <MainLayout>
              <Dashboard />
            </MainLayout>
          }
        />
        <Route
          path="/workspace"
          element={
            <MainLayout>
              <Workspace />
            </MainLayout>
          }
        />
        <Route
          path="/team"
          element={
            <MainLayout>
              <Team />
            </MainLayout>
          }
        />
        <Route
          path="/datasets"
          element={
          <MainLayout>
            <Datasets />
          </MainLayout>
  }
       />
        <Route
          path="/upload"
          element={
          <MainLayout>
            <Upload />
          </MainLayout>
        }
      />

        <Route path="*" element={<Navigate to="/login" replace />} />

      </Routes>
    </BrowserRouter>
  );
}

export default App;
