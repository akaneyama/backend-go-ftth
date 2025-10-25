import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import Router from './routers/index'
import './index.css'
import { IconContext } from "@phosphor-icons/react";

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
     <IconContext.Provider value={{ weight: "duotone", size: 24 }}>
    <React.StrictMode>
      <BrowserRouter>
        <Router />
      </BrowserRouter>
    </React.StrictMode>
    </IconContext.Provider>
  );
}