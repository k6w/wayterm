import ReactDOM from "react-dom/client";
// Fonts are bundled (the app must work offline): Inter for the UI,
// JetBrains Mono as the default terminal font.
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/400-italic.css";
import "@fontsource/jetbrains-mono/700.css";
import App from "./app/App";
import "./styles.css";
import { loadAppFonts } from "./lib/fonts";

// Render after the fonts are ready (capped at 1.5s) so xterm.js measures
// JetBrains Mono rather than a fallback font.
void loadAppFonts().finally(() => {
  ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
});
