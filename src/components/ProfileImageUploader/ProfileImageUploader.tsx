"use client";

import { useState, useRef } from "react";
import { Camera } from "lucide-react";
import styles from "./ProfileImageUploader.module.css";
import { ImageEditor } from "../ImageEditor/ImageEditor";

interface ProfileImageUploaderProps {
  currentImageUrl?: string | null;
  userName: string;
  onUpload: (file: File) => Promise<void>;
  isUploading?: boolean;
  className?: string;
  borderRadius?: string;
  cropShape?: "circle" | "square";
}

export default function ProfileImageUploader({
  currentImageUrl,
  userName,
  onUpload,
  isUploading = false,
  className = "",
  borderRadius = "50%",
  cropShape = "circle",
}: ProfileImageUploaderProps) {
  const [isSelectionModalOpen, setIsSelectionModalOpen] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setSelectedFile(file);
      setPreviewUrl(url);
      setIsSelectionModalOpen(false);
      setIsEditorOpen(true);
    }
  };

  const handleSaveEditedImage = async (canvas: HTMLCanvasElement) => {
    canvas.toBlob(async (blob) => {
      if (blob && selectedFile) {
        // Create a new File object from the blob to preserve the name but use the edited content
        const editedFile = new File([blob], selectedFile.name, {
          type: "image/png",
          lastModified: Date.now(),
        });

        try {
          await onUpload(editedFile);
        } finally {
          // Cleanup
          if (previewUrl) URL.revokeObjectURL(previewUrl);
          setPreviewUrl(null);
          setSelectedFile(null);
          setIsEditorOpen(false);
        }
      }
    }, "image/png", 0.95);
  };

  const handleCancelEdit = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setSelectedFile(null);
    setIsEditorOpen(false);
    // Re-open selection modal if desired, or just close everything. 
    // Let's close everything for now as is standard behavior.
  };

  return (
    <div className={`${styles.container} ${className}`}>
      <div
        className={styles.imageWrapper}
        onClick={() => !isUploading && setIsSelectionModalOpen(true)}
        title={isUploading ? "Enviando..." : (cropShape === "circle" ? "Alterar foto de perfil" : "Alterar foto do local")}
        style={{ borderRadius }}
      >
        {currentImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={currentImageUrl}
            alt={userName}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              backgroundColor: "#e5e7eb",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "3.5rem",
              fontWeight: 600,
              color: "#6b7280",
            }}
          >
            {userName.charAt(0).toUpperCase()}
          </div>
        )}

        <div className={styles.overlay}>
          <span className={styles.overlayText}>
            {isUploading ? "..." : "Alterar"}
          </span>
        </div>
      </div>

      {isSelectionModalOpen && (
        <div className={styles.modalOverlay} onClick={() => setIsSelectionModalOpen(false)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>
                {cropShape === "circle" ? "Alterar Foto de Perfil" : "Alterar Foto do Local"}
              </h3>
              <button
                className={styles.modalClose}
                onClick={() => setIsSelectionModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className={styles.modalBody}>
              <div
                className={styles.uploadArea}
                onClick={() => fileInputRef.current?.click()}
              >
                <Camera className={styles.uploadIcon} size={48} strokeWidth={1.5} />
                <p className={styles.uploadText}>Clique para selecionar uma foto</p>
                <p className={styles.uploadSubtext}>JPG, PNG ou GIF</p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className={styles.fileInput}
                onChange={handleFileSelect}
              />
            </div>

            <div className={styles.modalFooter}>
              <button
                className={styles.secondaryButton}
                onClick={() => setIsSelectionModalOpen(false)}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {isEditorOpen && previewUrl && (
        <ImageEditor
          imageSrc={previewUrl}
          title={cropShape === "circle" ? "Ajustar Foto de Perfil" : "Ajustar Foto do Local"}
          aspectRatio={1}
          cropShape={cropShape}
          onCancel={handleCancelEdit}
          onSave={handleSaveEditedImage}
        />
      )}
    </div>
  );
}
