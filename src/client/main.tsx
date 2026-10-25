import { render } from "solid-js/web";
import { App } from "./App.tsx";
import "./styles/global.css.ts";

const root = document.getElementById("app");
if (!root) {
  throw new Error("Missing #app element.");
}
render(() => <App />, root);
