import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "sileo";

import { AuthProvider } from "./auth/AuthProvider";
import { AdminAuthProvider } from "./auth/AdminAuthProvider";
import { SeoManager } from "./components/seo/SeoManager";
import ThemeToggleFloating from "./components/ThemeToggleFloating";
import { ThemeProvider } from "./theme/ThemeProvider";

import App from "./App";
import "./App.css";
import "react-quill-new/dist/quill.snow.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <ThemeProvider>
      <AuthProvider>
        <AdminAuthProvider>
          <SeoManager />
          <Toaster
            position="top-center"
            options={{
              fill: "#171717",
              roundness: 16,
              styles: {
                title: "text-white!",
                description: "font-smibold text-center text-white/75!",
                badge: "bg-white/10!",
                button: "bg-white/10! hover:bg-white/15!",
              },
            }}
          />
          <App />
          <ThemeToggleFloating />
        </AdminAuthProvider>
      </AuthProvider>
    </ThemeProvider>
  </BrowserRouter>
);
