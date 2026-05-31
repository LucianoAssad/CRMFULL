import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Apply OS theme preference automatically
function applyTheme(dark: boolean) {
  document.documentElement.classList.toggle("dark", dark);
}
const mq = window.matchMedia("(prefers-color-scheme: dark)");
applyTheme(mq.matches);
mq.addEventListener("change", (e) => applyTheme(e.matches));

createRoot(document.getElementById("root")!).render(<App />);
