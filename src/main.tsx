import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import AOS from "aos";
import "aos/dist/aos.css";
import "./index.css";

// Add this before ReactDOM.createRoot(...).render(...)
AOS.init({
  duration: 650,
  easing: "ease-out-cubic",
  once: true,
  offset: 50,
  delay: 0,
  mirror: false,
  anchorPlacement: "top-bottom",
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
