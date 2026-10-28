"use client";

import { useEffect, useRef, type ComponentPropsWithoutRef } from 'react';
import ModalPortal from './ModalPortal';

/** O Safari pode exibir uma área menor e deslocada em relação ao layout viewport. */
function DialogFrame(props: ComponentPropsWithoutRef<'div'>) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const viewport = window.visualViewport;
    const ajustar = () => {
      if (!ref.current) return;
      ref.current.style.top = `${viewport?.offsetTop || 0}px`;
      ref.current.style.height = `${viewport?.height || window.innerHeight}px`;
      ref.current.style.bottom = 'auto';
    };
    const body = document.body;
    const anterior = { position: body.style.position, top: body.style.top, width: body.style.width, overflow: body.style.overflow };
    const scrollX = window.scrollX, scrollY = window.scrollY;
    // overflow:hidden sozinho não impede a rolagem do fundo em versões do iOS.
    Object.assign(body.style, { position: 'fixed', top: `-${scrollY}px`, width: '100%', overflow: 'hidden' });
    ajustar();
    viewport?.addEventListener('resize', ajustar);
    viewport?.addEventListener('scroll', ajustar);
    window.addEventListener('resize', ajustar);
    return () => {
      viewport?.removeEventListener('resize', ajustar);
      viewport?.removeEventListener('scroll', ajustar);
      window.removeEventListener('resize', ajustar);
      Object.assign(body.style, anterior);
      window.scrollTo(scrollX, scrollY);
    };
  }, []);
  return <div ref={ref} role="dialog" aria-modal="true" {...props} />;
}

export default function ViewportDialog(props: ComponentPropsWithoutRef<'div'>) {
  return <ModalPortal><DialogFrame {...props} /></ModalPortal>;
}
