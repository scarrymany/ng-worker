import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { MotionConfig } from 'framer-motion';
import '@fontsource-variable/manrope';
import './styles.css';
import { App } from './app';
import { initStore } from './lib/store';

function Root() {
  const [ready, setReady] = useState(false);
  useEffect(() => { initStore().then(() => setReady(true)); }, []);
  if (!ready) return <div className="load"><span className="brand-mark">NW</span></div>;
  return <MotionConfig reducedMotion="user"><App /></MotionConfig>;
}

// Turn off hover effects while any scroller moves (cheap: one class toggle, no React state).
let scrollTimer: number | undefined;
window.addEventListener('scroll', () => {
  document.body.classList.add('scrolling');
  window.clearTimeout(scrollTimer);
  scrollTimer = window.setTimeout(() => document.body.classList.remove('scrolling'), 140);
}, { capture: true, passive: true });

// The app is a desktop window: block the browser context menu and reload shortcuts in release.
if (!import.meta.env.DEV) {
  window.addEventListener('contextmenu', (e) => {
    if (!(e.target as HTMLElement).closest('input,textarea')) e.preventDefault();
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'F5' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'r')) e.preventDefault();
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
