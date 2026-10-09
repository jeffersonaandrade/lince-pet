import { useState } from "react";

interface UseImageEditorReturn {
  isEditorOpen: boolean;
  imageToEdit: string | null;
  openEditor: (imageSrc: string) => void;
  closeEditor: () => void;
  cleanup: () => void;
}

export const useImageEditor = (): UseImageEditorReturn => {
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [imageToEdit, setImageToEdit] = useState<string | null>(null);

  const openEditor = (imageSrc: string) => {
    setImageToEdit(imageSrc);
    setIsEditorOpen(true);
  };

  const closeEditor = () => {
    setIsEditorOpen(false);
    if (imageToEdit) {
      URL.revokeObjectURL(imageToEdit);
    }
    setImageToEdit(null);
  };

  const cleanup = () => {
    if (imageToEdit) {
      URL.revokeObjectURL(imageToEdit);
    }
  };

  return {
    isEditorOpen,
    imageToEdit,
    openEditor,
    closeEditor,
    cleanup,
  };
};
