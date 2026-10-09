"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./ImageEditor.module.css";

interface ImageEditorProps {
  imageSrc: string;
  onSave: (canvas: HTMLCanvasElement) => void;
  onCancel: () => void;
  aspectRatio?: number; // Ex: 1 para quadrado, 16/9 para panorâmico
  title?: string;
  cropShape?: 'circle' | 'square';
}

export const ImageEditor: React.FC<ImageEditorProps> = ({
  imageSrc,
  onSave,
  onCancel,
  aspectRatio = 1,
  title = "Editar Foto",
  cropShape = 'circle',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const imageDataRef = useRef<HTMLImageElement | null>(null);

  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Lock body scroll when modal is open
  useEffect(() => {
    // Save current overflow style
    const originalOverflow = document.body.style.overflow;
    const originalTouchAction = document.body.style.touchAction;
    
    // Prevent scrolling
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    
    // Restore on cleanup
    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.touchAction = originalTouchAction;
    };
  }, []);

  // Desenha a imagem no canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const image = imageDataRef.current;

    if (!canvas || !image || image.width === 0 || image.height === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Define o tamanho do canvas
    canvas.width = 400;
    canvas.height = 400 / aspectRatio;

    // Limpa o canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Salva o contexto
    ctx.save();

    // Move para o centro, rotaciona, volta para o ponto correto
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotation * Math.PI) / 180);

    // Calcula as dimensões da imagem com zoom
    const imgWidth = image.width * zoom;
    const imgHeight = image.height * zoom;

    // Desenha a imagem centralizada com offset
    ctx.drawImage(
      image,
      offsetX - imgWidth / 2,
      offsetY - imgHeight / 2,
      imgWidth,
      imgHeight
    );

    ctx.restore();

    // Desenha a máscara
    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.beginPath();
    // Desenha o retângulo inteiro
    ctx.rect(0, 0, canvas.width, canvas.height);
    
    if (cropShape === 'circle') {
      // Desenha o círculo no sentido anti-horário para criar o "furo"
      ctx.arc(
        canvas.width / 2,
        canvas.height / 2,
        Math.min(canvas.width, canvas.height) / 2 - 10, // Margem de 10px
        0,
        2 * Math.PI,
        true
      );
    } else {
      // Desenha o quadrado no sentido anti-horário para criar o "furo"
      const size = Math.min(canvas.width, canvas.height) - 20;
      const x = (canvas.width - size) / 2;
      const y = (canvas.height - size) / 2;
      ctx.moveTo(x + size, y);
      ctx.lineTo(x, y);
      ctx.lineTo(x, y + size);
      ctx.lineTo(x + size, y + size);
      ctx.closePath();
    }
    ctx.fill();
    ctx.restore();
    
    // Desenha borda da máscara para melhor visualização
    ctx.save();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    if (cropShape === 'circle') {
      ctx.arc(
        canvas.width / 2,
        canvas.height / 2,
        Math.min(canvas.width, canvas.height) / 2 - 10,
        0,
        2 * Math.PI
      );
    } else {
      const size = Math.min(canvas.width, canvas.height) - 20;
      ctx.rect(
        (canvas.width - size) / 2,
        (canvas.height - size) / 2,
        size,
        size
      );
    }
    ctx.stroke();
    ctx.restore();

  }, [zoom, rotation, offsetX, offsetY, aspectRatio]);

  // Carrega a imagem
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imageDataRef.current = img;
      // Ajusta o zoom inicial para cobrir a área
      const scale = Math.max(400 / img.width, (400 / aspectRatio) / img.height);
      setZoom(scale);
    };
    img.onerror = () => {
      console.error("Erro ao carregar imagem:", imageSrc);
    };
    img.src = imageSrc;
  }, [imageSrc, aspectRatio]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || !imageDataRef.current || !canvasRef.current) return;

    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;

    let newOffsetX = offsetX + deltaX;
    let newOffsetY = offsetY + deltaY;

    // Constrain logic
    const canvas = canvasRef.current;
    const image = imageDataRef.current;
    const imgWidth = image.width * zoom;
    const imgHeight = image.height * zoom;

    // Calculate max offsets (positive values)
    // The image is centered at (0,0) relative to the translation.
    // The canvas sees the image from -imgWidth/2 + offset to imgWidth/2 + offset.
    // We want the image edges to never be inside the canvas edges.
    // Canvas edges relative to center are -canvas.width/2 and canvas.width/2.
    
    // Left edge of image: -imgWidth/2 + offset
    // Right edge of image: imgWidth/2 + offset
    // Top edge of image: -imgHeight/2 + offset
    // Bottom edge of image: imgHeight/2 + offset
    
    // Constraints:
    // Left edge <= -canvas.width/2  => offset <= (imgWidth - canvas.width) / 2
    // Right edge >= canvas.width/2  => offset >= -(imgWidth - canvas.width) / 2
    
    const maxOffsetX = (imgWidth - canvas.width) / 2;
    const maxOffsetY = (imgHeight - canvas.height) / 2;

    // Clamp
    if (newOffsetX > maxOffsetX) newOffsetX = maxOffsetX;
    if (newOffsetX < -maxOffsetX) newOffsetX = -maxOffsetX;
    if (newOffsetY > maxOffsetY) newOffsetY = maxOffsetY;
    if (newOffsetY < -maxOffsetY) newOffsetY = -maxOffsetY;

    setOffsetX(newOffsetX);
    setOffsetY(newOffsetY);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch event handlers for mobile support
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1) {
      e.preventDefault(); // Prevent scrolling
      setIsDragging(true);
      const touch = e.touches[0];
      setDragStart({ x: touch.clientX, y: touch.clientY });
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDragging || !imageDataRef.current || !canvasRef.current || e.touches.length !== 1) return;

    e.preventDefault(); // Prevent scrolling

    const touch = e.touches[0];
    const deltaX = touch.clientX - dragStart.x;
    const deltaY = touch.clientY - dragStart.y;

    let newOffsetX = offsetX + deltaX;
    let newOffsetY = offsetY + deltaY;

    // Constrain logic (same as mouse)
    const canvas = canvasRef.current;
    const image = imageDataRef.current;
    const imgWidth = image.width * zoom;
    const imgHeight = image.height * zoom;

    const maxOffsetX = (imgWidth - canvas.width) / 2;
    const maxOffsetY = (imgHeight - canvas.height) / 2;

    // Clamp
    if (newOffsetX > maxOffsetX) newOffsetX = maxOffsetX;
    if (newOffsetX < -maxOffsetX) newOffsetX = -maxOffsetX;
    if (newOffsetY > maxOffsetY) newOffsetY = maxOffsetY;
    if (newOffsetY < -maxOffsetY) newOffsetY = -maxOffsetY;

    setOffsetX(newOffsetX);
    setOffsetY(newOffsetY);
    setDragStart({ x: touch.clientX, y: touch.clientY });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  const handleSave = () => {
    if (canvasRef.current) {
      // Para salvar apenas a parte dentro do círculo (opcional, mas geralmente desejado)
      // Ou salvamos tudo e o backend corta?
      // Geralmente salvamos o quadrado resultante.
      // Vamos redesenhar SEM a máscara antes de salvar?
      // Sim, precisamos do canvas limpo para salvar.
      
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      const image = imageDataRef.current;
      
      if (ctx && image) {
         // Redesenha apenas a imagem (sem máscara)
         ctx.clearRect(0, 0, canvas.width, canvas.height);
         ctx.save();
         ctx.translate(canvas.width / 2, canvas.height / 2);
         ctx.rotate((rotation * Math.PI) / 180);
         const imgWidth = image.width * zoom;
         const imgHeight = image.height * zoom;
         ctx.drawImage(
           image,
           offsetX - imgWidth / 2,
           offsetY - imgHeight / 2,
           imgWidth,
           imgHeight
         );
         ctx.restore();
         
         onSave(canvas);
         
         // Restaura a visualização (com máscara) para o usuário não ver um "glitch" se o save demorar
         // Mas como o modal fecha, talvez não precise.
      }
    }
  };

  const resetEditor = () => {
    if (imageDataRef.current) {
        const img = imageDataRef.current;
        const scale = Math.max(400 / img.width, (400 / aspectRatio) / img.height);
        setZoom(scale);
    } else {
        setZoom(1);
    }
    setRotation(0);
    setOffsetX(0);
    setOffsetY(0);
  };

  return (
    <div className={styles.editorContainer}>
      <div className={styles.editorModal}>
        <div className={styles.editorHeader}>
          <h3 className={styles.editorTitle}>{title}</h3>
          <button
            className={styles.editorClose}
            onClick={onCancel}
            aria-label="Fechar editor"
          >
            ✕
          </button>
        </div>

        <div className={styles.editorBody}>
          <div className={styles.canvasWrapper}>
            <canvas
              ref={canvasRef}
              className={styles.canvas}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            />
          </div>

          {/* <div className={styles.controlsPanel}>
            <div className={styles.controlGroup}>
              <p className={styles.dragHint}>
                💡 Arraste a imagem para ajustar
              </p>
            </div>
          </div> */}
        </div>

        <div className={styles.editorFooter}>
          <button className={styles.cancelButton} onClick={onCancel}>
            Cancelar
          </button>
          <button className={styles.saveButton} onClick={handleSave}>
            Salvar
          </button>
        </div>
      </div>

      <div className={styles.overlay} onClick={onCancel} />
    </div>
  );
};
