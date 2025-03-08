import { configureStore } from "@reduxjs/toolkit";
import interpreterReducer from "./interpreterSlice";

const store = configureStore({
  reducer: {
    interpreter: interpreterReducer,
  },
});

const dispatch = (...args) => store.dispatch(...args);

export { dispatch, store };
