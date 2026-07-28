
import { RouterProvider } from 'react-router-dom'

import { router } from './router/router'
import { useEffect } from 'react';
import Lenis from 'lenis';

function App() {
   useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      smooth: true,
    });

    function raf(time) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }

    requestAnimationFrame(raf);
  },[])

  return (
    <RouterProvider router={router} />
  )
}
   
export default App
