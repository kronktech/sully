import React from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { store } from "./store/index";
import Interpreter from "./components/Interpreter";
import "./styles.css";

const root = createRoot(document.getElementById("root"));

root.render(
  <Provider store={store}>
    <Interpreter />
  </Provider>
);
