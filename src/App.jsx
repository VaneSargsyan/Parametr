
import { RouterProvider } from 'react-router-dom'

import { router } from './router/router'
import { useEffect } from 'react';
import Lenis from 'lenis';

function App() {
   useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let lenis;
    let frame;

    function updateMotion() {
      cancelAnimationFrame(frame);
      lenis?.destroy();
      lenis = undefined;
      if (motion.matches) return;
      lenis = new Lenis({ duration: 1.2 });
      function raf(time) {
        lenis.raf(time);
        frame = requestAnimationFrame(raf);
      }
      frame = requestAnimationFrame(raf);
    }

    updateMotion();
    motion.addEventListener('change', updateMotion);
    return () => {
      motion.removeEventListener('change', updateMotion);
      cancelAnimationFrame(frame);
      lenis?.destroy();
    };
  },[])

  return (
    <RouterProvider router={router} />
  )
}
   
export default App
