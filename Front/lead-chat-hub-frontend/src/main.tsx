import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Apply theme: localStorage override first, then OS preference
function applyTheme(dark: boolean) {
  document.documentElement.classList.toggle("dark", dark);
}
const saved = localStorage.getItem("theme");
if (saved) {
  applyTheme(saved === "dark");
} else {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  applyTheme(mq.matches);
  mq.addEventListener("change", (e) => {
    if (!localStorage.getItem("theme")) applyTheme(e.matches);
  });
}

createRoot(document.getElementById("root")!).render(<App />);
